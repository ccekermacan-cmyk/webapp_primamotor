package id.primamotor.pos.domain

import java.math.BigDecimal
import java.time.LocalDate

data class CartLine(
    val productId: String,
    val nama: String,
    val qty: BigDecimal,
    val price: BigDecimal,
)

/**
 * Validasi yang harus sama dengan server, dijalankan sebelum menulis offline.
 * Server tetap penentu akhir; ini mencegah transaksi yang pasti ditolak masuk outbox.
 */
object PosValidation {

    /** Arah stok mengikuti nama menu: penjualan/service mengurangi, pembelian menambah. */
    fun directionOf(menu: String): String =
        if (menu.lowercase().let { it.contains("penjualan") || it.contains("service") || it.contains("servis") }) "out" else "in"

    fun cartError(cart: List<CartLine>): String? {
        if (cart.isEmpty()) return "Keranjang masih kosong."
        cart.forEach { line ->
            if (line.qty.signum() <= 0) return "Jumlah ${line.nama} harus lebih dari 0."
            if (line.qty.stripTrailingZeros().scale() > 0) return "Jumlah ${line.nama} harus bilangan bulat."
            if (line.price.signum() < 0) return "Harga ${line.nama} tidak valid."
        }
        return null
    }

    /**
     * [stockByProduct] = stok server terakhir (atau cache). Qty baris yang sama dijumlahkan.
     * Arah `in` tidak pernah diblokir karena menambah stok.
     */
    fun stockError(cart: List<CartLine>, stockByProduct: Map<String, BigDecimal>, direction: String): String? {
        if (direction != "out") return null
        val needed = mutableMapOf<String, BigDecimal>()
        cart.forEach { line ->
            needed[line.productId] = (needed[line.productId] ?: BigDecimal.ZERO) + line.qty
        }
        needed.forEach { (id, qty) ->
            val stock = stockByProduct[id] ?: BigDecimal.ZERO
            if (stock < qty) {
                val nama = cart.firstOrNull { it.productId == id }?.nama ?: id
                return "Stok $nama tidak cukup: tersedia ${stock.stripTrailingZeros().toPlainString()}, diminta ${qty.stripTrailingZeros().toPlainString()}."
            }
        }
        return null
    }

    /** Tunai wajib menutup total; tempo wajib tanggal jatuh tempo yang valid. */
    fun paymentError(
        payment: String,
        nominalBayar: BigDecimal,
        total: BigDecimal,
        tempoDate: String,
        today: LocalDate = LocalDate.now(WibDate.WIB),
    ): String? {
        return when (payment) {
            "Tunai" -> if (nominalBayar < total) "Nominal bayar kurang dari total." else null
            "Tempo" -> {
                if (tempoDate.isBlank()) return "Tanggal tempo wajib diisi."
                val date = runCatching { LocalDate.parse(tempoDate) }.getOrNull()
                    ?: return "Tanggal tempo tidak valid."
                if (date.isBefore(today)) "Tanggal tempo tidak boleh sebelum hari ini." else null
            }
            else -> "Metode pembayaran tidak dikenal."
        }
    }

    fun statusOf(totalDibayar: BigDecimal, total: BigDecimal): String =
        if (totalDibayar >= total) "lunas" else "belum"
}
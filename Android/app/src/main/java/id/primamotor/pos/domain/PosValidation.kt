package id.primamotor.pos.domain

import java.math.BigDecimal
import java.time.LocalDate

data class CartLine(
    val productId: String,
    val nama: String,
    val qty: BigDecimal,
    val price: BigDecimal,
    /** Harga normal (sell_6) untuk laporan; default sama dengan harga jual. */
    val normalPrice: BigDecimal = price,
    /** Harga beli (beli) untuk kolom `price_2` log_stock, sama seperti web. */
    val cost: BigDecimal = BigDecimal.ZERO,
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

    /**
     * Sama dengan web: tunai tidak harus menutup total (status menjadi `belum`),
     * tempo wajib tanggal jatuh tempo yang valid.
     */
    fun paymentError(
        payment: String,
        nominalBayar: BigDecimal,
        total: BigDecimal,
        tempoDate: String,
        today: LocalDate = LocalDate.now(WibDate.WIB),
    ): String? {
        return when (payment) {
            "Tunai" -> null
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

    data class MechanicLine(val idLama: String, val ongkos: BigDecimal)

    data class PaymentLine(val accountId: String, val nominal: BigDecimal)

    /**
     * Cermin `validateCheckout` di `Frontend/src/lib/posValidation.ts`.
     * Urutan pesan mengikuti urutan tab web: items, payment, notes.
     */
    fun checkoutErrors(
        menu: String,
        cartCount: Int,
        mechanics: List<MechanicLine>,
        payments: List<PaymentLine>,
        isOnline: Boolean,
        marketplace: String,
        adminFee: BigDecimal,
        noteMenu: String,
        payment: String,
        tempoDate: String,
    ): List<String> {
        val errors = mutableListOf<String>()
        val lower = menu.lowercase()
        val service = lower.contains("service") || lower.contains("servis")
        val pembelian = lower.contains("pembelian")

        if (cartCount == 0 && !service) {
            errors += "Isi keranjang dengan item terlebih dahulu!"
        }
        if (service) {
            val valid = mechanics.filter { it.idLama.isNotBlank() && it.ongkos.signum() > 0 }
            if (valid.isEmpty()) {
                errors += "Untuk menu SERVICE, minimal 1 mekanik harus diisi dengan ongkos yang valid (> 0)."
            }
            if (mechanics.any { it.idLama.isNotBlank() && it.ongkos.signum() == 0 }) {
                errors += "Mekanik yang dipilih harus memiliki ongkos kerja yang valid (harus > 0). Silakan isi ongkos untuk semua mekanik."
            }
        }
        if (payments.any { it.accountId.isNotBlank() && it.nominal.signum() == 0 }) {
            errors += "Akun kas yang dipilih harus memiliki nominal pembayaran yang valid (harus > 0)."
        }
        if (payments.any { it.accountId.isBlank() && it.nominal.signum() > 0 }) {
            errors += "Nominal pembayaran dimasukkan tetapi akun kas belum dipilih. Silakan pilih akun kas terlebih dahulu."
        }
        if (isOnline) {
            if (marketplace.isBlank()) errors += "Marketplace wajib diisi untuk pelanggan online."
            if (adminFee.signum() < 0) errors += "Admin fee tidak boleh bernilai negatif."
        }
        if (service && noteMenu.isBlank()) {
            errors += "Isi jenis motor service pada catatan nota!"
        }
        if (pembelian) {
            if (payment == "Tempo" && tempoDate.isBlank()) {
                errors += "Tanggal jatuh tempo wajib diisi untuk pembelian dengan pembayaran Tempo."
            } else if (noteMenu.isBlank() && !(payment == "Tempo" && tempoDate.isNotBlank())) {
                errors += "Isi nota dari customer pada catatan nota!"
            }
        }
        return errors
    }
}
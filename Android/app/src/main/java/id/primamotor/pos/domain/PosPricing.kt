package id.primamotor.pos.domain

import java.math.BigDecimal

/**
 * Harga keranjang POS. Cermin `cartWithTierPrice` + `grandTotal` di `pages/pos.tsx`:
 *
 * - Pembelian memakai `beli`, tanpa tier.
 * - Pelanggan khusus (bukan Umum/Online) memakai `sell_5`.
 * - Selain itu `sell_6`, lalu tier grosir `min_1 -> sell_1`, `min_2 -> sell_2`, `min_3 -> sell_3`.
 * - Harga manual kasir (mis. hasil edit nota) selalu menang.
 */
object PosPricing {

    data class Prices(
        val beli: BigDecimal = BigDecimal.ZERO,
        val sell1: BigDecimal = BigDecimal.ZERO,
        val sell2: BigDecimal = BigDecimal.ZERO,
        val sell3: BigDecimal = BigDecimal.ZERO,
        val sell5: BigDecimal = BigDecimal.ZERO,
        val sell6: BigDecimal = BigDecimal.ZERO,
        val min1: BigDecimal = BigDecimal.ZERO,
        val min2: BigDecimal = BigDecimal.ZERO,
        val min3: BigDecimal = BigDecimal.ZERO,
    )

    data class Result(
        val price: BigDecimal,
        val basePrice: BigDecimal,
        val label: String,
        val tiered: Boolean,
    )

    fun isPembelian(menu: String): Boolean = menu.lowercase().contains("pembelian")

    fun isService(menu: String): Boolean = menu.lowercase().let { it.contains("service") || it.contains("servis") }

    /** Arah stok: penjualan/service mengurangi, sisanya menambah. */
    fun isOutgoing(menu: String): Boolean = isService(menu) || menu.lowercase().contains("penjualan")

    fun isUmum(personIdLama: String, personName: String): Boolean =
        personIdLama.lowercase().contains("umum1") || personName.lowercase().contains("umum1")

    fun isOnline(personIdLama: String, personName: String): Boolean =
        personIdLama.lowercase().contains("online1") || personName.lowercase().contains("online")

    fun resolve(
        menu: String,
        qty: BigDecimal,
        personIdLama: String,
        personName: String,
        prices: Prices,
        manualPrice: BigDecimal? = null,
    ): Result {
        val pembelian = isPembelian(menu)
        val special = !isUmum(personIdLama, personName) && !isOnline(personIdLama, personName)
        val base = when {
            pembelian -> prices.beli
            special -> prices.sell5
            else -> prices.sell6
        }
        var price = base
        var label = when {
            pembelian -> "Beli Lama"
            special -> "Harga Pelanggan"
            else -> "Harga Eceran"
        }
        var tiered = false

        if (!pembelian) {
            when {
                prices.min1.signum() > 0 && qty >= prices.min1 -> {
                    price = prices.sell1; label = "Grosir Besar"; tiered = true
                }
                prices.min2.signum() > 0 && qty >= prices.min2 -> {
                    price = prices.sell2; label = "Grosir Sedang"; tiered = true
                }
                prices.min3.signum() > 0 && qty >= prices.min3 -> {
                    price = prices.sell3; label = "Grosir Kecil"; tiered = true
                }
                special -> {
                    price = prices.sell5; label = "Harga Pelanggan"; tiered = true
                }
            }
        }

        if (manualPrice != null) {
            price = manualPrice
            label = "Harga Custom"
            tiered = true
        }

        return Result(price = price, basePrice = base, label = label, tiered = tiered)
    }

    /** `grandTotal` web: pembelian = subtotal; lainnya subtotal + ongkos - admin + cashback. */
    fun grandTotal(
        menu: String,
        subtotal: BigDecimal,
        ongkos: BigDecimal,
        adminFee: BigDecimal,
        cashback: BigDecimal,
    ): BigDecimal =
        if (isPembelian(menu)) subtotal else subtotal + ongkos - adminFee + cashback
}

package id.primamotor.pos.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal

/** Cermin `cartWithTierPrice` + `grandTotal` di `Frontend/src/pages/pos.tsx`. */
class PosPricingTest {

    private val prices = PosPricing.Prices(
        beli = BigDecimal("5000"),
        sell1 = BigDecimal("6000"),
        sell2 = BigDecimal("7000"),
        sell3 = BigDecimal("8000"),
        sell5 = BigDecimal("9000"),
        sell6 = BigDecimal("10000"),
        min1 = BigDecimal("12"),
        min2 = BigDecimal("6"),
        min3 = BigDecimal("3"),
    )

    @Test
    fun retail_uses_sell6_below_all_tiers() {
        val result = PosPricing.resolve("Penjualan", BigDecimal.ONE, "2000", "Umum1", prices)
        assertEquals(BigDecimal("10000"), result.price)
        assertFalse(result.tiered)
    }

    @Test
    fun grosir_tier_picks_lowest_price_by_qty() {
        assertEquals(BigDecimal("8000"), PosPricing.resolve("Penjualan", BigDecimal("3"), "2000", "Umum1", prices).price)
        assertEquals(BigDecimal("7000"), PosPricing.resolve("Penjualan", BigDecimal("6"), "2000", "Umum1", prices).price)
        assertEquals(BigDecimal("6000"), PosPricing.resolve("Penjualan", BigDecimal("12"), "2000", "Umum1", prices).price)
    }

    @Test
    fun special_customer_uses_sell5_until_tier_beats_it() {
        val special = PosPricing.resolve("Penjualan", BigDecimal.ONE, "84", "Geral", prices)
        assertEquals(BigDecimal("9000"), special.price)
        assertEquals(BigDecimal("6000"), PosPricing.resolve("Penjualan", BigDecimal("12"), "84", "Geral", prices).price)
    }

    @Test
    fun pembelian_uses_beli_without_tier() {
        val result = PosPricing.resolve("Pembelian", BigDecimal("20"), "84", "Geral", prices)
        assertEquals(BigDecimal("5000"), result.price)
        assertFalse(result.tiered)
    }

    @Test
    fun manual_price_always_wins() {
        val result = PosPricing.resolve("Penjualan", BigDecimal("12"), "2000", "Umum1", prices, BigDecimal("5500"))
        assertEquals(BigDecimal("5500"), result.price)
        assertEquals("Harga Custom", result.label)
        assertTrue(result.tiered)
    }

    @Test
    fun grand_total_matches_web_formula() {
        val subtotal = BigDecimal("100000")
        assertEquals(
            BigDecimal("100000"),
            PosPricing.grandTotal("Pembelian", subtotal, BigDecimal("5000"), BigDecimal("1000"), BigDecimal("2000")),
        )
        assertEquals(
            BigDecimal("106000"),
            PosPricing.grandTotal("Penjualan", subtotal, BigDecimal("5000"), BigDecimal("1000"), BigDecimal("2000")),
        )
    }

    @Test
    fun online_and_umum_are_detected_from_id_or_name() {
        assertTrue(PosPricing.isUmum("2000", "Umum1"))
        assertTrue(PosPricing.isUmum("umum1", ""))
        assertTrue(PosPricing.isOnline("online1", ""))
        assertTrue(PosPricing.isOnline("", "Online Shop"))
        assertFalse(PosPricing.isOnline("84", "Geral"))
    }
}

package id.primamotor.pos.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal
import java.time.LocalDate

class PosValidationTest {

    private fun line(id: String, qty: String, price: String = "10000") =
        CartLine(productId = id, nama = "Produk $id", qty = BigDecimal(qty), price = BigDecimal(price))

    @Test
    fun qty_must_be_positive_integer() {
        assertTrue(PosValidation.cartError(listOf(line("p1", "1.5")))!!.contains("bulat"))
        assertTrue(PosValidation.cartError(listOf(line("p1", "0")))!!.contains("lebih dari 0"))
        assertNull(PosValidation.cartError(listOf(line("p1", "2"))))
    }

    @Test
    fun empty_cart_is_rejected() {
        assertEquals("Keranjang masih kosong.", PosValidation.cartError(emptyList()))
    }

    @Test
    fun stock_out_is_blocked_offline() {
        val cart = listOf(line("p1", "3"))
        val error = PosValidation.stockError(cart, mapOf("p1" to BigDecimal("2")), direction = "out")
        assertTrue(error!!.contains("tidak cukup"))
    }

    @Test
    fun duplicate_lines_count_together() {
        val cart = listOf(line("p1", "2"), line("p1", "2"))
        assertTrue(PosValidation.stockError(cart, mapOf("p1" to BigDecimal("3")), "out") != null)
        assertNull(PosValidation.stockError(cart, mapOf("p1" to BigDecimal("4")), "out"))
    }

    @Test
    fun stock_in_is_never_blocked() {
        assertNull(PosValidation.stockError(listOf(line("p1", "99")), emptyMap(), direction = "in"))
    }

    @Test
    fun cash_partial_is_allowed_like_web() {
        // Web tidak menolak tunai kurang; status nota menjadi belum lunas.
        assertNull(PosValidation.paymentError("Tunai", BigDecimal("9000"), BigDecimal("10000"), ""))
        assertEquals("belum", PosValidation.statusOf(BigDecimal("9000"), BigDecimal("10000")))
        assertEquals("lunas", PosValidation.statusOf(BigDecimal("10000"), BigDecimal("10000")))
    }

    @Test
    fun tempo_requires_valid_future_date() {
        val today = LocalDate.of(2026, 11, 27)
        assertTrue(PosValidation.paymentError("Tempo", BigDecimal.ZERO, BigDecimal("10000"), "", today)!!.contains("wajib"))
        assertTrue(
            PosValidation.paymentError("Tempo", BigDecimal.ZERO, BigDecimal("10000"), "2026-11-26", today)!!.contains("sebelum"),
        )
        assertNull(PosValidation.paymentError("Tempo", BigDecimal.ZERO, BigDecimal("10000"), "2026-12-01", today))
    }

    @Test
    fun status_follows_paid_amount() {
        assertEquals("lunas", PosValidation.statusOf(BigDecimal("10000"), BigDecimal("10000")))
        assertEquals("belum", PosValidation.statusOf(BigDecimal("5000"), BigDecimal("10000")))
    }

    @Test
    fun menu_name_decides_stock_direction() {
        assertEquals("out", PosValidation.directionOf("Penjualan"))
        assertEquals("out", PosValidation.directionOf("Service"))
        assertEquals("in", PosValidation.directionOf("Pembelian"))
    }
}
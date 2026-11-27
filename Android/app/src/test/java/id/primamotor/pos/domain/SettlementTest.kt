package id.primamotor.pos.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal

class SettlementTest {

    @Test
    fun remaining_is_total_minus_paid() {
        assertEquals(0, BigDecimal("60000").compareTo(Settlement.remaining(BigDecimal("100000"), BigDecimal("40000"))))
        assertEquals(0, BigDecimal.ZERO.compareTo(Settlement.remaining(BigDecimal("100000"), BigDecimal("150000"))))
    }

    @Test
    fun overpayment_is_rejected() {
        val error = Settlement.error(BigDecimal("100000"), BigDecimal("40000"), BigDecimal("70000"))
        assertTrue(error!!.contains("melebihi"))
    }

    @Test
    fun zero_or_negative_is_rejected() {
        assertTrue(Settlement.error(BigDecimal("100000"), BigDecimal.ZERO, BigDecimal.ZERO)!!.contains("lebih dari 0"))
    }

    @Test
    fun paid_note_cannot_be_settled_again() {
        assertTrue(Settlement.error(BigDecimal("100000"), BigDecimal("100000"), BigDecimal("1000"))!!.contains("lunas"))
    }

    @Test
    fun full_payment_marks_note_paid() {
        assertEquals("lunas", Settlement.statusAfter(BigDecimal("100000"), BigDecimal("40000"), BigDecimal("60000")))
        assertEquals("belum", Settlement.statusAfter(BigDecimal("100000"), BigDecimal("40000"), BigDecimal("10000")))
    }

    @Test
    fun partial_payment_has_no_error() {
        assertNull(Settlement.error(BigDecimal("100000"), BigDecimal("40000"), BigDecimal("60000")))
    }
}
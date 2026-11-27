package id.primamotor.pos.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.math.BigDecimal

class MoneyTest {

    @Test
    fun rupiah_uses_dot_thousands_and_no_decimals_when_integral() {
        assertEquals("Rp 1.250.000", Money.formatRupiah(BigDecimal("1250000")))
    }

    @Test
    fun rupiah_keeps_two_decimals_when_fraction_exists() {
        assertEquals("Rp 1.250.575,50", Money.formatRupiah(BigDecimal("1250575.5")))
    }

    @Test
    fun rupiah_formats_zero_and_negative() {
        assertEquals("Rp 0", Money.formatRupiah(BigDecimal.ZERO))
        assertEquals("-Rp 5.000", Money.formatRupiah(BigDecimal("-5000")))
    }

    @Test
    fun rupiah_null_is_empty() {
        assertEquals("", Money.formatRupiah(null))
    }

    @Test
    fun parse_accepts_dotted_thousands_and_comma_decimal() {
        assertEquals(BigDecimal("1250000"), Money.parse("Rp 1.250.000"))
        assertEquals(BigDecimal("1250.50"), Money.parse("1.250,50"))
        assertEquals(BigDecimal("7500"), Money.parse("7500"))
    }

    @Test
    fun parse_rejects_garbage() {
        assertNull(Money.parse(""))
        assertNull(Money.parse("abc"))
    }
}
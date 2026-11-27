package id.primamotor.pos.hardware.printer

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal

class ReceiptTemplateTest {

    private val data = ReceiptData(
        notaId = "abc123",
        waktu = "27-11-2026 09:00",
        kasir = "kasir",
        items = listOf(
            ReceiptItem("Oli Mesin", BigDecimal("2"), BigDecimal("15000")),
            ReceiptItem("Jasa Servis", BigDecimal.ONE, BigDecimal("25000")),
        ),
        total = BigDecimal("55000"),
        bayar = BigDecimal("60000"),
        kembali = BigDecimal("5000"),
        mekanik = listOf("Budi" to BigDecimal("10000")),
    )

    @Test
    fun starts_with_init_and_ends_with_cut() {
        val bytes = ReceiptTemplate.render(data)

        assertTrue(bytes.take(2) == listOf(0x1B.toByte(), 0x40.toByte()))
        assertTrue(
            bytes.takeLast(3) == listOf(0x1D.toByte(), 0x56.toByte(), 0x01.toByte()),
        )
    }

    @Test
    fun contains_header_items_and_totals() {
        val text = String(ReceiptTemplate.render(data), Charsets.US_ASCII)

        assertTrue(text.contains("PRIMA MOTOR"))
        assertTrue(text.contains("Oli Mesin"))
        assertTrue(text.contains("2 x 15.000"))
        assertTrue(text.contains("30.000"))
        assertTrue(text.contains("TOTAL"))
        assertTrue(text.contains("55.000"))
        assertTrue(text.contains("KEMBALI"))
        assertTrue(text.contains("Jasa Budi 10.000"))
    }

    @Test
    fun non_ascii_characters_become_question_mark() {
        assertEquals("Caf? 5.000", ReceiptTemplate.ascii("Café 5.000"))
    }

    @Test
    fun money_uses_indonesian_grouping() {
        assertEquals("1.250.000", ReceiptTemplate.money(BigDecimal("1250000")))
        assertEquals("-15.000", ReceiptTemplate.money(BigDecimal("-15000")))
        assertEquals("0", ReceiptTemplate.money(BigDecimal.ZERO))
    }
}
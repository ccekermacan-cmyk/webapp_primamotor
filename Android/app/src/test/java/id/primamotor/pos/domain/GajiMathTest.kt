package id.primamotor.pos.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.math.BigDecimal

class GajiMathTest {

    @Test
    fun netto_matches_web_salary_details() {
        val item = GajiItem(
            pokok = BigDecimal("3000000"),
            tunjangan = BigDecimal("500000"),
            bonus1 = BigDecimal("50000"),
            lembur = BigDecimal("100000"),
            bpjs = BigDecimal("30000"),
            bonDiambil = BigDecimal("40000"),
            bonDibayar = BigDecimal("10000"),
        )

        assertEquals(0, BigDecimal("3570000").compareTo(GajiMath.netto(item)))
        assertEquals(0, BigDecimal("3650000").compareTo(GajiMath.details(item).total1))
        assertEquals(0, BigDecimal("80000").compareTo(GajiMath.details(item).total3))
    }

    @Test
    fun attendance_deductions_use_daily_wage_and_telat_per_thousand() {
        val item = GajiItem(
            pokok = BigDecimal("6000000"),
            tunjangan = BigDecimal("1000000"),
            qty = BigDecimal("2"),
            alfa = BigDecimal.ONE,
            setengahHari = BigDecimal.ONE,
            sakit = BigDecimal.ONE,
            telat = BigDecimal("10"),
        )

        val details = GajiMath.details(item)

        assertEquals(0, BigDecimal("8410000").compareTo(details.total2))
        assertEquals(0, BigDecimal("-1410000").compareTo(details.grandTotal))
    }

    @Test
    fun server_total_overrides_computation() {
        val item = GajiItem(pokok = BigDecimal("3000000"), total = BigDecimal("2500000"))
        assertEquals(0, BigDecimal("2500000").compareTo(GajiMath.netto(item)))
    }

    @Test
    fun loan_summary_matches_web() {
        val summary = LoanSummary.of(
            listOf(
                LoanEntry(BigDecimal("100000"), "out"),
                LoanEntry(BigDecimal("40000"), "in"),
                LoanEntry(BigDecimal("-5"), "out"),
            ),
            BigDecimal("60000"),
        )

        assertEquals(0, BigDecimal("100000").compareTo(summary.borrowed))
        assertEquals(0, BigDecimal("40000").compareTo(summary.repaid))
        assertEquals(40, summary.rate)
        assertEquals(0, BigDecimal("60000").compareTo(summary.balance))
    }

    @Test
    fun no_borrowing_means_no_rate() {
        assertNull(LoanSummary.of(emptyList(), BigDecimal.ZERO).rate)
    }
}
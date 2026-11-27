package id.primamotor.pos.domain

import java.math.BigDecimal
import java.math.MathContext

data class GajiItem(
    val pokok: BigDecimal = BigDecimal.ZERO,
    val tunjangan: BigDecimal = BigDecimal.ZERO,
    val bonus1: BigDecimal = BigDecimal.ZERO,
    val bonus2: BigDecimal = BigDecimal.ZERO,
    val bonus3: BigDecimal = BigDecimal.ZERO,
    val bonus4: BigDecimal = BigDecimal.ZERO,
    val program: BigDecimal = BigDecimal.ZERO,
    val lembur: BigDecimal = BigDecimal.ZERO,
    val alfa: BigDecimal = BigDecimal.ZERO,
    val setengahHari: BigDecimal = BigDecimal.ZERO,
    val sakit: BigDecimal = BigDecimal.ZERO,
    val telat: BigDecimal = BigDecimal.ZERO,
    val bpjs: BigDecimal = BigDecimal.ZERO,
    val bonDiambil: BigDecimal = BigDecimal.ZERO,
    val bonDibayar: BigDecimal = BigDecimal.ZERO,
    val qty: BigDecimal = BigDecimal.ONE,
    /** Nilai `total` server; bila ada, dipakai apa adanya seperti web. */
    val total: BigDecimal? = null,
)

data class GajiDetails(
    val total1: BigDecimal,
    val total2: BigDecimal,
    val total3: BigDecimal,
    val grandTotal: BigDecimal,
)

/** Port `salaryDetails` dari Frontend/src/lib/account.ts. */
object GajiMath {

    fun details(item: GajiItem, periodQty: BigDecimal = item.qty): GajiDetails {
        val qty = if (periodQty.signum() > 0) periodQty else BigDecimal.ONE
        val dasar = item.pokok.add(item.tunjangan).divide(qty, MathContext.DECIMAL64)
        val total1 = item.pokok + item.tunjangan + item.bonus1 + item.bonus2 + item.bonus3 + item.bonus4 +
            item.program + item.lembur
        val total2 = dasar.multiply(item.alfa) +
            dasar.multiply(item.setengahHari).divide(BigDecimal(2), MathContext.DECIMAL64) +
            dasar.multiply(BigDecimal("0.9")).multiply(item.sakit) +
            item.telat.multiply(BigDecimal(1000))
        val total3 = item.bpjs + item.bonDiambil + item.bonDibayar
        val grand = item.total ?: (total1 - total2 - total3)
        return GajiDetails(total1, total2, total3, grand)
    }

    fun netto(item: GajiItem, periodQty: BigDecimal = item.qty): BigDecimal = details(item, periodQty).grandTotal
}

data class LoanEntry(val nominal: BigDecimal, val jenis: String)

data class LoanSummary(val borrowed: BigDecimal, val repaid: BigDecimal, val balance: BigDecimal, val rate: Int?) {
    companion object {
        fun of(entries: List<LoanEntry>, balance: BigDecimal): LoanSummary {
            var borrowed = BigDecimal.ZERO
            var repaid = BigDecimal.ZERO
            entries.forEach { entry ->
                if (entry.nominal.signum() <= 0) return@forEach
                when (entry.jenis.lowercase()) {
                    "out" -> borrowed += entry.nominal
                    "in" -> repaid += entry.nominal
                }
            }
            val rate = if (borrowed.signum() > 0) {
                repaid.divide(borrowed, MathContext.DECIMAL64).multiply(BigDecimal(100)).toInt().coerceAtMost(100)
            } else {
                null
            }
            return LoanSummary(borrowed, repaid, balance, rate)
        }
    }
}
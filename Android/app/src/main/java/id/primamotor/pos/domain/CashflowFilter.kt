package id.primamotor.pos.domain

import id.primamotor.pos.data.repo.CashflowRow
import id.primamotor.pos.data.repo.MenuRow
import java.math.BigDecimal

/** Filter tab kas dan rekap laporan; tidak menyentuh data, hanya memilih baris. */
object CashflowFilter {

    const val SEMUA = "Semua"
    const val MASUK = "Masuk"
    const val KELUAR = "Keluar"

    fun byMutation(rows: List<CashflowRow>, tab: String): List<CashflowRow> = when (tab) {
        MASUK -> rows.filter { it.mutasi.lowercase() in setOf("in", "masuk") }
        KELUAR -> rows.filter { it.mutasi.lowercase() in setOf("out", "keluar") }
        else -> rows
    }

    fun net(rows: List<CashflowRow>): BigDecimal = rows.fold(BigDecimal.ZERO) { sum, row ->
        val sign = if (row.mutasi.lowercase() in setOf("out", "keluar")) -1 else 1
        sum + row.nominal.abs().multiply(BigDecimal(sign))
    }

    fun unpaid(menus: List<MenuRow>): List<MenuRow> =
        menus.filter { it.status.lowercase() != "lunas" && Settlement.remaining(it.total, it.dibayar).signum() > 0 }

    /** Total per hari (WIB) untuk grafik batang 7 hari terakhir. */
    fun dailyTotals(menus: List<MenuRow>): List<Pair<String, BigDecimal>> =
        menus.groupBy { WibDate.dayOf(it.createdAt)?.toString() ?: "-" }
            .map { (day, rows) -> day to rows.fold(BigDecimal.ZERO) { sum, row -> sum + row.total } }
            .sortedBy { it.first }
            .takeLast(7)
}
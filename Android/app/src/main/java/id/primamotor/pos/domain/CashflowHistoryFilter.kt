package id.primamotor.pos.domain

import id.primamotor.pos.data.repo.CashflowRow

/**
 * Filter tab Histori Kas, cermin kondisi query `fetchCashflow` web:
 * pencarian multi kata, arah mutasi (termasuk transfer masuk), dompet sumber/tujuan,
 * rentang tanggal, dan jenis cashflow.
 */
object CashflowHistoryFilter {

    fun apply(
        rows: List<CashflowRow>,
        search: String,
        mutasi: String,
        accountIds: Set<String> = emptySet(),
        jenis: Set<String> = emptySet(),
        from: String = "",
        to: String = "",
    ): List<CashflowRow> {
        val terms = search.lowercase().trim().split(Regex("\\s+")).filter { it.isNotBlank() }
        return rows.filter { row ->
            val haystack = "${row.id} ${row.note} ${row.person} ${row.jenis}".lowercase()
            if (terms.any { !haystack.contains(it) }) return@filter false

            val lowered = row.mutasi.lowercase()
            val transfer = row.jenis.lowercase().contains("transfer")
            when (mutasi.lowercase()) {
                "masuk" -> {
                    val incoming = lowered == "in" && (accountIds.isEmpty() || row.account1 in accountIds)
                    val transferIn = lowered == "out" && transfer &&
                        (accountIds.isEmpty() || row.account2 in accountIds) && row.account1 !in accountIds
                    if (!incoming && !transferIn) return@filter false
                }
                "keluar" -> {
                    if (lowered != "out") return@filter false
                    if (accountIds.isNotEmpty() && row.account1 !in accountIds) return@filter false
                }
                else -> {
                    if (accountIds.isNotEmpty() && row.account1 !in accountIds && row.account2 !in accountIds) {
                        return@filter false
                    }
                }
            }

            val day = row.createdAt.take(10)
            if (from.isNotBlank() && day < from) return@filter false
            if (to.isNotBlank() && day > to) return@filter false
            if (jenis.isNotEmpty() && row.jenis !in jenis) return@filter false
            true
        }
    }
}

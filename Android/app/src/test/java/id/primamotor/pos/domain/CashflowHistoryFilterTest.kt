package id.primamotor.pos.domain

import id.primamotor.pos.data.repo.CashflowRow
import org.junit.Assert.assertEquals
import org.junit.Test
import java.math.BigDecimal

class CashflowHistoryFilterTest {

    private fun row(
        id: String,
        mutasi: String = "in",
        jenis: String = "penjualan",
        account1: String = "kas",
        account2: String = "",
        note: String = "",
        createdAt: String = "2026-11-27T10:00:00Z",
        nominal: String = "1000",
    ) = CashflowRow(
        id = id,
        account1 = account1,
        account2 = account2,
        nominal = BigDecimal(nominal),
        mutasi = mutasi,
        jenis = jenis,
        note = note,
        person = "",
        createdAt = createdAt,
    )

    @Test
    fun search_matches_all_terms() {
        val rows = listOf(row("a", note = "servis motor"), row("b", note = "beli oli"))
        val result = CashflowHistoryFilter.apply(rows, search = "servis motor", mutasi = "semua")
        assertEquals(listOf("a"), result.map { it.id })
    }

    @Test
    fun transfer_in_counts_as_masuk_for_target_account() {
        val rows = listOf(
            row("t", mutasi = "out", jenis = "transfer", account1 = "bank", account2 = "kas"),
            row("x", mutasi = "out", jenis = "penjualan", account1 = "kas"),
        )
        val result = CashflowHistoryFilter.apply(rows, search = "", mutasi = "masuk", accountIds = setOf("kas"))
        assertEquals(listOf("t"), result.map { it.id })
    }

    @Test
    fun keluar_only_lists_source_account() {
        val rows = listOf(
            row("a", mutasi = "out", account1 = "kas"),
            row("b", mutasi = "out", account1 = "bank"),
        )
        val result = CashflowHistoryFilter.apply(rows, search = "", mutasi = "keluar", accountIds = setOf("kas"))
        assertEquals(listOf("a"), result.map { it.id })
    }

    @Test
    fun date_range_and_jenis_are_inclusive() {
        val rows = listOf(
            row("a", createdAt = "2026-11-26T23:00:00Z", jenis = "penjualan"),
            row("b", createdAt = "2026-11-27T01:00:00Z", jenis = "pembelian"),
        )
        val result = CashflowHistoryFilter.apply(
            rows,
            search = "",
            mutasi = "semua",
            jenis = setOf("pembelian"),
            from = "2026-11-27",
            to = "2026-11-27",
        )
        assertEquals(listOf("b"), result.map { it.id })
    }
}

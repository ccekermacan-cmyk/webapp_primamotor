package id.primamotor.pos.domain

import id.primamotor.pos.data.repo.CashflowRow
import id.primamotor.pos.data.repo.MenuRow
import org.junit.Assert.assertEquals
import org.junit.Test
import java.math.BigDecimal

class CashflowFilterTest {

    private fun cash(id: String, nominal: String, mutasi: String) = CashflowRow(
        id = id,
        account1 = "acc1",
        account2 = "",
        nominal = BigDecimal(nominal),
        mutasi = mutasi,
        jenis = "Penjualan",
        note = "",
        person = "",
        createdAt = "2026-11-27 02:00:00.000Z",
    )

    private fun menu(id: String, total: String, dibayar: String, status: String) = MenuRow(
        id = id,
        person = "umum1",
        payment = "tempo",
        total = BigDecimal(total),
        dibayar = BigDecimal(dibayar),
        status = status,
        cashback = BigDecimal.ZERO,
        note = "",
        operator = "kasir",
        createdAt = "2026-11-27 02:00:00.000Z",
        idLama = "",
    )

    @Test
    fun mutation_tabs_split_in_and_out() {
        val rows = listOf(cash("c1", "1000", "in"), cash("c2", "500", "out"), cash("c3", "200", "masuk"))
        assertEquals(listOf("c1", "c3"), CashflowFilter.byMutation(rows, CashflowFilter.MASUK).map { it.id })
        assertEquals(listOf("c2"), CashflowFilter.byMutation(rows, CashflowFilter.KELUAR).map { it.id })
        assertEquals(3, CashflowFilter.byMutation(rows, CashflowFilter.SEMUA).size)
    }

    @Test
    fun net_subtracts_outgoing() {
        val rows = listOf(cash("c1", "1000", "in"), cash("c2", "500", "out"))
        assertEquals(0, BigDecimal("500").compareTo(CashflowFilter.net(rows)))
    }

    @Test
    fun unpaid_uses_status_and_remaining() {
        val rows = listOf(
            menu("m1", "1000", "400", "belum"),
            menu("m2", "1000", "1000", "lunas"),
            menu("m3", "1000", "0", "belum"),
        )
        assertEquals(listOf("m1", "m3"), CashflowFilter.unpaid(rows).map { it.id })
    }

    @Test
    fun daily_totals_group_by_wib_day() {
        val rows = listOf(menu("m1", "1000", "0", "belum"), menu("m2", "2000", "0", "belum"))
        assertEquals(listOf("2026-11-27" to BigDecimal("3000")), CashflowFilter.dailyTotals(rows))
    }
}
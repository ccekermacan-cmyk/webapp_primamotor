package id.primamotor.pos.domain

import id.primamotor.pos.data.repo.CashflowRow
import id.primamotor.pos.data.repo.MenuRow
import id.primamotor.pos.data.repo.PersonRow
import id.primamotor.pos.data.repo.UserRow
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal
import java.time.LocalDate

class CashflowFeedTest {

    private fun row(
        id: String,
        account1: String = "acc1",
        account2: String = "",
        nominal: String = "10000",
        mutasi: String = "in",
        jenis: String = "penjualan",
        note: String = "",
        persontext: String = "",
        createdAt: String = "2026-11-20T03:00:00.000Z",
        ref: String = "",
        refBaru: String = "",
        saldoAkhir: String? = null,
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
        ref = ref,
        persontext = persontext,
        refBaru = refBaru,
        saldoAkhir = saldoAkhir?.let(::BigDecimal),
    )

    private fun menu(
        id: String,
        tempo: String,
        total: String = "100000",
        dibayar: String = "25000",
        status: String = "belum",
        jenis: String = "pembelian",
    ) = MenuRow(
        id = id,
        person = "",
        payment = "",
        total = BigDecimal(total),
        dibayar = BigDecimal(dibayar),
        status = status,
        cashback = BigDecimal.ZERO,
        note = "",
        operator = "",
        createdAt = "2026-11-01T00:00:00.000Z",
        idLama = id,
        jenis = jenis,
        tempo = tempo,
    )

    @Test
    fun search_isMultiTermOverWebFields() {
        val rows = listOf(
            row("a", note = "servis beat", persontext = "budi"),
            row("b", note = "servis vario", persontext = "siti"),
            row("c", note = "beli oli", jenis = "pembelian"),
        )
        assertEquals(
            listOf("a"),
            CashflowFeed.apply(rows, CashflowFeed.HistoryFilter(search = "servis budi")).map { it.id },
        )
        assertEquals(
            emptyList<String>(),
            CashflowFeed.apply(rows, CashflowFeed.HistoryFilter(search = "servis siti beat")).map { it.id },
        )
    }

    @Test
    fun mutasiMasuk_includesIncomingTransfersOnlyWhenTargeted() {
        val incoming = row("in", account1 = "kas", mutasi = "in")
        val transferIn = row("tr", account1 = "lain", account2 = "kas", mutasi = "out", jenis = "transfer kas")
        val transferElsewhere = row("tx", account1 = "x", account2 = "y", mutasi = "out", jenis = "transfer kas")
        val rows = listOf(incoming, transferIn, transferElsewhere)

        assertEquals(
            setOf("in", "tr"),
            CashflowFeed.apply(
                rows,
                CashflowFeed.HistoryFilter(mutasi = CashflowFeed.MASUK, accountIds = setOf("kas")),
            ).map { it.id }.toSet(),
        )
        // Keluar hanya menghitung akun sumber; transfer ke "y" bukan pengeluaran "y".
        assertEquals(
            emptySet<String>(),
            CashflowFeed.apply(
                rows,
                CashflowFeed.HistoryFilter(mutasi = CashflowFeed.KELUAR, accountIds = setOf("y")),
            ).map { it.id }.toSet(),
        )
    }

    @Test
    fun allMutation_withAccountMatchesSourceOrTarget() {
        val rows = listOf(
            row("a", account1 = "kas"),
            row("b", account1 = "x", account2 = "kas", jenis = "transfer kas"),
            row("c", account1 = "z"),
        )
        assertEquals(
            setOf("a", "b"),
            CashflowFeed.apply(rows, CashflowFeed.HistoryFilter(accountIds = setOf("kas"))).map { it.id }.toSet(),
        )
    }

    @Test
    fun dateRange_usesWibDays() {
        // 2026-11-20T18:00:00Z = 2026-11-21 01:00 WIB
        val late = row("late", createdAt = "2026-11-20T18:00:00.000Z")
        val early = row("early", createdAt = "2026-11-20T03:00:00.000Z")
        val result = CashflowFeed.apply(
            listOf(late, early),
            CashflowFeed.HistoryFilter(from = "2026-11-21", to = "2026-11-21"),
        )
        assertEquals(listOf("late"), result.map { it.id })
    }

    @Test
    fun sorting_isNewestFirstAndGroupedByDate() {
        val rows = listOf(
            row("old", createdAt = "2026-11-19T03:00:00.000Z"),
            row("new", createdAt = "2026-11-21T03:00:00.000Z"),
            row("mid", createdAt = "2026-11-20T03:00:00.000Z"),
        )
        val sorted = CashflowFeed.apply(rows, CashflowFeed.HistoryFilter())
        assertEquals(listOf("new", "mid", "old"), sorted.map { it.id })
        val groups = CashflowFeed.groupByDate(sorted)
        assertEquals(3, groups.size)
        assertTrue(groups.first().first.startsWith("21 "))
    }

    @Test
    fun signsAndCodes_matchWeb() {
        assertEquals("+", CashflowFeed.sign(row("a", mutasi = "in")))
        assertEquals("-", CashflowFeed.sign(row("a", mutasi = "out")))
        assertEquals("↔", CashflowFeed.sign(row("a", mutasi = "out", jenis = "transfer kas")))
        assertEquals("-10000", CashflowFeed.signed(row("a", mutasi = "out")).toPlainString())
        assertEquals("abcdef", CashflowFeed.shortCode(row("0123456789abcdef")))
        assertEquals("12345", CashflowFeed.shortCode(row("12345")))
    }

    @Test
    fun editableBalance_addsPreviousNominalOnSameAccount() {
        val previous = row("a", account1 = "kas", nominal = "40000", mutasi = "out")
        assertEquals(
            0,
            BigDecimal("60000").compareTo(
                CashflowFeed.editableBalance(BigDecimal("20000"), previous, "kas"),
            ),
        )
        assertEquals(
            0,
            BigDecimal("20000").compareTo(
                CashflowFeed.editableBalance(BigDecimal("20000"), previous, "lain"),
            ),
        )
    }

    @Test
    fun wallets_splitBySubtabAndBalance() {
        val accounts = listOf(PersonRow("acc1", "Kas Toko", "", "cashflow account", "cashflow", number1 = BigDecimal("50000")))
        val people = listOf(
            PersonRow("c1", "Budi", "", "customer", "person", number1 = BigDecimal("10000")),
            PersonRow("s1", "Oli Jaya", "", "supplier", "person", number1 = BigDecimal("-5000")),
        )
        val users = listOf(
            UserRow("u1", "Andi", "andi", 7, "Active", number1 = BigDecimal("25000")),
            UserRow("u2", "Nonaktif", "non", 7, "Nonaktif"),
        )
        val wallets = CashflowFeed.wallets(accounts, people, users)
        assertEquals(4, wallets.size)
        assertEquals(CashflowFeed.WalletKind.KAS, wallets.first().kind)
        assertEquals("Budi", wallets.first { it.kind == CashflowFeed.WalletKind.CUSTOMER }.name)
        assertEquals(3, CashflowFeed.positive(wallets).size)
        assertEquals(1, CashflowFeed.nonPositive(wallets).size)
        assertEquals(0, BigDecimal("80000").compareTo(CashflowFeed.subtotal(wallets)))
    }

    @Test
    fun tempo_groupsOverdueFirstAndComputesLabels() {
        val today = LocalDate.parse("2026-11-28")
        val days = CashflowFeed.tempo(
            listOf(
                menu("m1", "2026-11-30"),
                menu("m2", "2026-11-20"),
                menu("m3", "2026-11-28"),
                menu("m4", "2026-11-30", status = "lunas"),
                menu("m5", "2026-12-01", jenis = "penjualan"),
            ),
            today,
        )
        assertEquals(listOf("2026-11-20", "2026-11-28", "2026-11-30"), days.map { it.key })
        assertTrue(days[0].overdue)
        assertFalse(days[1].overdue)
        assertEquals("Lewat 8 Hari", CashflowFeed.dayText("2026-11-20", today))
        assertEquals("Jatuh Tempo Hari Ini", CashflowFeed.dayText("2026-11-28", today))
        assertEquals("Sisa 2 Hari", CashflowFeed.dayText("2026-11-30", today))
        assertEquals(3, CashflowFeed.tempoTotal(days))
    }

    @Test
    fun tempoMetrics_percentAndRemaining() {
        val item = menu("m1", "2026-11-30")
        assertEquals(25, CashflowFeed.progressPercent(item.dibayar, item.total))
        assertEquals(0, BigDecimal("75000").compareTo(CashflowFeed.remaining(item)))
        assertEquals(0, CashflowFeed.progressPercent(BigDecimal.ZERO, BigDecimal.ZERO))
    }

    @Test
    fun accountAndPersonNames_fallBackToStoredText() {
        val wallets = CashflowFeed.wallets(
            listOf(PersonRow("acc1", "Kas Toko", "", "cashflow account", "cashflow")),
            emptyList(),
            emptyList(),
        )
        assertEquals("Kas Toko", CashflowFeed.accountName(wallets.first(), "x"))
        assertEquals("Kode Lama", CashflowFeed.accountName(null, "Kode Lama"))
        assertEquals("Budi", CashflowFeed.personName("", "Budi", wallets))
    }
}

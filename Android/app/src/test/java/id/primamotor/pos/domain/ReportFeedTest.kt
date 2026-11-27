package id.primamotor.pos.domain

import id.primamotor.pos.data.repo.CashflowRow
import id.primamotor.pos.data.repo.MenuRow
import id.primamotor.pos.data.repo.ReportRow
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal

/** Aturan baca halaman `Analitik Laporan` web, diuji tanpa database. */
class ReportFeedTest {

    private fun money(value: String) = BigDecimal(value)

    private fun report(
        id: String,
        createdAt: String,
        text: String = "",
        omsetToko: String = "0",
        omsetServis: String = "0",
        omsetMinuman: String = "0",
        laba: String = "0",
        operasional: String = "0",
        pengeluaranLain: String = "0",
        pemasukanLain: String = "0",
        piutang: String = "0",
        hutang: String = "0",
        kasir: String = "0",
    ) = ReportRow(
        id = id,
        text = text,
        createdAt = createdAt,
        omsetToko = money(omsetToko),
        omsetServis = money(omsetServis),
        omsetMinuman = money(omsetMinuman),
        labaPenjualan = money(laba),
        labaService = BigDecimal.ZERO,
        labaMinuman = BigDecimal.ZERO,
        operasionalToko = money(operasional),
        pengeluaranLain = money(pengeluaranLain),
        pemasukanLain = money(pemasukanLain),
        piutang = money(piutang),
        hutang = money(hutang),
        kasirToko = money(kasir),
    )

    private fun menu(
        id: String,
        createdAt: String,
        jenis: String = "Penjualan",
        status: String = "lunas",
        total: String = "0",
        dibayar: String = "0",
        qty: String = "1",
        admin: String = "0",
        cashback: String = "0",
        personBaru: String = "",
        note: String = "",
    ) = MenuRow(
        id = id,
        person = "",
        payment = "Tunai",
        total = money(total),
        dibayar = money(dibayar),
        status = status,
        cashback = money(cashback),
        note = note,
        operator = "kasir",
        createdAt = createdAt,
        idLama = id,
        jenis = jenis,
        qty = money(qty),
        admin = money(admin),
        personBaru = personBaru,
    )

    private fun cash(
        id: String,
        createdAt: String,
        jenis: String = "Penjualan",
        mutasi: String = "in",
        nominal: String = "0",
        acc1: String = "Kas",
        acc2: String = "",
    ) = CashflowRow(
        id = id,
        account1 = acc1,
        account2 = acc2,
        nominal = money(nominal),
        mutasi = mutasi,
        jenis = jenis,
        note = "catatan",
        person = "",
        createdAt = createdAt,
        acc1 = acc1,
        acc2 = acc2,
    )

    @Test
    fun filterRows_matchesTextIdAndInclusiveDates() {
        val rows = listOf(
            report("r1", "2026-11-20T00:00:00.000Z", text = "Laporan Senin"),
            report("r2", "2026-11-21T00:00:00.000Z", text = "Laporan Selasa"),
            report("r3", "2026-11-23T00:00:00.000Z", text = "Laporan Kamis"),
        )
        assertEquals(listOf("r1"), ReportFeed.filterRows(rows, "senin", "", "").map { it.id })
        assertEquals(listOf("r3"), ReportFeed.filterRows(rows, "r3", "", "").map { it.id })
        assertEquals(
            listOf("r1", "r2"),
            ReportFeed.filterRows(rows, "", "2026-11-20", "2026-11-21").map { it.id },
        )
        assertEquals(listOf("r2", "r3"), ReportFeed.filterRows(rows, "", "2026-11-21", "").map { it.id })
    }

    @Test
    fun summary_matchesWebKpiAndInsight() {
        val rows = listOf(
            report("r1", "2026-11-20T00:00:00.000Z", omsetToko = "1000", omsetServis = "500", laba = "1000", operasional = "1200", pemasukanLain = "1000", piutang = "25"),
            report("r2", "2026-11-21T00:00:00.000Z", omsetMinuman = "200", laba = "100", pengeluaranLain = "50", pemasukanLain = "10"),
        )
        val summary = ReportFeed.summary(rows)
        assertEquals(money("1700"), summary.totalOmset)
        assertEquals(money("1100"), summary.totalLaba)
        assertEquals(money("1250"), summary.totalPengeluaran)
        assertEquals(money("860"), summary.labaBersih)
        assertEquals("Penjualan Toko", summary.penyumbangTerbesar)
        assertTrue(summary.insight.contains("positif (menguntungkan)"))
        assertTrue(summary.insight.contains("Rp 860"))
        assertTrue(summary.insight.contains("sektor Penjualan Toko"))
        assertTrue(summary.insight.contains("lebih tinggi dari laba penjualan kotor"))
    }

    @Test
    fun summary_emptyUsesWebDefaultInsight() {
        val summary = ReportFeed.summary(emptyList())
        assertEquals("Belum ada data cukup untuk dianalisa.", summary.insight)
        assertEquals(BigDecimal.ZERO, summary.labaBersih)
    }

    @Test
    fun chartPoints_followsReversedPageOrder() {
        val rows = listOf(
            report("r1", "2026-11-21T00:00:00.000Z", omsetToko = "300"),
            report("r2", "2026-11-20T00:00:00.000Z", omsetToko = "100"),
        )
        val points = ReportFeed.chartPoints(rows)
        assertEquals(listOf("20", "21"), points.map { it.tanggal })
        assertEquals(money("100"), points.first().omset)
    }

    @Test
    fun menuLines_filtersStatusJenisAndSorts() {
        val rows = listOf(
            menu("m1", "2026-11-20T01:00:00.000Z", jenis = "Penjualan", total = "100", dibayar = "40", status = "belum", personBaru = "Budi"),
            menu("m2", "2026-11-20T02:00:00.000Z", jenis = "Pembelian", total = "200", dibayar = "50", status = "belum"),
            menu("m3", "2026-11-20T03:00:00.000Z", jenis = "Service", total = "300", dibayar = "300", status = "lunas"),
            menu("m4", "2026-11-19T03:00:00.000Z", jenis = "Penjualan", total = "400"),
        )
        val belum = ReportFeed.menuLines(rows, "2026-11-20", "", "belum", setOf("semua"), "created_at", false)
        assertEquals(listOf("m2", "m1"), belum.map { it.id })
        val onlyService = ReportFeed.menuLines(rows, "2026-11-20", "", "semua", setOf("Service"), "created_at", true)
        assertEquals(listOf("m3"), onlyService.map { it.id })
        val search = ReportFeed.menuLines(rows, "2026-11-20", "budi", "semua", setOf("semua"), "total", true)
        assertEquals(listOf("m1"), search.map { it.id })
        assertEquals(listOf("Penjualan", "Pembelian", "Service"), ReportFeed.menuJenis(rows, "2026-11-20", "", "semua"))
    }

    @Test
    fun menuStats_separatesPiutangAndHutang() {
        val rows = listOf(
            menu("m1", "2026-11-20T01:00:00.000Z", jenis = "Penjualan", total = "100", dibayar = "40", status = "belum", qty = "2", admin = "5"),
            menu("m2", "2026-11-20T02:00:00.000Z", jenis = "Pembelian", total = "200", dibayar = "50", status = "belum", qty = "3"),
        )
        val stats = ReportFeed.menuStats(rows)
        assertEquals(2, stats.count)
        assertEquals(money("5"), stats.qty)
        assertEquals(money("300"), stats.total)
        assertEquals(money("90"), stats.dibayar)
        assertEquals(money("5"), stats.admin)
        assertEquals(money("60"), stats.piutang)
        assertEquals(money("150"), stats.hutang)
    }

    private fun log(
        id: String,
        createdAt: String,
        direction: String = "out",
        qty: String = "2",
        price1: String = "100",
        price2: String = "150",
        refBaru: String = "m1",
        note: String = "",
    ) = ReportLog(
        id = id,
        createdAt = createdAt,
        operator = "kasir",
        direction = direction,
        item = "PRD-1",
        itemBaru = "produk1",
        person = "",
        qty = money(qty),
        price1 = money(price1),
        price2 = money(price2),
        ref = "",
        refBaru = refBaru,
        note = note,
    )

    @Test
    fun logLines_searchesProductsAndFiltersDirection() {
        val rows = listOf(
            log("l1", "2026-11-20T01:00:00.000Z"),
            log("l2", "2026-11-20T02:00:00.000Z", direction = "in", note = "restock"),
            log("l3", "2026-11-19T02:00:00.000Z"),
        )
        val names = mapOf("produk1" to "Oli Mesin")
        val all = ReportFeed.logLines(rows, "2026-11-20", "", names, "", "semua", "created_at", true)
        assertEquals(listOf("l1", "l2"), all.map { it.id })
        assertEquals("Oli Mesin", all.first().productName)
        val masuk = ReportFeed.logLines(rows, "2026-11-20", "restock", names, "", "in", "created_at", false)
        assertEquals(listOf("l2"), masuk.map { it.id })
        val ref = ReportFeed.logLines(rows, "2026-11-20", "", names, "m1", "out", "created_at", false)
        assertEquals(listOf("l1"), ref.map { it.id })
    }

    @Test
    fun logStats_excludesPembelianRusakOpnameFromLaba() {
        val menus = listOf(
            menu("m1", "2026-11-20T01:00:00.000Z", jenis = "Penjualan"),
            menu("m2", "2026-11-20T02:00:00.000Z", jenis = "Pembelian"),
            menu("m3", "2026-11-20T03:00:00.000Z", jenis = "Barang Rusak"),
        )
        val rows = listOf(
            log("l1", "2026-11-20T01:00:00.000Z", refBaru = "m1", qty = "2", price1 = "100", price2 = "150"),
            log("l2", "2026-11-20T02:00:00.000Z", refBaru = "m2", qty = "1", price1 = "100", price2 = "100"),
            log("l3", "2026-11-20T03:00:00.000Z", refBaru = "m3", qty = "1", price1 = "100", price2 = "100"),
            log("l4", "2026-11-20T04:00:00.000Z", direction = "in", refBaru = "m1", qty = "5", price1 = "0", price2 = "0"),
        )
        val stats = ReportFeed.logStats(rows, menus)
        assertEquals(4, stats.movements)
        assertEquals(money("5"), stats.qtyIn)
        assertEquals(money("4"), stats.qtyOut)
        assertEquals(money("400"), stats.penjualan)
        assertEquals(money("50"), stats.laba)
    }

    @Test
    fun cashLines_filtersMutasiAccountJenisAndSums() {
        val rows = listOf(
            cash("c1", "2026-11-20T01:00:00.000Z", jenis = "Penjualan", mutasi = "in", nominal = "500"),
            cash("c2", "2026-11-20T02:00:00.000Z", jenis = "Operasional", mutasi = "out", nominal = "200", acc1 = "Bank"),
            cash("c3", "2026-11-19T02:00:00.000Z", nominal = "999"),
        )
        val filtered = ReportFeed.cashLines(rows, "2026-11-20", "", "semua", "semua", "semua", "nominal", true)
        assertEquals(listOf("c2", "c1"), filtered.map { it.id })
        assertEquals(listOf("Bank", "Kas"), ReportFeed.cashAccounts(rows, "2026-11-20", "semua", "semua").sorted())
        assertEquals(listOf("Operasional"), ReportFeed.cashJenis(rows, "2026-11-20", "Bank", "semua"))
        val stats = ReportFeed.cashStats(filtered)
        assertEquals(2, stats.count)
        assertEquals(money("500"), stats.masuk)
        assertEquals(money("200"), stats.keluar)
        assertEquals(money("300"), stats.nett)
    }

    @Test
    fun ongkosLines_filtersDateAndGroupsPerMekanik() {
        val rows = listOf(
            ReportOngkos("o1", "ONG-1", "Joko", "kasir", "ref", "m1", "2026-11-20T00:00:00.000Z", money("100")),
            ReportOngkos("o2", "ONG-2", "Joko", "kasir", "ref", "m2", "2026-11-20T00:00:00.000Z", money("50")),
            ReportOngkos("o3", "ONG-3", "", "kasir", "ref", "m3", "2026-11-21T00:00:00.000Z", money("70")),
        )
        val lines = ReportFeed.ongkosLines(rows, "2026-11-20", "")
        assertEquals(listOf("o1", "o2"), lines.map { it.id })
        val stats = ReportFeed.ongkosStats(lines)
        assertEquals(2, stats.count)
        assertEquals(money("150"), stats.total)
        assertEquals(listOf("Joko" to money("150")), stats.perMekanik)
    }

    @Test
    fun formattingMatchesWebLabels() {
        assertEquals("20 Nov 2026", ReportFeed.formatDate("2026-11-20T00:00:00.000Z"))
        assertEquals("19 Nov 2026", ReportFeed.formatDate("2026-11-19T10:00:00.000Z"))
        assertEquals("07.00", ReportFeed.timeLabel("2026-11-20T00:00:00.000Z"))
        assertEquals("-", ReportFeed.formatDate(""))
        assertEquals("", ReportFeed.dayOf(""))
    }

    @Test
    fun pagingMirrorsPerPage31() {
        assertEquals(1, ReportFeed.pagesOf(31, 31))
        assertEquals(1, ReportFeed.pagesOf(0, 31))
        assertEquals(listOf(3, 4), ReportFeed.pageOf(listOf(1, 2, 3, 4), 2, 2))
        assertFalse(ReportFeed.filterRows(emptyList(), "x", "", "").isNotEmpty())
    }
}

package id.primamotor.pos.domain

import id.primamotor.pos.data.repo.MenuRow
import id.primamotor.pos.data.repo.PersonRow
import id.primamotor.pos.data.repo.Produk
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal

class PosFeedTest {

    private fun product(
        id: String,
        nama: String = "Oli",
        stok: String = "5",
        kategori: String = "Oli",
        idLama: String = "",
    ) = Produk(
        id = id,
        nama = nama,
        idLama = idLama,
        kategori = kategori,
        merk = "",
        jenis = "",
        varian = "",
        tipe = "",
        unit = "Pcs",
        barcode = "",
        keterangan = "",
        stok = BigDecimal(stok),
        beli = BigDecimal("1"),
        sell1 = BigDecimal("1"),
        sell2 = BigDecimal("1"),
        sell3 = BigDecimal("1"),
        sell4 = BigDecimal("1"),
        sell5 = BigDecimal("1"),
        sell6 = BigDecimal("1"),
        min1 = BigDecimal.ZERO,
        min2 = BigDecimal.ZERO,
        min3 = BigDecimal.ZERO,
    )

    private fun menu(
        id: String,
        jenis: String = "Penjualan",
        person: String = "umum1",
        status: String = "lunas",
        text: String = "",
        operator: String = "",
        createdAt: String = "2026-11-27T03:00:00.000Z",
        total: String = "100",
        dibayar: String = "100",
    ) = MenuRow(
        id = id,
        person = person,
        payment = "cash",
        total = BigDecimal(total),
        dibayar = BigDecimal(dibayar),
        status = status,
        cashback = BigDecimal.ZERO,
        note = "",
        operator = operator,
        createdAt = createdAt,
        idLama = "",
        jenis = jenis,
        text = text,
    )

    private val umum = PersonRow(
        id = "p-umum",
        nama = "Umum1",
        keterangan = "",
        jenis = "customer",
        kategori = "person",
        idLama = "2000",
    )

    private val budi = PersonRow(
        id = "p-budi",
        nama = "Budi",
        keterangan = "0812",
        jenis = "customer",
        kategori = "person",
        idLama = "2001",
    )

    @Test
    fun pageSize_followsWebBreakpoints() {
        assertEquals(6, PosFeed.pageSize(360))
        assertEquals(6, PosFeed.pageSize(599))
        assertEquals(9, PosFeed.pageSize(600))
        assertEquals(9, PosFeed.pageSize(839))
        assertEquals(12, PosFeed.pageSize(840))
    }

    @Test
    fun displayCode_padsDigits() {
        assertEquals("N/A", PosFeed.displayCode(""))
        assertEquals("00123", PosFeed.displayCode("123"))
        assertEquals("AB-1", PosFeed.displayCode("AB-1"))
    }

    @Test
    fun history_filtersStatusPersonAndJenis() {
        val rows = listOf(
            menu("a", status = "lunas"),
            menu("b", status = "belum", person = "2001"),
            menu("c", jenis = "Service", person = "2000", status = "belum"),
        )
        val persons = listOf(umum, budi)

        assertEquals(
            listOf("a"),
            PosFeed.history(rows, PosFeed.HistoryFilter(status = "lunas"), persons).map { it.id },
        )
        assertEquals(
            listOf("b"),
            PosFeed.history(
                rows,
                PosFeed.HistoryFilter(personId = "2001"),
                persons,
            ).map { it.id },
        )
        assertEquals(
            listOf("c"),
            PosFeed.history(
                rows,
                PosFeed.HistoryFilter(jenis = setOf("service")),
                persons,
            ).map { it.id },
        )
    }

    @Test
    fun history_level10_onlyOwnServiceRows() {
        val rows = listOf(
            menu("a", jenis = "Service", operator = "joko", text = "Servis Budi"),
            menu("b", jenis = "Service", operator = "andi", text = "Servis Andi"),
            menu("c", jenis = "Penjualan", operator = "joko", text = "Servis"),
        )
        val result = PosFeed.history(
            rows,
            PosFeed.HistoryFilter(level = 10, username = "joko", status = "lunas"),
            listOf(umum, budi),
        )
        assertEquals(listOf("a"), result.map { it.id })
    }

    @Test
    fun history_multiTermIsAnd() {
        val rows = listOf(
            menu("a", text = "Ganti oli mesin", operator = "joko"),
            menu("b", text = "Ganti oli", operator = "andi"),
        )
        val result = PosFeed.history(
            rows,
            PosFeed.HistoryFilter(query = "oli joko"),
            emptyList(),
        )
        assertEquals(listOf("a"), result.map { it.id })
    }

    @Test
    fun history_matchesSubCollectionRefs() {
        val rows = listOf(menu("a"), menu("b"))
        val result = PosFeed.history(
            rows,
            PosFeed.HistoryFilter(query = "kampas", subRefs = setOf("b")),
            emptyList(),
        )
        assertEquals(listOf("b"), result.map { it.id })
    }

    @Test
    fun groupByDate_labelsAndKeepsNewestFirst() {
        val rows = listOf(
            menu("a", createdAt = "2026-11-27T03:00:00.000Z"),
            menu("b", createdAt = "2026-11-26T03:00:00.000Z"),
            menu("c", createdAt = "2026-11-27T05:00:00.000Z"),
        )
        val groups = PosFeed.groupByDate(rows)
        assertEquals(listOf("27/11/2026", "26/11/2026"), groups.map { it.label })
        assertEquals(2, groups.first().rows.size)
    }

    @Test
    fun products_hidesEmptyStockUnlessPurchaseLikeMenu() {
        val all = listOf(product("1", stok = "0"), product("2", stok = "3"))
        assertEquals(listOf("2"), PosFeed.products(all, "Penjualan", "").map { it.id })
        assertTrue(PosFeed.products(all, "Pembelian", "").any { it.id == "1" })
        assertTrue(PosFeed.products(all, "Barang Rusak", "").any { it.id == "1" })
        assertTrue(PosFeed.products(all, "Stok Opname", "").any { it.id == "1" })
    }

    @Test
    fun products_multiTermSearchesAllFields() {
        val all = listOf(
            product("1", nama = "Kampas Rem", kategori = "Kampas"),
            product("2", nama = "Oli Mesin", kategori = "Oli"),
        )
        assertEquals(listOf("1"), PosFeed.products(all, "Penjualan", "kampas rem").map { it.id })
        assertEquals(emptyList<String>(), PosFeed.products(all, "Penjualan", "oli kampas").map { it.id })
    }

    @Test
    fun slice_clampsPageAndReportsTotalPages() {
        val rows = (1..7).map { menu(it.toString()) }
        val (pageRows, pages) = PosFeed.slice(rows, page = 2, perPage = 3)
        assertEquals(3, pages)
        assertEquals(listOf("4", "5", "6"), pageRows.map { it.id })

        val (clamped, _) = PosFeed.slice(rows, page = 99, perPage = 3)
        assertEquals(listOf("7"), clamped.map { it.id })
    }

    @Test
    fun personLabel_usesNameAndDescription() {
        assertEquals("Budi - 0812", PosFeed.personLabel("2001", listOf(umum, budi)))
        assertEquals("Umum", PosFeed.personLabel("", listOf(umum, budi)))
    }
}

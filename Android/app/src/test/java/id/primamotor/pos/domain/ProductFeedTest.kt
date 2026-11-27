package id.primamotor.pos.domain

import id.primamotor.pos.data.repo.Produk
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal

class ProductFeedTest {

    private fun product(
        id: String,
        idLama: String = "1",
        kategori: String = "Oli",
        merk: String = "Shell",
        jenis: String = "Mesin",
        varian: String = "",
        keterangan: String = "",
        tipe: String = "Beat",
        stok: String = "5",
        stok2: String = "2",
        beli: String = "1000",
        sell6: String = "1500",
    ) = Produk(
        id = id,
        nama = "nama-$id",
        idLama = idLama,
        kategori = kategori,
        merk = merk,
        jenis = jenis,
        varian = varian,
        tipe = tipe,
        unit = "pcs",
        barcode = "",
        keterangan = keterangan,
        stok = BigDecimal(stok),
        beli = BigDecimal(beli),
        sell1 = BigDecimal.ZERO,
        sell2 = BigDecimal.ZERO,
        sell3 = BigDecimal.ZERO,
        sell4 = BigDecimal.ZERO,
        sell5 = BigDecimal.ZERO,
        sell6 = BigDecimal(sell6),
        min1 = BigDecimal.ZERO,
        min2 = BigDecimal.ZERO,
        min3 = BigDecimal.ZERO,
        stok2 = BigDecimal(stok2),
    )

    @Test
    fun pageSize_followsWebBreakpoints() {
        assertEquals(12, ProductFeed.pageSize(360))
        assertEquals(18, ProductFeed.pageSize(640))
        assertEquals(30, ProductFeed.pageSize(1024))
        assertEquals(36, ProductFeed.pageSize(1280))
        assertEquals(36, ProductFeed.pageSize(1600))
    }

    @Test
    fun codeFormatting_matchesWeb() {
        assertEquals("N/A", ProductFeed.displayCode(null))
        assertEquals("00123", ProductFeed.displayCode("123"))
        assertEquals("AB-1", ProductFeed.displayCode("AB-1"))
        assertEquals("123", ProductFeed.normalizeCode("000123"))
        assertEquals("0", ProductFeed.normalizeCode("000"))
    }

    @Test
    fun fullName_joinsWebFields() {
        assertEquals("Oli Shell Mesin Beat", ProductFeed.fullName(product("a")))
        assertEquals(
            "Oli Shell Mesin Varian Ket Beat",
            ProductFeed.fullName(product("a", varian = "Varian", keterangan = "Ket")),
        )
    }

    @Test
    fun margin_usesWebFormulas() {
        val p = product("a", beli = "1000", sell6 = "1500")
        assertEquals(33, ProductFeed.retailMargin(p))
        assertEquals("50.0%", ProductFeed.tierMargin(BigDecimal("1000"), BigDecimal("1500")))
        assertNull(ProductFeed.tierMargin(BigDecimal.ZERO, BigDecimal("1500")))
        assertNull(ProductFeed.retailMargin(product("b", beli = "0")))
    }

    @Test
    fun stokFilter_menipisAndHabis() {
        val all = listOf(
            product("a", stok = "0"),
            product("b", stok = "2", stok2 = "2"),
            product("c", stok = "3", stok2 = "2"),
        )
        assertEquals(
            listOf("a"),
            ProductFeed.apply(all, ProductFeed.Filter(stok = "habis")).map { it.id },
        )
        assertEquals(
            listOf("b"),
            ProductFeed.apply(all, ProductFeed.Filter(stok = "menipis")).map { it.id },
        )
    }

    @Test
    fun kategoriFilter_isExactMatch() {
        val all = listOf(product("a", kategori = "Oli"), product("b", kategori = "Oli Mesin"))
        assertEquals(
            listOf("a"),
            ProductFeed.apply(all, ProductFeed.Filter(kategori = "Oli")).map { it.id },
        )
    }

    @Test
    fun search_isMultiTermAndAcrossWebFields() {
        val all = listOf(
            product("a", kategori = "Oli", merk = "Shell", tipe = "Beat"),
            product("b", kategori = "Oli", merk = "Yamalube", tipe = "Beat"),
            product("c", kategori = "Kampas", merk = "Shell", tipe = "Vario"),
        )
        assertEquals(
            listOf("a"),
            ProductFeed.apply(all, ProductFeed.Filter(query = "oli shell")).map { it.id },
        )
        assertEquals(
            emptyList<String>(),
            ProductFeed.apply(all, ProductFeed.Filter(query = "oli vario")).map { it.id },
        )
        assertEquals(
            listOf("b"),
            ProductFeed.apply(all, ProductFeed.Filter(query = "yamalube beat")).map { it.id },
        )
    }

    @Test
    fun search_numericTermMatchesUnpaddedCode() {
        val all = listOf(product("a", idLama = "00042"), product("b", idLama = "00099"))
        assertEquals(
            listOf("a"),
            ProductFeed.apply(all, ProductFeed.Filter(query = "42")).map { it.id },
        )
    }

    @Test
    fun sort_byCodeIsNumericAndTieBreaksById() {
        val all = listOf(
            product("a", idLama = "10"),
            product("b", idLama = "9"),
            product("c", idLama = "9"),
        )
        assertEquals(
            listOf("b", "c", "a"),
            ProductFeed.apply(all, ProductFeed.Filter()).map { it.id },
        )
        assertEquals(
            listOf("a", "b", "c"),
            ProductFeed.apply(all, ProductFeed.Filter(ascending = false)).map { it.id },
        )
    }

    @Test
    fun slice_clampsAndReportsPages() {
        val rows = (1..7).map { product(it.toString(), idLama = it.toString()) }
        val (page, pages) = ProductFeed.slice(rows, 2, 3)
        assertEquals(3, pages)
        assertEquals(listOf("4", "5", "6"), page.map { it.id })
        assertEquals(listOf("7"), ProductFeed.slice(rows, 99, 3).first.map { it.id })
    }

    @Test
    fun related_requiresSameKategoriAndSharesFields() {
        val target = product("t", kategori = "Oli", merk = "Shell", jenis = "Mesin", tipe = "Beat")
        val close = product("a", kategori = "Oli", merk = "Shell", jenis = "Mesin", tipe = "Beat")
        val otherKategori = product("b", kategori = "Kampas", merk = "Shell", jenis = "Mesin", tipe = "Beat")
        val noMatch = product("c", kategori = "Oli", merk = "X", jenis = "Gardan", tipe = "Vario")
        val related = ProductFeed.related(listOf(target, close, otherKategori, noMatch), target)
        assertTrue(related.any { it.id == "a" })
        assertTrue(related.none { it.id == "t" })
        assertTrue(related.none { it.id == "b" })
    }
}

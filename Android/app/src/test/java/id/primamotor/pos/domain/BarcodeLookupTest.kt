package id.primamotor.pos.domain

import id.primamotor.pos.data.repo.Produk
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.math.BigDecimal

class BarcodeLookupTest {

    private fun product(id: String, barcode: String, idLama: String = "L-$id") = Produk(
        id = id,
        nama = "Produk $id",
        idLama = idLama,
        kategori = "",
        merk = "",
        varian = "",
        tipe = "",
        unit = "",
        barcode = barcode,
        stok = BigDecimal.ONE,
        beli = BigDecimal.ONE,
        sell1 = BigDecimal.ONE,
        sell2 = BigDecimal.ONE,
        sell3 = BigDecimal.ONE,
        min1 = BigDecimal.ZERO,
    )

    @Test
    fun barcode_match_wins() {
        val products = listOf(product("p1", "899"), product("p2", "888"))
        assertEquals("p1", BarcodeLookup.find(" 899 ", products)?.id)
    }

    @Test
    fun falls_back_to_id_lama() {
        val products = listOf(product("p1", "", idLama = "A-1"))
        assertEquals("p1", BarcodeLookup.find("a-1", products)?.id)
    }

    @Test
    fun unknown_or_blank_returns_null() {
        val products = listOf(product("p1", "899"))
        assertNull(BarcodeLookup.find("123", products))
        assertNull(BarcodeLookup.find("   ", products))
        assertNull(BarcodeLookup.find(null, products))
    }
}
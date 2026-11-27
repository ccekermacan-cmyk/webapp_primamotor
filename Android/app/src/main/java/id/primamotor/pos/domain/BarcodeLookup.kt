package id.primamotor.pos.domain

import id.primamotor.pos.data.repo.Produk

/** Urutan pencarian barcode sama dengan web: `barcode` dulu, lalu `id_lama`. */
object BarcodeLookup {
    fun find(code: String?, products: List<Produk>): Produk? {
        val needle = code?.trim()?.lowercase().orEmpty()
        if (needle.isEmpty()) return null
        return products.firstOrNull { it.barcode.lowercase() == needle }
            ?: products.firstOrNull { it.idLama.lowercase() == needle }
    }
}
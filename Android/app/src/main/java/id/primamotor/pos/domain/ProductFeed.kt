package id.primamotor.pos.domain

import id.primamotor.pos.data.repo.Produk
import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Isi halaman Produk, cermin `pages/produk.tsx` web: pencarian multi kata,
 * filter kategori/stok, urutan kolom, paginasi per breakpoint, dan produk terkait.
 * Semua berjalan lokal di cache Room; server tetap penentu akhir saat push.
 */
object ProductFeed {

    /** Web: lebar <640→2 kolom, <768→3, <1024→4, <1280→5, else 6; perPage = kolom × 6. */
    fun pageSize(widthDp: Int): Int {
        val cols = when {
            widthDp < 640 -> 2
            widthDp < 768 -> 3
            widthDp < 1024 -> 4
            widthDp < 1280 -> 5
            else -> 6
        }
        return cols * 6
    }

    /** Cermin `displayProductCode`: kode angka dipad ke 5 digit, kosong = `N/A`. */
    fun displayCode(raw: String?): String {
        val code = raw.orEmpty().trim()
        if (code.isEmpty()) return "N/A"
        return if (code.all { it.isDigit() }) code.padStart(5, '0') else code
    }

    /** Cermin `normalizeProductCode`: kode angka tanpa nol di depan. */
    fun normalizeCode(raw: String): String {
        val code = raw.trim()
        return if (code.all { it.isDigit() } && code.isNotEmpty()) code.trimStart('0').ifBlank { "0" } else code
    }

    /** Cermin nama produk web: `kategori merk jenis varian keterangan tipe`. */
    fun fullName(product: Produk): String =
        listOf(
            product.kategori, product.merk, product.jenis,
            product.varian, product.keterangan, product.tipe,
        ).filter { it.isNotBlank() }.joinToString(" ").trim().ifBlank { product.nama.ifBlank { "-" } }

    fun isMenipis(product: Produk): Boolean =
        product.stok.signum() > 0 && product.stok <= product.stok2

    fun isHabis(product: Produk): Boolean = product.stok.signum() <= 0

    /** Persen di kartu: `Math.round((1 - beli / sell_6) * 100)`. */
    fun retailMargin(product: Produk): Int? {
        if (product.beli.signum() <= 0 || product.sell6.signum() <= 0) return null
        val ratio = product.beli.multiply(BigDecimal(100))
            .divide(product.sell6, 6, RoundingMode.HALF_UP)
        return 100 - ratio.setScale(0, RoundingMode.HALF_UP).toInt()
    }

    /** Persen di tabel harga: `((sell - beli) / beli * 100)` satu desimal. */
    fun tierMargin(beli: BigDecimal, sell: BigDecimal): String? {
        if (beli.signum() <= 0 || sell.signum() <= 0) return null
        val percent = sell.subtract(beli).multiply(BigDecimal(100))
            .divide(beli, 1, RoundingMode.HALF_UP)
        return "$percent%"
    }

    data class Filter(
        val query: String = "",
        val kategori: String = "all",
        val stok: String = "all",
        val sort: String = "id_lama",
        val ascending: Boolean = true,
    )

    /** Filter produk web. Pencarian: semua kata harus cocok (AND). */
    fun apply(all: List<Produk>, filter: Filter): List<Produk> {
        val terms = terms(filter.query)
        return all
            .filter { product -> filter.kategori == "all" || product.kategori == filter.kategori }
            .filter { product ->
                when (filter.stok) {
                    "menipis" -> isMenipis(product)
                    "habis" -> isHabis(product)
                    else -> true
                }
            }
            .filter { product -> terms.all { term -> matches(product, term) } }
            .let { sorted(it, filter.sort, filter.ascending) }
    }

    private fun terms(query: String): List<String> =
        query.trim().lowercase().split(Regex("\\s+")).filter { it.isNotBlank() }

    private fun matches(product: Produk, term: String): Boolean {
        val fields = listOf(
            product.idLama, product.kategori, product.merk, product.jenis,
            product.varian, product.keterangan, product.tipe,
        )
        if (fields.any { it.lowercase().contains(term) }) return true
        // Web: kata angka juga cocok dengan `id_lama` tanpa nol di depan.
        return term.toLongOrNull() != null && normalizeCode(product.idLama) == normalizeCode(term)
    }

    private fun sorted(rows: List<Produk>, field: String, ascending: Boolean): List<Produk> {
        val comparator: Comparator<Produk> = when (field) {
            "nama" -> compareBy(
                { it.kategori.lowercase() },
                { it.merk.lowercase() },
                { it.jenis.lowercase() },
                { it.varian.lowercase() },
                { it.keterangan.lowercase() },
                { it.tipe.lowercase() },
            )
            "stok" -> compareBy { it.stok }
            "harga_customer" -> compareBy { it.sell5 }
            "harga_retail" -> compareBy { it.sell6 }
            else -> compareBy { codeKey(it) }
        }
        val byId = compareBy<Produk> { it.id }
        return rows.sortedWith((if (ascending) comparator else comparator.reversed()).then(byId))
    }

    /** Angka dibandingkan sebagai angka supaya `9` < `10`, sama seperti sort PocketBase. */
    private fun codeKey(product: Produk): String =
        product.idLama.toLongOrNull()?.toString()?.padStart(20, '0') ?: product.idLama.lowercase()

    fun slice(rows: List<Produk>, page: Int, perPage: Int): Pair<List<Produk>, Int> {
        val pages = if (perPage <= 0) 1 else maxOf(1, (rows.size + perPage - 1) / perPage)
        val current = page.coerceIn(1, pages)
        return rows.drop((current - 1) * perPage).take(perPage) to pages
    }

    /**
     * Produk terkait, cermin `fetchRelatedProducts` web: skor kemiripan tipe/jenis/varian/
     * keterangan, kategori wajib cocok, ambil 5 teratas selain produk itu sendiri.
     */
    fun related(all: List<Produk>, target: Produk, limit: Int = 5): List<Produk> {
        if (target.kategori.isBlank()) return emptyList()
        val kategori = normalize(target.kategori)
        return all.asSequence()
            .filter { it.id != target.id }
            .mapNotNull { candidate ->
                val sameKategori = match(normalize(candidate.kategori), kategori)
                if (sameKategori == null) return@mapNotNull null
                val jenis = match(normalize(candidate.jenis), normalize(target.jenis))
                val varian = match(normalize(candidate.varian), normalize(target.varian))
                val keterangan = match(normalize(candidate.keterangan), normalize(target.keterangan))
                val tipe = match(normalize(candidate.tipe), normalize(target.tipe))
                val merk = match(normalize(candidate.merk), normalize(target.merk))
                val relevant = ((jenis != null || varian != null || keterangan != null || tipe != null) &&
                    sameKategori.exact) || (sameKategori.exact && merk != null)
                if (!relevant) return@mapNotNull null
                var score = 0
                if (tipe != null) score += 20
                if (jenis != null) score += 5
                if (varian != null) score += 4
                if (keterangan != null) score += 3
                if (tipe?.exact == true) score += 5
                if (jenis?.exact == true) score += 2
                if (varian?.exact == true) score += 2
                if (keterangan?.exact == true) score += 2
                if (!sameKategori.exact) score += 1
                candidate to score
            }
            .sortedByDescending { it.second }
            .take(limit)
            .map { it.first }
            .toList()
    }

    private data class Match(val exact: Boolean)

    private fun match(left: String, right: String): Match? {
        if (left.isBlank() || right.isBlank()) return null
        if (left.contains(right) || right.contains(left)) return Match(exact = true)
        val a = left.split(' ').filter { it.length > 2 }
        val b = right.split(' ').filter { it.length > 2 }
        val fuzzy = a.any { x -> b.any { y -> distance(x, y) <= if (maxOf(x.length, y.length) >= 5) 2 else 1 } }
        return if (fuzzy) Match(exact = false) else null
    }

    private fun normalize(value: String): String =
        value.lowercase().replace(Regex("[^a-z0-9]"), "").replace("x", "")

    private fun distance(a: String, b: String): Int {
        var previous = IntArray(b.length + 1) { it }
        for (i in 1..a.length) {
            val current = IntArray(b.length + 1)
            current[0] = i
            for (j in 1..b.length) {
                val cost = if (a[i - 1] == b[j - 1]) 0 else 1
                current[j] = minOf(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost)
            }
            previous = current
        }
        return previous[b.length]
    }
}

package id.primamotor.pos.domain

import id.primamotor.pos.data.repo.MenuRow
import id.primamotor.pos.data.repo.PersonRow
import id.primamotor.pos.data.repo.Produk
import java.time.format.DateTimeFormatter

/**
 * Isi halaman Kasir, cermin `fetchData` + `groupedHistory` di `Frontend/src/pages/pos.tsx`:
 * menu Overview = riwayat nota per tanggal, menu lain = daftar produk.
 * Semua filter berjalan lokal di cache Room; server tetap penentu akhir saat push.
 */
object PosFeed {

    /** Web: 6 item (HP), 9 (tablet), 12 (desktop). */
    fun pageSize(widthDp: Int): Int = when {
        widthDp < 600 -> 6
        widthDp < 840 -> 9
        else -> 12
    }

    data class HistoryFilter(
        val query: String = "",
        val status: String = "all",
        val personId: String = "",
        val jenis: Set<String> = emptySet(),
        val level: Int = 1,
        val username: String = "",
        val fullName: String = "",
        /** Nota yang cocok lewat pencarian `log_stock`/`ongkos` (sub-koleksi web). */
        val subRefs: Set<String> = emptySet(),
    )

    data class DateGroup(val label: String, val rows: List<MenuRow>)

    private val DAY = DateTimeFormatter.ofPattern("dd/MM/yyyy")

    fun isOverview(menu: String): Boolean = menu.equals("Overview", ignoreCase = true)

    /** Cermin `displayProductCode` web: kode angka dipad ke 5 digit. */
    fun displayCode(raw: String?): String {
        val code = raw.orEmpty().trim()
        if (code.isEmpty()) return "N/A"
        return if (code.all { it.isDigit() }) code.padStart(5, '0') else code
    }

    /** Cermin `getFullLabel`: kode - kategori merk jenis keterangan varian tipe. */
    fun productLabel(product: Produk?): String {
        if (product == null) return "Item Tidak Dikenal"
        val name = listOf(
            product.kategori, product.merk, product.jenis,
            product.keterangan, product.varian, product.tipe,
        ).filter { it.isNotBlank() }.joinToString(" ").trim().ifBlank { product.nama.ifBlank { "Item" } }
        val code = displayCode(product.idLama)
        return if (code == "N/A") name else "$code - $name"
    }

    fun isGaji(menu: String): Boolean = menu.lowercase().contains("gaji")

    fun isPembelian(menu: String): Boolean = menu.lowercase().contains("pembelian")

    /** Menu produk yang tetap menampilkan stok kosong, sama seperti `showAllStock` web. */
    fun showsAllStock(menu: String): Boolean {
        val lower = menu.lowercase()
        return lower.contains("pembelian") || lower.contains("rusak") || lower.contains("opname")
    }

    fun personLabel(personId: String?, persons: List<PersonRow>, fallback: String = "Umum"): String {
        if (personId.isNullOrBlank()) return fallback
        val person = persons.firstOrNull { it.idLama == personId || it.id == personId }
            ?: return personId.ifBlank { fallback }
        val name = person.nama.ifBlank { fallback }
        return if (person.keterangan.isBlank()) name else "$name - ${person.keterangan}"
    }

    /** Filter riwayat Overview; level 10 hanya melihat nota service miliknya. */
    fun history(rows: List<MenuRow>, filter: HistoryFilter, persons: List<PersonRow>): List<MenuRow> {
        val terms = terms(filter.query)
        val scoped = if (filter.level == 10) {
            val me = listOf(filter.username, filter.fullName).filter { it.isNotBlank() }.map { it.lowercase() }
            rows.filter { row ->
                row.jenis.contains("service", ignoreCase = true) &&
                    me.any { needle ->
                        row.text.lowercase().contains(needle) ||
                            row.person.lowercase().contains(needle) ||
                            row.operator.lowercase().contains(needle)
                    }
            }
        } else {
            rows.filter { row ->
                val status = filter.status.lowercase()
                val statusOk = status == "all" || status.isBlank() ||
                    row.status.contains(if (status == "lunas") "lunas" else "belum", ignoreCase = true)
                if (!statusOk) return@filter false

                val personOk = filter.personId.isBlank() || personMatches(row, filter.personId, persons)
                if (!personOk) return@filter false

                filter.jenis.isEmpty() || filter.jenis.any { row.jenis.contains(it, ignoreCase = true) }
            }
        }
        return scoped
            .filter { row -> terms.all { term -> matches(row, term, persons, filter.subRefs) } }
            .sortedByDescending { it.createdAt }
    }

    private fun terms(query: String): List<String> =
        query.trim().lowercase().split(Regex("\\s+")).filter { it.isNotBlank() }

    private fun personMatches(row: MenuRow, personId: String, persons: List<PersonRow>): Boolean {
        val person = persons.firstOrNull { it.idLama == personId || it.id == personId }
        if (person == null) return row.person == personId
        return row.person == person.idLama || row.person == person.id ||
            (person.nama.isNotBlank() && row.person.contains(person.nama, ignoreCase = true))
    }

    private fun matches(row: MenuRow, term: String, persons: List<PersonRow>, subRefs: Set<String>): Boolean =
        row.id.lowercase().contains(term) ||
            row.idLama.lowercase().contains(term) ||
            row.jenis.lowercase().contains(term) ||
            row.person.lowercase().contains(term) ||
            row.text.lowercase().contains(term) ||
            row.operator.lowercase().contains(term) ||
            row.marketplace.lowercase().contains(term) ||
            row.payment.lowercase().contains(term) ||
            (subRefs.isNotEmpty() && subRefs.contains(row.id)) ||
            persons.any { person ->
                (person.nama.lowercase().contains(term) || person.keterangan.lowercase().contains(term)) &&
                    (row.person == person.idLama || row.person == person.id)
            }

    fun groupByDate(rows: List<MenuRow>): List<DateGroup> {
        val groups = linkedMapOf<String, MutableList<MenuRow>>()
        rows.forEach { row ->
            val label = WibDate.dayOf(row.createdAt)?.format(DAY) ?: "Tanpa tanggal"
            groups.getOrPut(label) { mutableListOf() } += row
        }
        return groups.map { (label, items) -> DateGroup(label, items) }
    }

    /** Produk untuk menu transaksi: stok kosong disembunyikan kecuali pembelian/rusak/opname. */
    fun products(all: List<Produk>, menu: String, query: String): List<Produk> {
        val terms = terms(query)
        val showAll = showsAllStock(menu)
        return all
            .filter { showAll || it.stok.signum() > 0 }
            .filter { product -> terms.all { term -> productMatches(product, term) } }
            .sortedByDescending { it.id }
    }

    private fun productMatches(product: Produk, term: String): Boolean =
        listOf(
            product.nama, product.idLama, product.kategori, product.merk,
            product.jenis, product.keterangan, product.tipe, product.varian, product.barcode,
        ).any { it.lowercase().contains(term) }

    fun totalPages(count: Int, perPage: Int): Int =
        if (perPage <= 0) 1 else maxOf(1, (count + perPage - 1) / perPage)

    fun <T> slice(rows: List<T>, page: Int, perPage: Int): Pair<List<T>, Int> {
        val pages = totalPages(rows.size, perPage)
        val current = page.coerceIn(1, pages)
        val from = (current - 1) * perPage
        return rows.drop(from).take(perPage) to pages
    }
}

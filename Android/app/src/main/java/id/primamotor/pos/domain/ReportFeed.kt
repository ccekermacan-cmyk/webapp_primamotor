package id.primamotor.pos.domain

import id.primamotor.pos.data.repo.CashflowRow
import id.primamotor.pos.data.repo.MenuRow
import id.primamotor.pos.data.repo.Produk
import id.primamotor.pos.data.repo.ReportRow
import java.math.BigDecimal
import java.time.format.DateTimeFormatter

/** Tab detail laporan, label persis `pages/report.tsx`. */
enum class ReportDetailTab(val label: String) {
    OVERVIEW("\uD83D\uDCCA Overview"),
    MENU("\uD83D\uDCCB Menu"),
    LOG("\uD83D\uDCE6 Log"),
    KAS("\uD83D\uDCB0 Kas"),
    ONGKOS("\uD83D\uDD27 Ongkos"),
}

data class ReportSummary(
    val omsetToko: BigDecimal,
    val omsetServis: BigDecimal,
    val omsetMinuman: BigDecimal,
    val totalOmset: BigDecimal,
    val totalLaba: BigDecimal,
    val totalPengeluaran: BigDecimal,
    val pemasukanLain: BigDecimal,
    val labaBersih: BigDecimal,
    val penyumbangTerbesar: String,
    val insight: String,
) {
    companion object {
        val EMPTY = ReportSummary(
            BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
            BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
            "", "Belum ada data cukup untuk dianalisa.",
        )
    }
}

data class ChartPoint(
    val tanggal: String,
    val omset: BigDecimal,
    val pengeluaran: BigDecimal,
    val laba: BigDecimal,
    val piutang: BigDecimal,
    val hutang: BigDecimal,
)

/** Baris `log_stock` siap tampil di tab Log. */
data class ReportLog(
    val id: String,
    val createdAt: String,
    val operator: String,
    val direction: String,
    val item: String,
    val itemBaru: String,
    val person: String,
    val qty: BigDecimal,
    val price1: BigDecimal,
    val price2: BigDecimal,
    val ref: String,
    val refBaru: String,
    val note: String,
    val productName: String = "",
) {
    val isOut: Boolean get() = direction.equals("out", ignoreCase = true)
    val subJual: BigDecimal get() = price1.multiply(qty)
    val subModal: BigDecimal get() = price2
    val displayName: String get() = productName.ifBlank { itemBaru }
}

/** Baris `ongkos` siap tampil, cermin tab Ongkos web. */
data class ReportOngkos(
    val id: String,
    val idLama: String,
    val person: String,
    val operator: String,
    val ref: String,
    val refBaru: String,
    val date: String,
    val ongkos: BigDecimal,
)

data class MenuStats(
    val count: Int,
    val qty: BigDecimal,
    val total: BigDecimal,
    val dibayar: BigDecimal,
    val admin: BigDecimal,
    val piutang: BigDecimal,
    val hutang: BigDecimal,
)

data class LogStats(
    val movements: Int,
    val qtyIn: BigDecimal,
    val qtyOut: BigDecimal,
    val penjualan: BigDecimal,
    val laba: BigDecimal,
)

data class CashStats(
    val count: Int,
    val masuk: BigDecimal,
    val keluar: BigDecimal,
    val nett: BigDecimal,
)

data class OngkosStats(
    val count: Int,
    val total: BigDecimal,
    val perMekanik: List<Pair<String, BigDecimal>>,
)

/** Aturan baca halaman `Analitik Laporan` web, tanpa akses database supaya mudah dites. */
object ReportFeed {

    fun dayOf(raw: String): String = WibDate.dayOf(raw)?.toString().orEmpty()

    /** `(text ~ q || id ~ q)` + rentang tanggal lokal, seperti query server web. */
    fun filterRows(rows: List<ReportRow>, query: String, from: String, to: String): List<ReportRow> {
        val term = query.trim().lowercase()
        return rows.filter { row ->
            val day = dayOf(row.createdAt)
            (term.isBlank() || row.text.lowercase().contains(term) || row.id.lowercase().contains(term)) &&
                (from.isBlank() || day >= from) &&
                (to.isBlank() || day <= to)
        }
    }

    fun summary(rows: List<ReportRow>): ReportSummary {
        if (rows.isEmpty()) return ReportSummary.EMPTY
        var omsetToko = BigDecimal.ZERO
        var omsetServis = BigDecimal.ZERO
        var omsetMinuman = BigDecimal.ZERO
        var totalLaba = BigDecimal.ZERO
        var totalPengeluaran = BigDecimal.ZERO
        var totalPemasukanLain = BigDecimal.ZERO
        rows.forEach { row ->
            omsetToko += row.omsetToko
            omsetServis += row.omsetServis
            omsetMinuman += row.omsetMinuman
            totalLaba += row.labaKotor
            totalPengeluaran += row.pengeluaran
            totalPemasukanLain += row.pemasukanLain
        }
        val totalOmset = omsetToko + omsetServis + omsetMinuman
        val labaBersih = (totalLaba + totalPemasukanLain) - totalPengeluaran
        val status = if (labaBersih.signum() > 0) "positif (menguntungkan)" else "negatif (merugi)"
        val penyumbang = when {
            maxOf(omsetToko, omsetServis, omsetMinuman) == omsetToko -> "Penjualan Toko"
            maxOf(omsetToko, omsetServis, omsetMinuman) == omsetServis -> "Jasa Servis"
            else -> "Penjualan Minuman"
        }
        val catatan = if (totalPengeluaran > totalLaba) {
            "Perhatian: Total pengeluaran saat ini lebih tinggi dari laba penjualan kotor."
        } else {
            "Pengeluaran operasional masih dalam batas aman di bawah laba kotor."
        }
        val insight = "Berdasarkan data periode ini, performa bisnis menunjukkan tren $status dengan " +
            "estimasi laba bersih mencapai Rp ${Money.formatNumber(labaBersih)}. " +
            "Mayoritas porsi pendapatan didominasi oleh sektor $penyumbang. $catatan"
        return ReportSummary(
            omsetToko = omsetToko,
            omsetServis = omsetServis,
            omsetMinuman = omsetMinuman,
            totalOmset = totalOmset,
            totalLaba = totalLaba,
            totalPengeluaran = totalPengeluaran,
            pemasukanLain = totalPemasukanLain,
            labaBersih = labaBersih,
            penyumbangTerbesar = penyumbang,
            insight = insight,
        )
    }

    /** Web memetakan `[...reports].reverse()`, jadi urutan grafik naik dari halaman aktif. */
    fun chartPoints(rows: List<ReportRow>): List<ChartPoint> = rows.reversed().map { row ->
        ChartPoint(
            tanggal = formatDate(row.createdAt).substringBefore(' '),
            omset = row.omset,
            pengeluaran = row.pengeluaran,
            laba = row.labaKotor,
            piutang = row.piutang,
            hutang = row.hutang,
        )
    }

    fun pagesOf(size: Int, perPage: Int): Int =
        if (size <= 0 || perPage <= 0) 1 else (size + perPage - 1) / perPage

    fun <T> pageOf(rows: List<T>, page: Int, perPage: Int): List<T> {
        val safePage = page.coerceAtLeast(1)
        val from = (safePage - 1) * perPage.coerceAtLeast(1)
        return rows.drop(from).take(perPage.coerceAtLeast(1))
    }

    /** `formatDate` web: `d MMM yyyy`, bulan singkat Indonesia tanpa titik. */
    fun formatDate(raw: String): String {
        if (raw.isBlank()) return "-"
        val day = WibDate.dayOf(raw) ?: return raw
        val months = listOf("Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des")
        return "${day.dayOfMonth} ${months[day.monthValue - 1]} ${day.year}"
    }

    fun timeLabel(raw: String): String {
        val instant = WibDate.parseInstant(raw) ?: return "-"
        return instant.atZone(WibDate.WIB).format(DateTimeFormatter.ofPattern("HH.mm"))
    }

    fun productName(produk: Produk?): String {
        if (produk == null) return ""
        return listOf(produk.kategori, produk.merk, produk.jenis)
            .filter { it.isNotBlank() }
            .joinToString(" ")
            .trim()
    }

    // ---------------------------------------------------------------- Menu tab

    fun menuLines(
        rows: List<MenuRow>,
        day: String,
        query: String,
        status: String,
        jenis: Set<String>,
        sortKey: String,
        asc: Boolean,
    ): List<MenuRow> {
        val term = query.trim().lowercase()
        val filtered = rows.filter { row ->
            dayOf(row.createdAt) == day &&
                (status == "semua" || row.status == status) &&
                (jenis.isEmpty() || jenis.contains("semua") || jenis.contains(row.jenis)) &&
                (term.isBlank() ||
                    row.id.lowercase().contains(term) ||
                    row.operator.lowercase().contains(term) ||
                    row.person.lowercase().contains(term) ||
                    row.personBaru.lowercase().contains(term) ||
                    row.jenis.lowercase().contains(term) ||
                    row.payment.lowercase().contains(term) ||
                    row.marketplace.lowercase().contains(term) ||
                    row.text.lowercase().contains(term) ||
                    row.note.lowercase().contains(term))
        }
        return filtered.sortedWith(menuComparator(sortKey, asc))
    }

    fun menuJenis(rows: List<MenuRow>, day: String, query: String, status: String): List<String> {
        val lines = menuLines(rows, day, query, status, setOf("semua"), "created_at", true)
        return lines.map { it.jenis }.filter { it.isNotBlank() }.distinct()
    }

    fun menuStats(rows: List<MenuRow>): MenuStats = MenuStats(
        count = rows.size,
        qty = rows.fold(BigDecimal.ZERO) { sum, row -> sum + row.qty },
        total = rows.fold(BigDecimal.ZERO) { sum, row -> sum + row.total },
        dibayar = rows.fold(BigDecimal.ZERO) { sum, row -> sum + row.dibayar },
        admin = rows.fold(BigDecimal.ZERO) { sum, row -> sum + row.admin },
        piutang = rows.filter { it.status == "belum" && !it.jenis.equals("Pembelian", ignoreCase = true) }
            .fold(BigDecimal.ZERO) { sum, row -> sum + (row.total - row.dibayar) },
        hutang = rows.filter { it.status == "belum" && it.jenis.equals("Pembelian", ignoreCase = true) }
            .fold(BigDecimal.ZERO) { sum, row -> sum + (row.total - row.dibayar) },
    )

    private fun menuValue(row: MenuRow, key: String): Any = when (key) {
        "qty" -> row.qty
        "admin" -> row.admin
        "cashback" -> row.cashback
        "total" -> row.total
        "dibayar" -> row.dibayar
        "created_at" -> row.createdAt
        "operator" -> row.operator.lowercase()
        "person" -> (row.person.ifBlank { row.personBaru }).lowercase()
        "jenis" -> row.jenis.lowercase()
        "payment" -> row.payment.lowercase()
        "status" -> row.status.lowercase()
        "marketplace" -> row.marketplace.lowercase()
        "note" -> row.note.lowercase()
        else -> row.id.lowercase()
    }

    private fun menuComparator(key: String, asc: Boolean): Comparator<MenuRow> {
        val comparator = Comparator<MenuRow> { a, b ->
            val va = menuValue(a, key)
            val vb = menuValue(b, key)
            if (va is BigDecimal && vb is BigDecimal) va.compareTo(vb) else va.toString().compareTo(vb.toString())
        }
        return if (asc) comparator else comparator.reversed()
    }

    // ----------------------------------------------------------------- Log tab

    fun logLines(
        rows: List<ReportLog>,
        day: String,
        query: String,
        productNames: Map<String, String>,
        ref: String,
        direction: String,
        sortKey: String,
        asc: Boolean,
    ): List<ReportLog> {
        val term = query.trim().lowercase()
        val named = rows
            .filter { dayOf(it.createdAt) == day }
            .map { row -> row.copy(productName = productNames[row.itemBaru].orEmpty()) }
        val filtered = named.filter { row ->
            (ref.isBlank() || row.refBaru == ref || row.ref == ref) &&
                (direction == "semua" || row.direction.equals(direction, ignoreCase = true)) &&
                (term.isBlank() ||
                    row.id.lowercase().contains(term) ||
                    row.operator.lowercase().contains(term) ||
                    row.item.lowercase().contains(term) ||
                    row.productName.lowercase().contains(term) ||
                    row.ref.lowercase().contains(term) ||
                    row.refBaru.lowercase().contains(term) ||
                    row.person.lowercase().contains(term) ||
                    row.note.lowercase().contains(term))
        }
        val comparator = Comparator<ReportLog> { a, b ->
            val va = logValue(a, sortKey)
            val vb = logValue(b, sortKey)
            if (va is BigDecimal && vb is BigDecimal) va.compareTo(vb) else va.toString().compareTo(vb.toString())
        }
        return filtered.sortedWith(if (asc) comparator else comparator.reversed())
    }

    private fun logValue(row: ReportLog, key: String): Any = when (key) {
        "created_at" -> row.createdAt
        "operator" -> row.operator.lowercase()
        "boolean" -> row.direction.lowercase()
        "item" -> row.item.lowercase()
        "item_baru" -> row.displayName.lowercase()
        "qty" -> row.qty
        "price_1" -> row.price1
        "ref_baru" -> row.refBaru.lowercase()
        "note" -> row.note.lowercase()
        else -> row.id.lowercase()
    }

    /** Laba hanya mutasi `out` yang bukan nota Pembelian, Rusak, atau Opname. */
    fun labaOf(row: ReportLog, menusById: Map<String, MenuRow>): BigDecimal {
        if (!row.isOut) return BigDecimal.ZERO
        val jenis = menusById[row.refBaru]?.jenis.orEmpty().lowercase()
        if (jenis.contains("pembelian") || jenis.contains("rusak") || jenis.contains("opname")) return BigDecimal.ZERO
        return row.subJual - row.subModal
    }

    fun logStats(rows: List<ReportLog>, menus: List<MenuRow>): LogStats {
        val menusById = menus.associateBy { it.id }
        return LogStats(
            movements = rows.size,
            qtyIn = rows.filter { !it.isOut }.fold(BigDecimal.ZERO) { sum, row -> sum + row.qty },
            qtyOut = rows.filter { it.isOut }.fold(BigDecimal.ZERO) { sum, row -> sum + row.qty },
            penjualan = rows.filter { it.isOut }.fold(BigDecimal.ZERO) { sum, row -> sum + row.subJual },
            laba = rows.fold(BigDecimal.ZERO) { sum, row -> sum + labaOf(row, menusById) },
        )
    }

    // ----------------------------------------------------------------- Kas tab

    fun cashLines(
        rows: List<CashflowRow>,
        day: String,
        query: String,
        mutasi: String,
        account: String,
        jenis: String,
        sortKey: String,
        asc: Boolean,
    ): List<CashflowRow> {
        val term = query.trim().lowercase()
        val filtered = rows.filter { row ->
            dayOf(row.createdAt) == day &&
                (mutasi == "semua" || row.mutasi == mutasi) &&
                (account == "semua" || row.acc1 == account || row.acc2 == account) &&
                (jenis == "semua" || row.jenis == jenis) &&
                (term.isBlank() ||
                    row.id.lowercase().contains(term) ||
                    row.operator.lowercase().contains(term) ||
                    row.person.lowercase().contains(term) ||
                    row.persontext.lowercase().contains(term) ||
                    row.jenis.lowercase().contains(term) ||
                    row.mutasi.lowercase().contains(term) ||
                    row.acc1.lowercase().contains(term) ||
                    row.acc2.lowercase().contains(term) ||
                    row.account1.lowercase().contains(term) ||
                    row.account2.lowercase().contains(term) ||
                    row.ref.lowercase().contains(term) ||
                    row.refBaru.lowercase().contains(term) ||
                    row.note.lowercase().contains(term))
        }
        val comparator = Comparator<CashflowRow> { a, b ->
            val va = cashValue(a, sortKey)
            val vb = cashValue(b, sortKey)
            if (va is BigDecimal && vb is BigDecimal) va.compareTo(vb) else va.toString().compareTo(vb.toString())
        }
        return filtered.sortedWith(if (asc) comparator else comparator.reversed())
    }

    fun cashAccounts(rows: List<CashflowRow>, day: String, jenis: String, mutasi: String): List<String> {
        val base = rows.filter { row ->
            dayOf(row.createdAt) == day &&
                (jenis == "semua" || row.jenis == jenis) &&
                (mutasi == "semua" || row.mutasi == mutasi)
        }
        return (base.map { it.acc1 } + base.map { it.acc2 }).filter { it.isNotBlank() }.distinct()
    }

    fun cashJenis(rows: List<CashflowRow>, day: String, account: String, mutasi: String): List<String> {
        return rows.filter { row ->
            dayOf(row.createdAt) == day &&
                (account == "semua" || row.acc1 == account || row.acc2 == account) &&
                (mutasi == "semua" || row.mutasi == mutasi)
        }.map { it.jenis }.filter { it.isNotBlank() }.distinct()
    }

    private fun cashValue(row: CashflowRow, key: String): Any = when (key) {
        "created_at" -> row.createdAt
        "operator" -> row.operator.lowercase()
        "persontext" -> (row.persontext.ifBlank { row.person }).lowercase()
        "jenis" -> row.jenis.lowercase()
        "mutasi" -> row.mutasi.lowercase()
        "acc1" -> row.acc1.lowercase()
        "acc2" -> row.acc2.lowercase()
        "nominal" -> row.nominal
        "ref_baru" -> row.refBaru.lowercase()
        "note" -> row.note.lowercase()
        else -> row.id.lowercase()
    }

    fun cashStats(rows: List<CashflowRow>): CashStats {
        val masuk = rows.filter { it.mutasi == "in" || it.mutasi.equals("Masuk", ignoreCase = true) }
            .fold(BigDecimal.ZERO) { sum, row -> sum + row.nominal }
        val keluar = rows.filter { it.mutasi == "out" || it.mutasi.equals("Keluar", ignoreCase = true) }
            .fold(BigDecimal.ZERO) { sum, row -> sum + row.nominal }
        return CashStats(rows.size, masuk, keluar, masuk - keluar)
    }

    // -------------------------------------------------------------- Ongkos tab

    fun ongkosLines(rows: List<ReportOngkos>, day: String, query: String): List<ReportOngkos> {
        val term = query.trim().lowercase()
        return rows.filter { row ->
            dayOf(row.date) == day &&
                (term.isBlank() ||
                    row.id.lowercase().contains(term) ||
                    row.idLama.lowercase().contains(term) ||
                    row.person.lowercase().contains(term) ||
                    row.operator.lowercase().contains(term) ||
                    row.ref.lowercase().contains(term) ||
                    row.refBaru.lowercase().contains(term))
        }
    }

    fun ongkosStats(rows: List<ReportOngkos>): OngkosStats {
        val rekap = LinkedHashMap<String, BigDecimal>()
        rows.forEach { row ->
            val nama = row.person.ifBlank { "Tidak diketahui" }
            rekap[nama] = (rekap[nama] ?: BigDecimal.ZERO) + row.ongkos
        }
        return OngkosStats(
            count = rows.size,
            total = rows.fold(BigDecimal.ZERO) { sum, row -> sum + row.ongkos },
            perMekanik = rekap.toList(),
        )
    }
}

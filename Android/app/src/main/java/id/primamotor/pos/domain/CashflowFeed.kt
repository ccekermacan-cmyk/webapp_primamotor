package id.primamotor.pos.domain

import id.primamotor.pos.data.repo.CashflowRow
import id.primamotor.pos.data.repo.MenuRow
import id.primamotor.pos.data.repo.PersonRow
import id.primamotor.pos.data.repo.UserRow
import java.math.BigDecimal
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Aturan baca halaman Cashflow, cermin `pages/cashflow.tsx` dan turunannya.
 *
 * Web memfilter dan memaginasi di server; Android memegang cache Room, jadi aturan yang
 * sama diterapkan lokal supaya hasil, urutan, dan labelnya tetap identik.
 */
object CashflowFeed {

    const val SEMUA = "semua"
    const val MASUK = "masuk"
    const val KELUAR = "keluar"
    const val PER_PAGE = 20
    const val TEMPO_PER_PAGE = 10

    private val DATE_LABEL = DateTimeFormatter.ofPattern("d MMMM yyyy", Locale("id", "ID"))
    private val CLOCK_LABEL = DateTimeFormatter.ofPattern("HH:mm", Locale("id", "ID"))
    private val DATE_TIME_LABEL = DateTimeFormatter.ofPattern("d MMM yyyy HH:mm", Locale("id", "ID"))

    data class HistoryFilter(
        val search: String = "",
        val mutasi: String = SEMUA,
        val accountIds: Set<String> = emptySet(),
        val jenisKeys: Set<String> = emptySet(),
        val from: String = "",
        val to: String = "",
    )

    fun apply(rows: List<CashflowRow>, filter: HistoryFilter): List<CashflowRow> {
        val terms = filter.search.lowercase().split(' ').filter { it.isNotBlank() }
        return rows
            .filter { row ->
                terms.all { term ->
                    listOf(row.ref, row.note, row.persontext, row.jenis).any { it.lowercase().contains(term) }
                }
            }
            .filter { row -> matchesMutation(row, filter) }
            .filter { row -> filter.jenisKeys.isEmpty() || row.jenis in filter.jenisKeys }
            .filter { row -> inRange(row, filter.from, filter.to) }
            .sortedByDescending { WibDate.parseInstant(it.createdAt)?.toEpochMilli() ?: 0L }
    }

    private fun matchesMutation(row: CashflowRow, filter: HistoryFilter): Boolean {
        val ids = filter.accountIds
        val masuk = isMasuk(row)
        val keluar = !masuk
        val transfer = isTransfer(row)
        return when (filter.mutasi) {
            MASUK -> when {
                ids.isEmpty() -> masuk
                masuk -> row.account1 in ids
                else -> transfer && row.account2 in ids && row.account1 !in ids
            }
            KELUAR -> keluar && (ids.isEmpty() || row.account1 in ids)
            else -> ids.isEmpty() || row.account1 in ids || row.account2 in ids
        }
    }

    private fun inRange(row: CashflowRow, from: String, to: String): Boolean {
        if (from.isBlank() && to.isBlank()) return true
        val day = WibDate.dayOf(row.createdAt) ?: return false
        if (from.isNotBlank() && day < LocalDate.parse(from)) return false
        if (to.isNotBlank() && day > LocalDate.parse(to)) return false
        return true
    }

    fun isMasuk(row: CashflowRow): Boolean = row.mutasi.lowercase() in setOf("in", "masuk")

    fun isTransfer(row: CashflowRow): Boolean = row.jenis.lowercase().contains("transfer")

    fun isBonKaryawan(row: CashflowRow): Boolean = row.jenis.lowercase() == "bonkaryawan"

    /** `↔` transfer, `+` masuk, `-` keluar. */
    fun sign(row: CashflowRow): String = when {
        isTransfer(row) -> "↔"
        isMasuk(row) -> "+"
        else -> "-"
    }

    fun signed(row: CashflowRow): BigDecimal =
        if (isMasuk(row)) row.nominal.abs() else row.nominal.abs().negate()

    fun shortCode(row: CashflowRow): String {
        val source = row.id.ifBlank { row.ref }
        return if (source.length > 6) source.takeLast(6) else source
    }

    fun groupByDate(rows: List<CashflowRow>): List<Pair<String, List<CashflowRow>>> {
        val groups = LinkedHashMap<String, MutableList<CashflowRow>>()
        rows.forEach { row ->
            val day = WibDate.dayOf(row.createdAt)
            val label = day?.format(DATE_LABEL) ?: "Tanpa Tanggal"
            groups.getOrPut(label) { mutableListOf() }.add(row)
        }
        return groups.map { it.key to it.value.toList() }
    }

    fun clock(row: CashflowRow): String =
        WibDate.parseInstant(row.createdAt)?.atZone(WibDate.WIB)?.format(CLOCK_LABEL) ?: ""

    fun dateTime(raw: String): String =
        WibDate.parseInstant(raw)?.atZone(WibDate.WIB)?.format(DATE_TIME_LABEL) ?: raw

    /**
     * Validasi saldo web memperhitungkan nominal lama saat mengedit transaksi keluar
     * (`editableBalance` di `lib/cashflow.ts`).
     */
    fun editableBalance(balance: BigDecimal, previous: CashflowRow?, accountId: String): BigDecimal =
        if (previous != null && previous.account1 == accountId) balance + previous.nominal else balance

    // ---- Buku Kas & Saldo -------------------------------------------------

    enum class WalletKind(val tab: String, val title: String) {
        KAS("kas", "Kas & Bank"),
        CUSTOMER("customer", "Piutang Customer"),
        SUPPLIER("supplier", "Hutang Supplier"),
        KARYAWAN("karyawan", "Bon Karyawan"),
    }

    data class Wallet(
        val id: String,
        val idLama: String,
        val name: String,
        val jenis: String,
        val balance: BigDecimal,
        val image: String = "",
        val kind: WalletKind = WalletKind.KAS,
    )

    fun wallets(accounts: List<PersonRow>, people: List<PersonRow>, users: List<UserRow>): List<Wallet> {
        val kas = accounts.map {
            Wallet(it.id, it.idLama, it.nama, it.jenis, it.number1, kind = WalletKind.KAS)
        }
        val customers = people.filter { it.jenis.lowercase().contains("customer") }.map {
            Wallet(it.id, it.idLama, it.nama, it.jenis, it.number1, kind = WalletKind.CUSTOMER)
        }
        val suppliers = people.filter { it.jenis.lowercase().contains("supplier") }.map {
            Wallet(it.id, it.idLama, it.nama, it.jenis, it.number1, kind = WalletKind.SUPPLIER)
        }
        val employees = users.filter { it.status.equals("active", ignoreCase = true) }.map {
            Wallet(it.id, it.username, it.name.ifBlank { it.username }, "User", it.number1, it.linkImage, WalletKind.KARYAWAN)
        }
        return kas + customers + suppliers + employees
    }

    fun subtotal(wallets: List<Wallet>): BigDecimal =
        wallets.fold(BigDecimal.ZERO) { sum, wallet -> sum + wallet.balance }

    fun positive(wallets: List<Wallet>): List<Wallet> = wallets.filter { it.balance.signum() > 0 }

    fun nonPositive(wallets: List<Wallet>): List<Wallet> = wallets.filter { it.balance.signum() <= 0 }

    // ---- Jatuh Tempo ------------------------------------------------------

    data class TempoDay(val key: String, val label: String, val items: List<MenuRow>, val overdue: Boolean)

    fun tempo(menus: List<MenuRow>, today: LocalDate = LocalDate.now(WibDate.WIB)): List<TempoDay> {
        val groups = menus
            .filter { it.jenis.lowercase().contains("pembelian") }
            .filter { it.status.lowercase() == "belum" }
            .filter { it.tempo.isNotBlank() }
            .groupBy { it.tempo.take(10) }
            .map { (key, items) -> TempoDay(key, WibDate.dayOf(key + "T00:00:00Z")?.format(DATE_LABEL) ?: key, items, key < today.toString()) }
            .sortedWith(compareBy({ it.overdue.not() }, { it.key }))
        return groups
    }

    fun tempoTotal(days: List<TempoDay>): Int = days.sumOf { it.items.size }

    fun dayText(key: String, today: LocalDate = LocalDate.now(WibDate.WIB)): String {
        val date = runCatching { LocalDate.parse(key) }.getOrNull() ?: return key
        val days = java.time.temporal.ChronoUnit.DAYS.between(today, date).toInt()
        return when {
            days < 0 -> "Lewat ${-days} Hari"
            days == 0 -> "Jatuh Tempo Hari Ini"
            else -> "Sisa $days Hari"
        }
    }

    fun progressPercent(paid: BigDecimal, total: BigDecimal): Int =
        if (total.signum() <= 0) 0
        else (paid.multiply(BigDecimal(100)).divide(total, 0, java.math.RoundingMode.HALF_UP)).toInt().coerceIn(0, 100)

    fun remaining(row: MenuRow): BigDecimal = row.total.subtract(row.dibayar).max(BigDecimal.ZERO)

    // ---- Peta nama --------------------------------------------------------

    /**
     * Web mencocokkan akun lewat `id` atau `text_1` saja, sehingga baris lama yang hanya
     * menyimpan `acc1` (id_lama) tampil sebagai kode mentah. Di sini `acc1`/`acc2` ikut
     * dicocokkan supaya riwayat lama tidak kehilangan nama.
     */
    fun accountName(wallet: Wallet?, fallback: String): String =
        wallet?.name?.ifBlank { wallet.idLama }?.ifBlank { fallback } ?: fallback.ifBlank { "-" }

    fun personName(person: String, persontext: String, wallets: List<Wallet>): String {
        val match = wallets.firstOrNull { it.id == person || it.idLama == persontext }
        return match?.name ?: persontext.ifBlank { person }
    }
}

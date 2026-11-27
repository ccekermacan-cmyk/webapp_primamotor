package id.primamotor.pos.domain

import id.primamotor.pos.data.repo.CashflowRow
import id.primamotor.pos.data.repo.MenuRow
import id.primamotor.pos.data.repo.PersonRow
import id.primamotor.pos.data.repo.UserRow
import java.math.BigDecimal

/** Tab halaman People, label persis `pages/person.tsx`. */
enum class PersonTab(val label: String) {
    ALL("Semua (Person)"),
    CUSTOMER("Customers"),
    SUPPLIER("Suppliers"),
    STAFF("Karyawan"),
}

data class PersonSummary(val totalBelanja: BigDecimal, val totalSisa: BigDecimal) {
    companion object {
        val EMPTY = PersonSummary(BigDecimal.ZERO, BigDecimal.ZERO)
    }
}

/** Aturan baca halaman `People` web, tanpa akses database supaya mudah dites. */
object PersonFeed {

    fun filterPeople(rows: List<PersonRow>, tab: PersonTab, query: String): List<PersonRow> {
        val term = query.trim().lowercase()
        return rows.filter { row ->
            when (tab) {
                PersonTab.ALL -> true
                PersonTab.CUSTOMER -> row.jenis.equals("Customer", ignoreCase = true)
                PersonTab.SUPPLIER -> row.jenis.equals("Supplier", ignoreCase = true)
                PersonTab.STAFF -> false
            } && (term.isBlank() ||
                row.nama.lowercase().contains(term) ||
                row.keterangan.lowercase().contains(term))
        }.sortedBy { it.nama.lowercase() }
    }

    fun filterStaff(rows: List<UserRow>, level: String, status: String, query: String): List<UserRow> {
        val term = query.trim().lowercase()
        return rows.filter { row ->
            (level == "all" || row.level.toString() == level) &&
                (status == "all" || row.status.equals(status, ignoreCase = true)) &&
                (term.isBlank() ||
                    row.name.lowercase().contains(term) ||
                    row.username.lowercase().contains(term))
        }.sortedBy { it.name.lowercase() }
    }

    /** Tinggi web `max(5, min(12, floor((vh - 360) / 62)))`. */
    fun perPageFor(heightDp: Int): Int = ((heightDp - 360) / 62).coerceIn(5, 12)

    fun pagesOf(size: Int, perPage: Int): Int =
        if (size <= 0 || perPage <= 0) 1 else (size + perPage - 1) / perPage

    fun <T> pageOf(rows: List<T>, page: Int, perPage: Int): List<T> {
        val safePage = page.coerceAtLeast(1)
        val from = (safePage - 1) * perPage.coerceAtLeast(1)
        return rows.drop(from).take(perPage.coerceAtLeast(1))
    }

    /** `getAvatarInitials` web: dua huruf pertama dari dua kata, atau dua huruf awal. */
    fun initials(name: String): String {
        val words = name.trim().split(Regex("\\s+")).filter { it.isNotBlank() }
        if (words.isEmpty()) return "??"
        return if (words.size >= 2) {
            (words[0].take(1) + words[1].take(1)).uppercase()
        } else {
            words[0].take(2).uppercase()
        }
    }

    fun levelBadge(level: Int): String = when (level) {
        1 -> "Admin"
        10 -> "Mekanik"
        else -> "Karyawan"
    }

    /** Alamat lengkap persis susunan `PersonDetailModal` web. */
    fun addressOf(row: PersonRow): String {
        val rtrw = listOf(
            row.number2.takeIf { it.signum() > 0 }?.let { "RT ${it.stripTrailingZeros().toPlainString()}" },
            row.number3.takeIf { it.signum() > 0 }?.let { "RW ${it.stripTrailingZeros().toPlainString()}" },
        ).filterNotNull().joinToString("/")
        return listOf(
            row.text3,
            rtrw,
            row.text4.takeIf { it.isNotBlank() }?.let { "Ds. $it" }.orEmpty(),
            row.text5.takeIf { it.isNotBlank() }?.let { "Kec. $it" }.orEmpty(),
            row.text6,
            row.text7,
        ).filter { it.isNotBlank() }.joinToString(", ")
    }

    /** Ringkasan tab History: hanya nota `belum`, sisa hanya bila positif. */
    fun historySummary(menus: List<MenuRow>): PersonSummary {
        var belanja = BigDecimal.ZERO
        var sisa = BigDecimal.ZERO
        menus.filter { it.status.equals("belum", ignoreCase = true) }.forEach { menu ->
            belanja += menu.total
            val rest = menu.total - menu.dibayar
            if (rest.signum() > 0) sisa += rest
        }
        return PersonSummary(belanja, sisa)
    }

    fun historyRows(menus: List<MenuRow>): List<MenuRow> = menus.sortedByDescending { it.createdAt }

    /** Tab Bon karyawan: filter cashflow web `(id_lama = "addbon" || note ~ "bon") && person/persontext`. */
    fun bonRows(cashflows: List<CashflowRow>, username: String): List<CashflowRow> {
        val target = username.trim()
        if (target.isBlank()) return emptyList()
        return cashflows.filter { row ->
            (row.idLama.equals("addbon", ignoreCase = true) ||
                row.note.contains("bon", ignoreCase = true)) &&
                (row.person == target || row.persontext == target)
        }.sortedByDescending { it.createdAt }
    }

    /** Label tanggal-waktu `toLocaleString('id-ID', ...)` web: `dd/MM/yyyy, HH.mm.ss`. */
    fun dateTimeLabel(raw: String): String {
        val instant = WibDate.parseInstant(raw) ?: return raw
        return instant.atZone(WibDate.WIB)
            .format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy, HH.mm.ss"))
    }
}

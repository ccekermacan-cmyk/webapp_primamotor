package id.primamotor.pos.domain

import id.primamotor.pos.data.repo.CashflowRow
import id.primamotor.pos.data.repo.MenuRow
import id.primamotor.pos.data.repo.PersonRow
import id.primamotor.pos.data.repo.UserRow
import org.junit.Assert.assertEquals
import org.junit.Test
import java.math.BigDecimal

class PersonFeedTest {

    private fun person(
        id: String,
        nama: String,
        keterangan: String = "",
        jenis: String = "Customer",
        idLama: String = "PSN-0001",
        text3: String = "",
        text4: String = "",
        text5: String = "",
        text6: String = "",
        text7: String = "",
        text9: String = "",
        number2: String = "0",
        number3: String = "0",
        number4: String = "0",
        phone: String = "",
    ) = PersonRow(
        id = id,
        nama = nama,
        keterangan = keterangan,
        jenis = jenis,
        kategori = "Person",
        idLama = idLama,
        phone = phone,
        number2 = BigDecimal(number2),
        text3 = text3,
        text4 = text4,
        text5 = text5,
        text6 = text6,
        text7 = text7,
        text9 = text9,
        number3 = BigDecimal(number3),
        number4 = BigDecimal(number4),
    )

    private fun user(id: String, name: String, username: String, level: Int = 2, status: String = "active") =
        UserRow(id = id, name = name, username = username, level = level, status = status)

    private fun menu(
        id: String,
        total: String,
        dibayar: String = "0",
        status: String = "belum",
        createdAt: String = "2026-11-20T03:00:00.000Z",
        person: String = "PSN-0001",
    ) = MenuRow(
        id = id,
        person = person,
        payment = "cash",
        total = BigDecimal(total),
        dibayar = BigDecimal(dibayar),
        status = status,
        cashback = BigDecimal.ZERO,
        note = "",
        operator = "Admin",
        createdAt = createdAt,
        idLama = id,
        jenis = "Penjualan",
    )

    private fun cash(
        id: String,
        nominal: String = "5000",
        note: String = "",
        person: String = "",
        persontext: String = "",
        idLama: String = "",
        createdAt: String = "2026-11-20T03:00:00.000Z",
    ) = CashflowRow(
        id = id,
        account1 = "acc1",
        account2 = "",
        nominal = BigDecimal(nominal),
        mutasi = "out",
        jenis = "bon",
        note = note,
        person = person,
        createdAt = createdAt,
        idLama = idLama,
        persontext = persontext,
    )

    @Test
    fun `filter tab memakai jenis dan pencarian dua kolom`() {
        val rows = listOf(
            person("1", "Budi", "Bengkel Budi"),
            person("2", "Oli Jaya", jenis = "Supplier"),
            person("3", "Siti", keterangan = "Toko Siti"),
        )

        assertEquals(listOf("Budi", "Siti"), PersonFeed.filterPeople(rows, PersonTab.CUSTOMER, "").map { it.nama })
        assertEquals(listOf("Oli Jaya"), PersonFeed.filterPeople(rows, PersonTab.SUPPLIER, "").map { it.nama })
        assertEquals(listOf("Siti"), PersonFeed.filterPeople(rows, PersonTab.ALL, "toko").map { it.nama })
        assertEquals(listOf("Budi"), PersonFeed.filterPeople(rows, PersonTab.ALL, "budi").map { it.nama })
    }

    @Test
    fun `staff difilter level status dan nama`() {
        val rows = listOf(
            user("1", "Ani", "ani", level = 1),
            user("2", "Budi", "budi", level = 2),
            user("3", "Cici", "cici", level = 10, status = "inactive"),
        )

        assertEquals(listOf("Ani", "Budi"), PersonFeed.filterStaff(rows, "all", "active", "").map { it.name })
        assertEquals(listOf("Cici"), PersonFeed.filterStaff(rows, "10", "all", "").map { it.name })
        assertEquals(listOf("Ani"), PersonFeed.filterStaff(rows, "1", "all", "ani").map { it.name })
    }

    @Test
    fun `perPage mengikuti rumus tinggi web`() {
        assertEquals(5, PersonFeed.perPageFor(0))
        assertEquals(5, PersonFeed.perPageFor(600))
        assertEquals(8, PersonFeed.perPageFor(900))
        assertEquals(12, PersonFeed.perPageFor(2000))
    }

    @Test
    fun `paginasi membatasi halaman`() {
        assertEquals(1, PersonFeed.pagesOf(0, 5))
        assertEquals(3, PersonFeed.pagesOf(11, 5))
        assertEquals(listOf(3, 4), PersonFeed.pageOf(listOf(1, 2, 3, 4, 5, 6), 2, 2))
        assertEquals(listOf(1, 2), PersonFeed.pageOf(listOf(1, 2, 3), 0, 2))
    }

    @Test
    fun `inisial dan badge level`() {
        assertEquals("BS", PersonFeed.initials("budi santoso"))
        assertEquals("SI", PersonFeed.initials("siti"))
        assertEquals("??", PersonFeed.initials("  "))
        assertEquals("Admin", PersonFeed.levelBadge(1))
        assertEquals("Mekanik", PersonFeed.levelBadge(10))
        assertEquals("Karyawan", PersonFeed.levelBadge(2))
    }

    @Test
    fun `alamat disusun seperti web`() {
        val row = person(
            "1",
            "Budi",
            text3 = "Dusun Krajan",
            number2 = "2",
            number3 = "3",
            text4 = "Sukamaju",
            text5 = "Krajan",
            text6 = "Malang",
            text7 = "Jawa Timur",
        )
        assertEquals(
            "Dusun Krajan, RT 2/RW 3, Ds. Sukamaju, Kec. Krajan, Malang, Jawa Timur",
            PersonFeed.addressOf(row),
        )
        assertEquals("", PersonFeed.addressOf(person("2", "Kosong")))
    }

    @Test
    fun `ringkasan history hanya nota belum`() {
        val rows = listOf(
            menu("1", "100000", "40000"),
            menu("2", "50000", "50000", status = "lunas"),
            menu("3", "25000", "30000"),
        )
        val summary = PersonFeed.historySummary(rows)
        assertEquals(BigDecimal("125000"), summary.totalBelanja)
        assertEquals(BigDecimal("60000"), summary.totalSisa)
    }

    @Test
    fun `bon difilter addbon atau note bon untuk person yang sama`() {
        val rows = listOf(
            cash("1", idLama = "addbon", persontext = "budi"),
            cash("2", note = "Ambil bon mingguan", person = "budi"),
            cash("3", note = "Ambil bon", person = "ani"),
            cash("4", note = "Gaji", person = "budi"),
        )
        assertEquals(listOf("1", "2"), PersonFeed.bonRows(rows, "budi").map { it.id })
        assertEquals(emptyList<CashflowRow>(), PersonFeed.bonRows(rows, " "))
    }

    @Test
    fun `label tanggal waktu id`() {
        assertEquals("20/11/2026, 10.00.00", PersonFeed.dateTimeLabel("2026-11-20T03:00:00.000Z"))
        assertEquals("", PersonFeed.dateTimeLabel(""))
    }
}

package id.primamotor.pos.data.repo

import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.LocalRecordEntity
import id.primamotor.pos.domain.GajiDetails
import id.primamotor.pos.domain.GajiItem
import id.primamotor.pos.domain.GajiMath
import id.primamotor.pos.domain.PosFeed
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import java.math.BigDecimal

/** Field JSON dengan default aman. Server boleh menambah field; parser tidak gagal. */
fun JsonObject.text(field: String): String {
    val element = this[field] ?: return ""
    if (element is JsonNull) return ""
    return runCatching { element.jsonPrimitive.content }.getOrDefault("")
}

/** Field array string (mis. `file` pada menu). Nilai tunggal diperlakukan sebagai satu elemen. */
fun JsonObject.strings(field: String): List<String> {
    val element = this[field] ?: return emptyList()
    if (element is JsonNull) return emptyList()
    val array = element as? JsonArray
        ?: return listOfNotNull(runCatching { element.jsonPrimitive.content }.getOrNull())
            .filter { it.isNotBlank() }
    return array.mapNotNull { (it as? JsonPrimitive)?.contentOrNull }.filter { it.isNotBlank() }
}

fun JsonObject.number(field: String): BigDecimal =
    text(field).takeIf { it.isNotBlank() }?.toBigDecimalOrNull() ?: BigDecimal.ZERO

fun JsonObject.int(field: String): Int = number(field).toInt()

/** Field produk yang dipakai web: `beli`, `sell_1..6`, `min_1..3`, `stok_3`. */
data class Produk(
    val id: String,
    val nama: String,
    val idLama: String,
    val kategori: String,
    val merk: String,
    val jenis: String,
    val varian: String,
    val tipe: String,
    val unit: String,
    val barcode: String,
    val keterangan: String,
    val stok: BigDecimal,
    val beli: BigDecimal,
    val sell1: BigDecimal,
    val sell2: BigDecimal,
    val sell3: BigDecimal,
    val sell4: BigDecimal,
    val sell5: BigDecimal,
    val sell6: BigDecimal,
    val min1: BigDecimal,
    val min2: BigDecimal,
    val min3: BigDecimal,
    /** Field tambahan halaman Produk web: `stok_1`, `stok_2`, `file`, `created`. */
    val stok1: BigDecimal = BigDecimal.ZERO,
    val stok2: BigDecimal = BigDecimal.ZERO,
    val files: List<String> = emptyList(),
    val createdAt: String = "",
)

data class MenuRow(
    val id: String,
    val person: String,
    val payment: String,
    val total: BigDecimal,
    val dibayar: BigDecimal,
    val status: String,
    val cashback: BigDecimal,
    val note: String,
    val operator: String,
    val createdAt: String,
    val idLama: String,
    val jenis: String = "",
    val text: String = "",
    val qty: BigDecimal = BigDecimal.ZERO,
    val admin: BigDecimal = BigDecimal.ZERO,
    val marketplace: String = "",
    val ref: String = "",
    val files: List<String> = emptyList(),
    /** Tanggal jatuh tempo pembelian (`YYYY-MM-DD`); hanya dipakai tab Jatuh Tempo. */
    val tempo: String = "",
    /** `person_baru` dipakai detail Report saat `person` kosong. */
    val personBaru: String = "",
)

/** Rincian nota dari `log_stock`, `cashflow`, dan `ongkos`, cermin `loadHistorySubDetails` web. */
data class MenuItemDetail(
    val id: String,
    /** Kode `item` (id produk) pada log. */
    val code: String,
    val label: String,
    val qty: BigDecimal,
    val price: BigDecimal,
    /** Modal total baris (`price_2`), dipakai hitung laba. */
    val cost: BigDecimal,
    val direction: String,
    val stockStart: BigDecimal?,
    val stockEnd: BigDecimal?,
)

data class MenuCashflowDetail(
    val id: String,
    val accountId: String,
    val nominal: BigDecimal,
    val mutasi: String,
    val note: String,
    val saldoAwal: BigDecimal?,
    val saldoAkhir: BigDecimal?,
)

data class MenuOngkosDetail(val id: String, val person: String, val ongkos: BigDecimal)

data class MenuDetail(
    val items: List<MenuItemDetail> = emptyList(),
    val cashflows: List<MenuCashflowDetail> = emptyList(),
    val ongkos: List<MenuOngkosDetail> = emptyList(),
) {
    val totalTransaksi: BigDecimal
        get() = items.fold(BigDecimal.ZERO) { sum, item -> sum + item.price.multiply(item.qty) }

    val labaKotor: BigDecimal
        get() = items.fold(BigDecimal.ZERO) { sum, item -> sum + item.price.multiply(item.qty) - item.cost }

    val totalOngkos: BigDecimal get() = ongkos.fold(BigDecimal.ZERO) { sum, row -> sum + row.ongkos }
}

data class CashflowRow(
    val id: String,
    val account1: String,
    val account2: String,
    val nominal: BigDecimal,
    val mutasi: String,
    val jenis: String,
    val note: String,
    val person: String,
    val createdAt: String,
    val ref: String = "",
    val operator: String = "",
    val persontext: String = "",
    val refBaru: String = "",
    val saldoAwal: BigDecimal? = null,
    val saldoAkhir: BigDecimal? = null,
    /** `acc1`/`acc2` menyimpan `id_lama` akun untuk baris lama. */
    val acc1: String = "",
    val acc2: String = "",
    val files: List<String> = emptyList(),
    /** `id_lama` baris kas lama; `addbon` menandai pencatatan bon. */
    val idLama: String = "",
)

data class BonRow(
    val id: String,
    val nominal: BigDecimal,
    val jenis: String,
    val note: String,
    val operator: String,
    val userId: String,
    val person: String,
    val created: String,
    val persontext: String = "",
    val refCashflow: String = "",
    val refGaji: String = "",
)

/** Pilihan jenis cashflow `dropdown`: `text_2` menentukan arah (in/out). */
data class CashflowKind(
    val id: String,
    val idLama: String,
    val nama: String,
    val arah: String,
)

/** Cermin `salaryDetails` di Frontend/src/lib/account.ts. */
data class GajiRow(
    val id: String,
    val person: String,
    val ref: String,
    val pokok: BigDecimal,
    val tunjangan: BigDecimal,
    val lembur: BigDecimal,
    val bonus: BigDecimal,
    val qty: BigDecimal,
    val alfa: BigDecimal,
    val setengahHari: BigDecimal,
    val sakit: BigDecimal,
    val telat: BigDecimal,
    val bpjs: BigDecimal,
    val bonDiambil: BigDecimal,
    val bonDibayar: BigDecimal,
    /** Nilai `total` dari server bila ada; bila null dihitung lokal. */
    val total: BigDecimal?,
    val createdAt: String,
) {
    private val item: GajiItem
        get() = GajiItem(
            pokok = pokok,
            tunjangan = tunjangan,
            bonus1 = bonus,
            lembur = lembur,
            alfa = alfa,
            setengahHari = setengahHari,
            sakit = sakit,
            telat = telat,
            bpjs = bpjs,
            bonDiambil = bonDiambil,
            bonDibayar = bonDibayar,
            qty = qty,
            total = total,
        )

    val details: GajiDetails get() = GajiMath.details(item)

    val diterima: BigDecimal get() = details.grandTotal
}

/** Baris `log_stock` untuk tab riwayat stok di detail produk, cermin tabel web. */
data class ProductLog(
    val id: String,
    val createdAt: String,
    val operator: String,
    val direction: String,
    val qty: BigDecimal,
    val price: BigDecimal,
    val refBaru: String,
)

data class PersonRow(
    val id: String,
    val nama: String,
    val keterangan: String,
    val jenis: String,
    val kategori: String,
    val idLama: String = "",
    val phone: String = "",
    val alamat: String = "",
    val number1: BigDecimal = BigDecimal.ZERO,
    val number2: BigDecimal = BigDecimal.ZERO,
    val visibilitas: String = "",
    /** `text_3` dusun/jalan, `text_4` desa, `text_5` kecamatan. */
    val text3: String = "",
    val text4: String = "",
    val text5: String = "",
    /** `text_6` kota/kabupaten, `text_7` provinsi, `text_9` tipe/kelompok. */
    val text6: String = "",
    val text7: String = "",
    val text9: String = "",
    /** `number_3` RW, `number_4` NIK. `number_2` = RT. */
    val number3: BigDecimal = BigDecimal.ZERO,
    val number4: BigDecimal = BigDecimal.ZERO,
    val linkImage: String = "",
)

data class UserRow(
    val id: String,
    val name: String,
    val username: String,
    val level: Int,
    val status: String,
    val email: String = "",
    val phone: String = "",
    val linkImage: String = "",
    /** Saldo bon karyawan (`number` di koleksi `user`). */
    val number1: BigDecimal = BigDecimal.ZERO,
    val emailVisibility: Boolean = true,
    val verified: Boolean = true,
)

fun LocalRecordEntity.object_(): JsonObject? =
    runCatching { kotlinx.serialization.json.Json.parseToJsonElement(json) as JsonObject }.getOrNull()

private fun LocalRecordEntity.obj(): JsonObject =
    object_() ?: JsonObject(emptyMap())

/**
 * Repository baca, cache-first: semua data berasal dari Room yang diisi [Puller].
 * Tidak ada panggilan jaringan di sini, jadi UI tetap hidup saat offline.
 */
class Repositories(private val db: AppDatabase) {

    private fun observeRows(collection: String): Flow<List<JsonObject>> =
        db.localRecordDao().observe(collection).map { rows -> rows.map { it.obj() } }

    fun observeProduk(): Flow<List<Produk>> = observeRows("produk").map { rows ->
        rows.map(::produk).filter { it.id.isNotEmpty() }
    }

    fun observeMenu(): Flow<List<MenuRow>> = observeRows("menu").map { rows -> rows.map(::menu) }

    fun observeMenuDay(dateKey: String): Flow<List<MenuRow>> =
        db.localRecordDao().observeDay("menu", dateKey).map { rows -> rows.map { menu(it.obj()) } }

    fun observeCashflow(): Flow<List<CashflowRow>> = observeRows("cashflow").map { rows ->
        rows.map { row ->
            CashflowRow(
                id = row.text("id"),
                account1 = row.text("account_1"),
                account2 = row.text("account_2"),
                nominal = row.number("nominal"),
                mutasi = row.text("mutasi"),
                jenis = row.text("jenis"),
                note = row.text("note"),
                person = row.text("person"),
                createdAt = row.text("created_at"),
                ref = row.text("ref"),
                operator = row.text("operator"),
                persontext = row.text("persontext"),
                refBaru = row.text("ref_baru"),
                saldoAwal = row.text("saldo_awal").takeIf { it.isNotBlank() }?.toBigDecimalOrNull(),
                saldoAkhir = row.text("saldo_akhir").takeIf { it.isNotBlank() }?.toBigDecimalOrNull(),
                acc1 = row.text("acc1"),
                acc2 = row.text("acc2"),
                files = row.strings("file"),
                idLama = row.text("id_lama"),
            )
        }
    }

    fun observeBon(userId: String): Flow<List<BonRow>> =
        db.localRecordDao().observeGroup("bon", userId).map { rows ->
            rows.map { row ->
                BonRow(
                    id = row.id,
                    nominal = row.obj().number("nominal"),
                    jenis = row.obj().text("jenis"),
                    note = row.obj().text("note"),
                    operator = row.obj().text("operator"),
                    userId = row.obj().text("user"),
                    person = row.obj().text("person"),
                    created = row.obj().text("created"),
                    persontext = row.obj().text("persontext"),
                    refCashflow = row.obj().text("ref_cashflow"),
                    refGaji = row.obj().text("ref_gaji"),
                )
            }
        }

    /**
     * Gaji bersifat pribadi: hanya baris milik [personId] pengguna yang dipancarkan,
     * walau pull menyimpan baris lain. Aturan server tetap otoritatif.
     */
    fun observeGajiSendiri(personId: String): Flow<List<GajiRow>> =
        db.localRecordDao().observeGroup("gaji", personId).map { rows ->
            rows.mapNotNull { entity -> gajiRow(entity.id, entity.obj(), personId) }
        }

    /**
     * Riwayat gaji satu karyawan untuk tab Gaji di detail People. Tab itu hanya
     * tampil untuk level 1, sama seperti jangkauan halaman web; aturan server tetap otoritatif.
     */
    fun observeGajiPerson(username: String): Flow<List<GajiRow>> = observeRows("gaji").map { rows ->
        rows.mapNotNull { row -> gajiRow(row.text("id"), row, username) }
    }

    private fun gajiRow(id: String, row: JsonObject, person: String): GajiRow? {
        if (row.text("person") != person) return null
        return GajiRow(
            id = id,
            person = person,
            ref = row.text("ref"),
            pokok = row.number("pokok"),
            tunjangan = row.number("tunjangan"),
            lembur = row.number("lembur"),
            qty = row.number("qty").takeIf { it.signum() > 0 } ?: BigDecimal.ONE,
            alfa = row.number("alfa"),
            setengahHari = row.number("setengah_hari"),
            sakit = row.number("sakit"),
            telat = row.number("telat"),
            bpjs = row.number("bpjs"),
            bonDiambil = row.number("bon_diambil"),
            bonDibayar = row.number("bon_dibayar"),
            bonus = row.number("bonus_1") + row.number("bonus_2") + row.number("bonus_3") + row.number("bonus_4") + row.number("program"),
            total = row.text("total").takeIf { it.isNotBlank() }?.toBigDecimalOrNull(),
            createdAt = row.text("created_at"),
        )
    }

    fun observeMasterRows(): Flow<List<LocalRecordEntity>> = db.localRecordDao().observe("dropdown")

    fun observeRaw(collection: String): Flow<List<LocalRecordEntity>> = db.localRecordDao().observe(collection)

    fun observePerson(): Flow<List<PersonRow>> = observeRows("dropdown").map { rows ->
        rows.mapNotNull { row ->
            if (row.text("kategori").lowercase() != "person") return@mapNotNull null
            PersonRow(
                id = row.text("id"),
                nama = row.text("text_1"),
                keterangan = row.text("text_2"),
                jenis = row.text("jenis"),
                kategori = row.text("kategori"),
                idLama = row.text("id_lama"),
                phone = row.text("phone"),
                alamat = row.text("alamat"),
                number1 = row.number("number_1"),
                number2 = row.number("number_2"),
                visibilitas = row.text("visibilitas"),
                text3 = row.text("text_3"),
                text4 = row.text("text_4"),
                text5 = row.text("text_5"),
                text6 = row.text("text_6"),
                text7 = row.text("text_7"),
                text9 = row.text("text_9"),
                number3 = row.number("number_3"),
                number4 = row.number("number_4"),
                linkImage = row.text("link_image"),
            )
        }
    }

    /** Pilihan pelanggan POS: semua baris `kategori = Person` (Umum, Customer, Supplier, Online). */
    fun observeCustomers(): Flow<List<PersonRow>> = observeRows("dropdown").map { rows ->
        rows.mapNotNull { row ->
            if (row.text("kategori").lowercase() != "person") return@mapNotNull null
            PersonRow(
                id = row.text("id"),
                nama = row.text("text_1"),
                keterangan = row.text("text_2"),
                jenis = row.text("jenis"),
                kategori = row.text("kategori"),
                idLama = row.text("id_lama"),
                phone = row.text("phone"),
                number1 = row.number("number_1"),
                number2 = row.number("number_2"),
            )
        }.sortedBy { it.nama.lowercase() }
    }

    /** Pilihan akun kas/bank untuk pembayaran. */
    fun observeAccounts(): Flow<List<PersonRow>> = observeRows("dropdown").map { rows ->
        rows.mapNotNull { row ->
            if (!row.text("jenis").lowercase().contains("cashflow account")) return@mapNotNull null
            PersonRow(
                id = row.text("id"),
                nama = row.text("text_1"),
                keterangan = row.text("text_2"),
                jenis = row.text("jenis"),
                kategori = row.text("kategori"),
                idLama = row.text("id_lama"),
                phone = row.text("phone"),
                alamat = row.text("alamat"),
                number1 = row.number("number_1"),
                number2 = row.number("number_2"),
                visibilitas = row.text("visibilitas"),
            )
        }
    }

    /** Jenis menu POS (Penjualan, Pembelian, Service, ...). */
    fun observeMenus(): Flow<List<PersonRow>> = observeRows("dropdown").map { rows ->
        rows.mapNotNull { row ->
            val kategori = row.text("kategori").lowercase()
            val jenis = row.text("jenis").lowercase()
            if (!kategori.contains("menu") || !jenis.contains("jenis menu")) return@mapNotNull null
            PersonRow(
                id = row.text("id"),
                nama = row.text("text_1"),
                keterangan = row.text("text_2"),
                jenis = row.text("jenis"),
                kategori = kategori,
            )
        }
    }

    /** Jenis cashflow, dipisah arah `text_2` (in/out) seperti `fetchDropdowns` web. */
    fun observeCashflowJenis(): Flow<List<CashflowKind>> = observeRows("dropdown").map { rows ->
        rows.mapNotNull { row ->
            if (!row.text("kategori").lowercase().contains("cashflow")) return@mapNotNull null
            if (!row.text("jenis").lowercase().contains("jenis")) return@mapNotNull null
            CashflowKind(
                id = row.text("id"),
                idLama = row.text("id_lama"),
                nama = row.text("text_1"),
                arah = row.text("text_2").lowercase(),
            )
        }.sortedBy { it.nama.lowercase() }
    }

    /** Mekanik = user level 10 aktif, sama seperti filter web. */
    fun observeMekanik(): Flow<List<UserRow>> = observeUser().map { rows ->
        rows.filter { it.level == 10 && it.status.equals("active", ignoreCase = true) }
    }

    suspend fun accountBalance(id: String): BigDecimal =
        db.localRecordDao().find("dropdown", id)?.obj()?.number("number_1") ?: BigDecimal.ZERO

    /** Ada tidaknya record penanda (`id_lama`), dipakai gate tombol seperti `addbon`. */
    fun observeFlag(collection: String, idLama: String): Flow<Boolean> =
        observeRows(collection).map { rows -> rows.any { it.text("id_lama") == idLama } }

    fun observeUser(): Flow<List<UserRow>> = observeRows("user").map { rows ->
        rows.map { row ->
            UserRow(
                id = row.text("id"),
                name = row.text("name"),
                username = row.text("username"),
                level = row.int("level"),
                status = row.text("status"),
                email = row.text("email"),
                phone = row.text("phone"),
                linkImage = row.text("link_image"),
                number1 = row.number("number"),
                emailVisibility = row.text("emailVisibility").ifBlank { "true" } != "false",
                verified = row.text("verified").equals("true", ignoreCase = true),
            )
        }
    }

    suspend fun produkById(id: String): Produk? =
        db.localRecordDao().find("produk", id)?.obj()?.let(::produk)

    suspend fun searchProduk(query: String): List<Produk> =
        db.localRecordDao().search("produk", query.lowercase()).map { produk(it.obj()) }

    /** Riwayat stok produk (5 per halaman, terbaru dulu), sama seperti `fetchLogHistory` web. */
    suspend fun productLogs(productId: String, page: Int, perPage: Int = 5): Pair<List<ProductLog>, Int> {
        val rows = db.localRecordDao()
            .byJsonFragment("log_stock", "\"item_baru\":\"$productId\"")
            .mapNotNull { entity ->
                val row = entity.object_() ?: return@mapNotNull null
                ProductLog(
                    id = entity.id,
                    createdAt = row.text("created_at").ifBlank { row.text("created") },
                    operator = row.text("operator"),
                    direction = row.text("boolean"),
                    qty = row.number("qty"),
                    price = row.number("price_1"),
                    refBaru = row.text("ref_baru"),
                )
            }
            .sortedByDescending { it.createdAt }
        val pages = if (perPage <= 0) 1 else maxOf(1, (rows.size + perPage - 1) / perPage)
        val current = page.coerceIn(1, pages)
        return rows.drop((current - 1) * perPage).take(perPage) to pages
    }

    private fun produk(row: JsonObject) = Produk(
        id = row.text("id"),
        nama = row.text("nama"),
        idLama = row.text("id_lama"),
        kategori = row.text("kategori"),
        merk = row.text("merk"),
        jenis = row.text("jenis"),
        varian = row.text("varian"),
        tipe = row.text("tipe"),
        unit = row.text("unit"),
        barcode = row.text("barcode"),
        keterangan = row.text("keterangan"),
        stok = row.number("stok_3"),
        beli = row.number("beli"),
        sell1 = row.number("sell_1"),
        sell2 = row.number("sell_2"),
        sell3 = row.number("sell_3"),
        sell4 = row.number("sell_4"),
        sell5 = row.number("sell_5"),
        sell6 = row.number("sell_6"),
        min1 = row.number("min_1"),
        min2 = row.number("min_2"),
        min3 = row.number("min_3"),
        stok1 = row.number("stok_1"),
        stok2 = row.number("stok_2"),
        files = row.strings("file"),
        createdAt = row.text("created"),
    )

    private fun menu(row: JsonObject) = MenuRow(
        id = row.text("id"),
        person = row.text("person"),
        payment = row.text("payment"),
        total = row.number("total"),
        dibayar = row.number("dibayar"),
        status = row.text("status"),
        cashback = row.number("cashback"),
        note = row.text("note"),
        operator = row.text("operator"),
        createdAt = row.text("created_at"),
        idLama = row.text("id_lama"),
        jenis = row.text("jenis"),
        text = row.text("text"),
        qty = row.number("qty"),
        admin = row.number("admin"),
        marketplace = row.text("marketplace"),
        ref = row.text("ref"),
        files = row.strings("file"),
        tempo = row.text("tempo"),
        personBaru = row.text("person_baru"),
    )

    /**
     * Sub-koleksi nota dari cache. Web memakai `ref_baru` untuk `log_stock`/`ongkos`
     * dan `ref` untuk `cashflow`; pola yang sama dipakai di sini.
     */
    suspend fun menuDetail(menuId: String): MenuDetail {
        val dao = db.localRecordDao()
        val logs = dao.byJsonFragment("log_stock", "\"ref_baru\":\"$menuId\"")
        val cashflows = dao.byJsonFragment("cashflow", "\"ref\":\"$menuId\"")
        val ongkos = dao.byJsonFragment("ongkos", "\"ref_baru\":\"$menuId\"")

        val items = logs.mapNotNull { entity ->
            val row = entity.object_() ?: return@mapNotNull null
            val code = row.text("item_baru").ifBlank { row.text("item") }
            val product = if (code.isNotBlank()) produkById(code) else null
            MenuItemDetail(
                id = entity.id,
                code = code,
                label = PosFeed.productLabel(product),
                qty = row.number("qty"),
                price = row.number("price_1"),
                cost = row.number("price_2"),
                direction = row.text("boolean"),
                stockStart = row.text("stok_awal").takeIf { it.isNotBlank() }?.toBigDecimalOrNull(),
                stockEnd = row.text("stok_akhir").takeIf { it.isNotBlank() }?.toBigDecimalOrNull(),
            )
        }.sortedBy { it.label.lowercase() }

        return MenuDetail(
            items = items,
            cashflows = cashflows.mapNotNull { entity ->
                val row = entity.object_() ?: return@mapNotNull null
                MenuCashflowDetail(
                    id = entity.id,
                    accountId = row.text("account_1"),
                    nominal = row.number("nominal"),
                    mutasi = row.text("mutasi"),
                    note = row.text("note"),
                    saldoAwal = row.text("saldo_awal").takeIf { it.isNotBlank() }?.toBigDecimalOrNull(),
                    saldoAkhir = row.text("saldo_akhir").takeIf { it.isNotBlank() }?.toBigDecimalOrNull(),
                )
            },
            ongkos = ongkos.mapNotNull { entity ->
                val row = entity.object_() ?: return@mapNotNull null
                MenuOngkosDetail(
                    id = entity.id,
                    person = row.text("person"),
                    ongkos = row.number("ongkos"),
                )
            },
        )
    }

    /** Nota yang terhubung ke log/ongkos yang cocok dengan pencarian, seperti sub-collection lookup web. */
    suspend fun searchRefs(query: String): Set<String> {
        val terms = query.trim().lowercase().split(Regex("\\s+")).filter { it.isNotBlank() }
        if (terms.isEmpty()) return emptySet()
        val dao = db.localRecordDao()
        val refs = mutableSetOf<String>()
        terms.forEach { term ->
            dao.search("log_stock", term, 100).forEach { entity ->
                entity.object_()?.text("ref_baru")?.takeIf { it.isNotBlank() }?.let(refs::add)
            }
            dao.search("ongkos", term, 100).forEach { entity ->
                entity.object_()?.text("ref_baru")?.takeIf { it.isNotBlank() }?.let(refs::add)
            }
        }
        return refs
    }
}
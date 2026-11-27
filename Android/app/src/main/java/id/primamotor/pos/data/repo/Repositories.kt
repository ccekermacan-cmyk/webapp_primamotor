package id.primamotor.pos.data.repo

import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.LocalRecordEntity
import id.primamotor.pos.domain.GajiDetails
import id.primamotor.pos.domain.GajiItem
import id.primamotor.pos.domain.GajiMath
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.math.BigDecimal

/** Field JSON dengan default aman. Server boleh menambah field; parser tidak gagal. */
fun JsonObject.text(field: String): String {
    val element = this[field] ?: return ""
    if (element is JsonNull) return ""
    return runCatching { element.jsonPrimitive.content }.getOrDefault("")
}

fun JsonObject.number(field: String): BigDecimal =
    text(field).takeIf { it.isNotBlank() }?.toBigDecimalOrNull() ?: BigDecimal.ZERO

fun JsonObject.int(field: String): Int = number(field).toInt()

data class Produk(
    val id: String,
    val nama: String,
    val idLama: String,
    val kategori: String,
    val merk: String,
    val varian: String,
    val tipe: String,
    val unit: String,
    val barcode: String,
    val stok: BigDecimal,
    val beli: BigDecimal,
    val sell1: BigDecimal,
    val sell2: BigDecimal,
    val sell3: BigDecimal,
    val min1: BigDecimal,
) {
    /** Harga dasar sesuai tingkat pelanggan (1..3), sama seperti web. */
    fun price(tier: Int): BigDecimal = when (tier) {
        2 -> sell2
        3 -> sell3
        else -> sell1
    }
}

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
)

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

data class PersonRow(
    val id: String,
    val nama: String,
    val keterangan: String,
    val jenis: String,
    val kategori: String,
)

data class UserRow(val id: String, val name: String, val username: String, val level: Int, val status: String)

private fun LocalRecordEntity.object_(): JsonObject? =
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
                )
            }
        }

    /**
     * Gaji bersifat pribadi: hanya baris milik [personId] pengguna yang dipancarkan,
     * walau pull menyimpan baris lain. Aturan server tetap otoritatif.
     */
    fun observeGajiSendiri(personId: String): Flow<List<GajiRow>> =
        db.localRecordDao().observeGroup("gaji", personId).map { rows ->
            rows.mapNotNull { entity ->
                val row = entity.obj()
                if (row.text("person") != personId) return@mapNotNull null
                GajiRow(
                    id = entity.id,
                    person = personId,
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
        }

    fun observePerson(): Flow<List<PersonRow>> = observeRows("dropdown").map { rows ->
        rows.mapNotNull { row ->
            if (row.text("kategori").lowercase() != "person") return@mapNotNull null
            PersonRow(
                id = row.text("id"),
                nama = row.text("text_1"),
                keterangan = row.text("text_2"),
                jenis = row.text("jenis"),
                kategori = row.text("kategori"),
            )
        }
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

    /** Mekanik = user level 10 aktif, sama seperti filter web. */
    fun observeMekanik(): Flow<List<UserRow>> = observeUser().map { rows ->
        rows.filter { it.level == 10 && it.status.equals("active", ignoreCase = true) }
    }

    suspend fun accountBalance(id: String): BigDecimal =
        db.localRecordDao().find("dropdown", id)?.obj()?.number("number_1") ?: BigDecimal.ZERO

    fun observeUser(): Flow<List<UserRow>> = observeRows("user").map { rows ->
        rows.map { row ->
            UserRow(
                id = row.text("id"),
                name = row.text("name"),
                username = row.text("username"),
                level = row.int("level"),
                status = row.text("status"),
            )
        }
    }

    suspend fun produkById(id: String): Produk? =
        db.localRecordDao().find("produk", id)?.obj()?.let(::produk)

    suspend fun searchProduk(query: String): List<Produk> =
        db.localRecordDao().search("produk", query.lowercase()).map { produk(it.obj()) }

    private fun produk(row: JsonObject) = Produk(
        id = row.text("id"),
        nama = row.text("nama"),
        idLama = row.text("id_lama"),
        kategori = row.text("kategori"),
        merk = row.text("merk"),
        varian = row.text("varian"),
        tipe = row.text("tipe"),
        unit = row.text("unit"),
        barcode = row.text("barcode"),
        stok = row.number("stok_3"),
        beli = row.number("beli"),
        sell1 = row.number("sell_1"),
        sell2 = row.number("sell_2"),
        sell3 = row.number("sell_3"),
        min1 = row.number("min_1"),
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
    )
}
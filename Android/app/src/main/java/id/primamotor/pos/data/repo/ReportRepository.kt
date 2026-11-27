package id.primamotor.pos.data.repo

import androidx.room.withTransaction
import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.LocalRecordEntity
import id.primamotor.pos.data.local.OutboxEntity
import id.primamotor.pos.data.local.OutboxOperationEntity
import id.primamotor.pos.data.local.OutboxStatus
import id.primamotor.pos.data.remote.SessionManager
import id.primamotor.pos.domain.RecordId
import id.primamotor.pos.domain.ReportLog
import id.primamotor.pos.domain.ReportOngkos
import id.primamotor.pos.domain.WibDate
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.math.BigDecimal
import java.net.URLEncoder
import java.time.LocalDate

/** Satu baris `report` hasil rekap Laravel, field sama dengan `ReportRecord` web. */
data class ReportRow(
    val id: String,
    val text: String,
    val createdAt: String,
    val omsetToko: BigDecimal,
    val omsetServis: BigDecimal,
    val omsetMinuman: BigDecimal,
    val labaPenjualan: BigDecimal,
    val labaService: BigDecimal,
    val labaMinuman: BigDecimal,
    val operasionalToko: BigDecimal,
    val pengeluaranLain: BigDecimal,
    val pemasukanLain: BigDecimal,
    val piutang: BigDecimal,
    val hutang: BigDecimal,
    val kasirToko: BigDecimal = BigDecimal.ZERO,
) {
    val omset: BigDecimal get() = omsetToko + omsetServis + omsetMinuman
    val labaKotor: BigDecimal get() = labaPenjualan + labaService + labaMinuman
    val pengeluaran: BigDecimal get() = operasionalToko + pengeluaranLain
    val labaBersih: BigDecimal get() = labaKotor + pemasukanLain - pengeluaran
}

/** Baris `log_stock` mentah menjadi model tab Log. */
fun LocalRecordEntity.toReportLog(): ReportLog? {
    val row = object_() ?: return null
    return ReportLog(
        id = id,
        createdAt = row.text("created_at").ifBlank { row.text("created") },
        operator = row.text("operator"),
        direction = row.text("boolean").ifBlank { row.text("mutasi") },
        item = row.text("item"),
        itemBaru = row.text("item_baru"),
        person = row.text("person"),
        qty = row.number("qty"),
        price1 = row.number("price_1"),
        price2 = row.number("price_2"),
        ref = row.text("ref"),
        refBaru = row.text("ref_baru"),
        note = row.text("note"),
    )
}

/** Baris `ongkos` mentah; web memfilter memakai field `date`, bukan `created_at`. */
fun LocalRecordEntity.toReportOngkos(): ReportOngkos? {
    val row = object_() ?: return null
    return ReportOngkos(
        id = id,
        idLama = row.text("id_lama"),
        person = row.text("person"),
        operator = row.text("operator"),
        ref = row.text("ref"),
        refBaru = row.text("ref_baru"),
        date = row.text("date").ifBlank { row.text("created_at") },
        ongkos = row.number("ongkos"),
    )
}

/**
 * Rekap laporan dari koleksi `report` (dihitung Laravel). Baca dari cache,
 * rekalkulasi dan hapus butuh jaringan seperti web.
 */
class ReportRepository(
    private val db: AppDatabase,
    private val sessions: SessionManager,
    private val apiUrl: String,
) {

    fun observe(): Flow<List<ReportRow>> = db.localRecordDao().observe("report").map { entities ->
        entities.map { entity ->
            val row = entity.object_() ?: JsonObject(emptyMap())
            ReportRow(
                id = entity.id,
                text = row.text("text"),
                createdAt = row.text("created_at"),
                omsetToko = row.number("omset_toko"),
                omsetServis = row.number("omset_servis"),
                omsetMinuman = row.number("omset_minuman"),
                labaPenjualan = row.number("laba_penjualan"),
                labaService = row.number("laba_service"),
                labaMinuman = row.number("laba_minuman"),
                operasionalToko = row.number("operasional_toko"),
                pengeluaranLain = row.number("pengeluaran_lain"),
                pemasukanLain = row.number("pemasukan_lain"),
                piutang = row.number("piutang"),
                hutang = row.number("hutang"),
                kasirToko = row.number("kasir_toko"),
            )
        }.sortedByDescending { it.createdAt }
    }

    /** `POST {API}/reports/recalculate`; server Laravel menghitung ulang satu tanggal. */
    suspend fun recalculate(date: String) = withContext(Dispatchers.IO) {
        sessions.laravelPost(
            apiUrl,
            "/reports/recalculate",
            buildJsonObject { put("date", date) },
        )
        Unit
    }

    /**
     * Tarik satu hari dari server seperti `fetchReportDetails` web: `menu`, `log_stock`,
     * `cashflow`, `ongkos` (field `date`), plus rekap `report` hari itu. Offline tidak
     * mengubah cache; UI tetap memakai isi Room.
     */
    suspend fun pullDay(dateKey: String): Boolean = withContext(Dispatchers.IO) {
        runCatching {
            val day = LocalDate.parse(dateKey)
            val start = WibDate.startOfDayIso(day)
            val end = WibDate.startOfDayIso(day.plusDays(1))
            val createdExpr = "created_at >= \"$start\" && created_at < \"$end\""
            val dateExpr = "date >= \"$start\" && date < \"$end\""
            listOf(
                Triple("menu", createdExpr, listOf("text", "person", "id_lama")),
                Triple("log_stock", createdExpr, listOf("item", "id_lama")),
                Triple("cashflow", createdExpr, listOf("note", "person", "jenis", "mutasi")),
                Triple("ongkos", dateExpr, listOf("person")),
                Triple("report", createdExpr, listOf("kasir_toko")),
            ).forEach { (collection, expression, fields) ->
                fetchRange(collection, expression, fields, dateKey)
            }
            true
        }.getOrDefault(false)
    }

    private suspend fun fetchRange(collection: String, expression: String, fields: List<String>, day: String) {
        var page = 1
        while (true) {
            val path = "/api/collections/$collection/records?perPage=200&page=$page" +
                "&sort=" + if (collection == "ongkos") "date" else "created_at" +
                "&filter=" + encode(expression)
            val items = (sessions.call(path) as? JsonObject)?.get("items") as? JsonArray ?: break
            val entities = items.mapNotNull { item -> (item as? JsonObject)?.let { entityOf(collection, it, fields, day) } }
            // Jangan menimpa baris lokal yang masih menunggu dikirim.
            val safe = entities.filter { entity ->
                db.localRecordDao().find(collection, entity.id)?.dirty != 1
            }
            if (safe.isNotEmpty()) db.localRecordDao().upsertAll(safe)
            if (items.size < 200) break
            page += 1
        }
    }

    private fun entityOf(collection: String, item: JsonObject, fields: List<String>, day: String): LocalRecordEntity? {
        val id = item.text("id").ifBlank { return null }
        val rawDate = if (collection == "ongkos") item.text("date") else item.text("created_at")
        val dateKey = WibDate.dayOf(rawDate)?.toString().orEmpty().ifBlank { day }
        return LocalRecordEntity(
            collection = collection,
            id = id,
            dateKey = dateKey,
            groupKey = item.text("person"),
            text = fields.mapNotNull { field -> item.text(field).takeIf { it.isNotBlank() } }
                .joinToString(" ") { it.lowercase() },
            json = item.toString(),
            dirty = 0,
            updatedAt = 0L,
        )
    }

    /**
     * `Sesuaikan Harga Beli Hari Ini` web: setiap `log_stock` mutasi `out` mendapat
     * `price_2 = produk.beli x qty`. Perubahan masuk outbox, bukan tulis langsung.
     */
    suspend fun fixHargaBeli(dateKey: String): Int = withContext(Dispatchers.IO) {
        val logs = db.localRecordDao().inRange("log_stock", dateKey, dateKey)
        val products = db.localRecordDao().all("produk").mapNotNull { entity ->
            entity.object_()?.let { entity.id to it.number("beli") }
        }.toMap()
        var changed = 0
        db.withTransaction {
            logs.forEach { entity ->
                val row = entity.object_() ?: return@forEach
                val direction = row.text("mutasi").ifBlank { row.text("boolean") }.lowercase()
                if (direction != "out") return@forEach
                val qty = row.number("qty")
                val cost = (products[row.text("item_baru")] ?: BigDecimal.ZERO).multiply(qty)
                if (row.number("price_2").compareTo(cost) == 0) return@forEach
                val updated = JsonObject(row + ("price_2" to JsonPrimitive(cost)))
                db.localRecordDao().upsertAll(
                    listOf(entity.copy(json = updated.toString(), dirty = 1, updatedAt = System.currentTimeMillis())),
                )
                enqueueUpdate("log_stock", entity.id, updated)
                changed += 1
            }
        }
        changed
    }

    /** Hapus rekap lewat outbox, sama seperti tombol hapus report web. */
    suspend fun delete(id: String): Boolean = db.withTransaction {
        val existing = db.localRecordDao().find("report", id) ?: return@withTransaction false
        db.localRecordDao().delete("report", id)
        val requestId = RecordId.create(24)
        db.outboxDao().enqueueWithOperations(
            OutboxEntity(requestId, OutboxStatus.PENDING, System.currentTimeMillis(), "{}"),
            listOf(
                OutboxOperationEntity(
                    requestId = requestId,
                    seq = 1,
                    collection = "report",
                    method = "delete",
                    recordId = id,
                    payloadJson = (existing.object_() ?: JsonObject(emptyMap())).toString(),
                ),
            ),
        )
        true
    }

    private suspend fun enqueueUpdate(collection: String, id: String, json: JsonObject) {
        val requestId = RecordId.create(24)
        db.outboxDao().enqueueWithOperations(
            OutboxEntity(requestId, OutboxStatus.PENDING, System.currentTimeMillis(), "{}"),
            listOf(
                OutboxOperationEntity(
                    requestId = requestId,
                    seq = 1,
                    collection = collection,
                    method = "update",
                    recordId = id,
                    payloadJson = json.toString(),
                ),
            ),
        )
    }

    private fun encode(value: String): String =
        URLEncoder.encode(value, "UTF-8").replace("+", "%20")
}

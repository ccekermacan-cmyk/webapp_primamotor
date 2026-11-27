package id.primamotor.pos.data.repo

import androidx.room.withTransaction
import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.OutboxEntity
import id.primamotor.pos.data.local.OutboxOperationEntity
import id.primamotor.pos.data.local.OutboxStatus
import id.primamotor.pos.data.remote.SessionManager
import id.primamotor.pos.domain.RecordId
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.math.BigDecimal

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
) {
    val omset: BigDecimal get() = omsetToko + omsetServis + omsetMinuman
    val labaKotor: BigDecimal get() = labaPenjualan + labaService + labaMinuman
    val pengeluaran: BigDecimal get() = operasionalToko + pengeluaranLain
    val labaBersih: BigDecimal get() = labaKotor + pemasukanLain - pengeluaran
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
}

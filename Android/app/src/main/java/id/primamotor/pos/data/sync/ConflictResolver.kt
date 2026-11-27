package id.primamotor.pos.data.sync

import androidx.room.withTransaction
import id.primamotor.pos.data.ledger.CashflowEntry
import id.primamotor.pos.data.ledger.LocalLedger
import id.primamotor.pos.data.ledger.StockEntry
import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.LocalRecordEntity
import id.primamotor.pos.data.local.OutboxEntity
import id.primamotor.pos.data.local.OutboxOperationEntity
import id.primamotor.pos.data.local.OutboxStatus
import id.primamotor.pos.domain.WibDate
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.math.BigDecimal

/**
 * Transaksi yang ditolak server berhenti di `needs_review`. Kasir memilih:
 * - [retry]: kirim ulang batch yang sama setelah data lokal dikoreksi.
 * - [void]: batalkan, lalu balik efek stok/saldo lokal agar cache cocok dengan server.
 *
 * Pembatalan menu hapus hanya mengembalikan baris menu: anak transaksi dihapus server lewat
 * cascade dan payload batch tidak memuat salinannya.
 */
class ConflictResolver(private val db: AppDatabase) {

    fun observeOpen(): Flow<List<OutboxEntity>> = db.outboxDao().observeNeedsReview()

    fun pendingCount(): Flow<Int> = db.outboxDao().pendingCount()

    suspend fun retry(requestId: String) =
        db.outboxDao().setStatus(requestId, OutboxStatus.PENDING, null)

    suspend fun void(requestId: String) = db.withTransaction {
        db.outboxDao().operations(requestId)
            .sortedByDescending { it.seq }
            .forEach { reverse(it) }
        db.outboxDao().setStatus(requestId, OutboxStatus.VOID, "Dibatalkan kasir")
    }

    private suspend fun reverse(operation: OutboxOperationEntity) {
        val body = parse(operation.payloadJson) ?: return
        when (operation.method) {
            "create" -> {
                reverseEffects(operation.collection, body)
                db.localRecordDao().delete(operation.collection, operation.recordId)
            }

            "delete" -> {
                applyEffects(operation.collection, body)
                db.localRecordDao().upsertAll(listOf(cleanRow(operation.collection, operation.recordId, body)))
            }

            "update" -> {
                val expected = body["atomic_expected"]?.jsonPrimitive?.content?.let(::parse) ?: return
                db.localRecordDao().upsertAll(listOf(cleanRow(operation.collection, operation.recordId, expected)))
            }
        }
    }

    /** Membalik efek baris yang tadinya dibuat lokal. */
    private suspend fun reverseEffects(collection: String, body: JsonObject) {
        ledgerDeltas(collection, body).forEach { (key, delta) -> bump(key, delta.negate()) }
    }

    /** Menerapkan kembali efek baris yang tadinya dihapus lokal. */
    private suspend fun applyEffects(collection: String, body: JsonObject) {
        ledgerDeltas(collection, body).forEach { (key, delta) -> bump(key, delta) }
    }

    /** Kunci `stok:<produk>` atau `kas:<akun>`, nilainya delta bertanda. */
    private fun ledgerDeltas(collection: String, body: JsonObject): Map<String, BigDecimal> = when (collection) {
        "log_stock" -> {
            val entry = StockEntry(body.text("item_baru"), body.number("qty"), body.text("boolean"))
            LocalLedger.stockDeltas(entry).values.mapKeys { (id, _) -> "stok:$id" }
        }

        "cashflow" -> {
            val entry = CashflowEntry(
                account1 = body.text("account_1"),
                account2 = body.text("account_2"),
                nominal = body.number("nominal"),
                mutasi = body.text("mutasi"),
                jenis = body.text("jenis"),
            )
            LocalLedger.cashDeltas(entry).values.mapKeys { (id, _) -> "kas:$id" }
        }

        else -> emptyMap()
    }

    private suspend fun bump(key: String, delta: BigDecimal) {
        if (delta.signum() == 0) return
        val collection = if (key.startsWith("stok:")) "produk" else "dropdown"
        val field = if (collection == "produk") "stok_3" else "number_1"
        val id = key.substringAfter(':')
        val entity = db.localRecordDao().find(collection, id) ?: return
        val obj = parse(entity.json) ?: return
        val next = buildJsonObject {
            obj.forEach { (name, value) -> put(name, value) }
            put(field, obj.number(field) + delta)
        }
        db.localRecordDao().upsertAll(listOf(entity.copy(json = next.toString())))
    }

    private fun cleanRow(collection: String, id: String, body: JsonObject): LocalRecordEntity {
        val createdAt = body.text("created_at")
        return LocalRecordEntity(
            collection = collection,
            id = id,
            dateKey = WibDate.dayOf(createdAt)?.toString().orEmpty(),
            groupKey = body.text("person"),
            text = body.text("nama").ifBlank { body.text("text") }.lowercase(),
            json = body.toString(),
            dirty = 0,
            updatedAt = System.currentTimeMillis(),
        )
    }

    private fun parse(raw: String): JsonObject? =
        runCatching { Json.parseToJsonElement(raw) as? JsonObject }.getOrNull()

    private fun JsonObject.text(key: String): String = this[key]?.jsonPrimitive?.content.orEmpty()

    private fun JsonObject.number(key: String): BigDecimal =
        this[key]?.jsonPrimitive?.content?.let { runCatching { it.toBigDecimal() }.getOrNull() }
            ?: BigDecimal.ZERO
}

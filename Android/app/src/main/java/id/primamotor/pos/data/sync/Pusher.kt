package id.primamotor.pos.data.sync

import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.OutboxOperationEntity
import id.primamotor.pos.data.local.OutboxStatus
import id.primamotor.pos.data.remote.BatchOperation
import id.primamotor.pos.data.remote.BatchResult
import id.primamotor.pos.data.remote.PocketBaseException
import id.primamotor.pos.data.remote.SessionManager
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive

sealed interface PushOutcome {
    /** Tidak ada transaksi menunggu. */
    data object Idle : PushOutcome

    /** Transaksi terdepan sudah dikonfirmasi server. */
    data object Done : PushOutcome

    /** Belum pasti; coba lagi nanti dengan backoff, jangan kirim ulang isi batch. */
    data class RetryLater(val reason: String) : PushOutcome

    /** Server menolak atau membatalkan. Kasir harus memutuskan; tidak ada retry otomatis. */
    data class NeedsReview(val requestId: String, val reason: String) : PushOutcome
}

/**
 * Mengirim antrean outbox satu per satu, FIFO.
 *
 * Aturan receipt: payload diperlakukan ambigu sampai `resolve` menjawab committed.
 * Karena itu kegagalan apa pun (timeout, 5xx, konfirmasi tidak lengkap) ditanyakan
 * ke server lebih dulu, bukan dikirim ulang.
 */
class Pusher(
    private val db: AppDatabase,
    private val sessions: SessionManager,
) {
    suspend fun pushNext(): PushOutcome {
        val entry = db.outboxDao().oldestPending() ?: return PushOutcome.Idle
        if (sessions.currentToken() == null) {
            return PushOutcome.RetryLater("Sesi berakhir. Login ulang untuk sinkronisasi.")
        }

        db.outboxDao().markAttempt(entry.requestId, OutboxStatus.SENDING, null)
        val operations = db.outboxDao().operations(entry.requestId)
        if (operations.isEmpty()) {
            db.outboxDao().setStatus(entry.requestId, OutboxStatus.FAILED, "Outbox tanpa operasi")
            return PushOutcome.NeedsReview(entry.requestId, "Outbox tanpa operasi")
        }

        val batch = operations.map { operation ->
            BatchOperation(
                method = httpMethod(operation),
                path = pathOf(operation),
                body = parse(operation.payloadJson),
            )
        }

        return try {
            val results = sessions.batch(entry.requestId, batch)
            if (confirmed(results, operations.size)) {
                markDone(entry.requestId, operations)
                PushOutcome.Done
            } else {
                resolveThenDecide(entry.requestId, "Konfirmasi commit batch tidak lengkap.")
            }
        } catch (error: PocketBaseException) {
            resolveThenDecide(entry.requestId, error.message ?: "Gagal mengirim transaksi.")
        }
    }

    private suspend fun resolveThenDecide(requestId: String, reason: String): PushOutcome =
        try {
            val resolution = sessions.resolve(requestId)
            if (resolution.committed) {
                markDone(requestId, db.outboxDao().operations(requestId))
                PushOutcome.Done
            } else {
                db.outboxDao().setStatus(requestId, OutboxStatus.NEEDS_REVIEW, reason)
                PushOutcome.NeedsReview(requestId, reason)
            }
        } catch (error: PocketBaseException) {
            // Status masih ambigu: kembalikan ke pending supaya dicoba lagi, isi batch tidak diubah.
            db.outboxDao().setStatus(requestId, OutboxStatus.PENDING, error.message)
            PushOutcome.RetryLater(error.message ?: "Status transaksi belum dapat dikonfirmasi.")
        }

    private suspend fun markDone(requestId: String, operations: List<OutboxOperationEntity>) {
        operations.forEach { operation ->
            if (operation.method != "delete") {
                db.localRecordDao().clearDirty(operation.collection, operation.recordId)
            }
        }
        db.outboxDao().setStatus(requestId, OutboxStatus.SENT, null)
    }

    /** PocketBase mengembalikan satu hasil per operasi ditambah satu konfirmasi commit. */
    private fun confirmed(results: List<BatchResult>, operationCount: Int): Boolean =
        results.size == operationCount + 1 &&
            results.dropLast(1).all { it.status in 200..299 } &&
            results.last().body?.get("atomic")?.jsonPrimitive?.content == "true"

    private fun httpMethod(operation: OutboxOperationEntity): String = when (operation.method) {
        "create" -> "POST"
        "update" -> "PATCH"
        "delete" -> "DELETE"
        else -> error("Metode outbox tidak dikenal: ${operation.method}")
    }

    private fun pathOf(operation: OutboxOperationEntity): String =
        when (operation.method) {
            "create" -> "/api/collections/${operation.collection}/records"
            else -> "/api/collections/${operation.collection}/records/${operation.recordId}"
        }

    private fun parse(raw: String): JsonElement =
        runCatching { Json.parseToJsonElement(raw) }.getOrElse { JsonNull }

    @Suppress("unused")
    private fun JsonObject.atomicFlag(): Boolean = this["atomic"]?.jsonPrimitive?.content == "true"
}
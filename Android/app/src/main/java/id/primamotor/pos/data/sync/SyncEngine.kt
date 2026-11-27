package id.primamotor.pos.data.sync

import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.OutboxStatus
import id.primamotor.pos.data.local.SyncStateEntity
import id.primamotor.pos.data.remote.SessionManager
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Satu siklus sinkron: **push dulu, lalu pull**.
 * Push berhenti pada kegagalan pertama supaya efek transaksi tetap berurutan.
 */
class SyncEngine(
    private val db: AppDatabase,
    private val sessions: SessionManager,
    private val pusher: Pusher,
    private val puller: Puller,
) {
    private val gate = Mutex()

    /** Satu siklus pada satu waktu; worker latar dan tombol manual tidak saling menimpa. */
    suspend fun run(): Outcome = gate.withLock { runLocked() }

    private suspend fun runLocked(): Outcome {
        db.outboxDao().requeueInterrupted()

        var pushed = 0
        var blocked: PushOutcome? = null
        while (true) {
            when (val outcome = pusher.pushNext()) {
                PushOutcome.Idle, PushOutcome.Done -> {
                    if (outcome is PushOutcome.Done) pushed += 1 else break
                }
                is PushOutcome.RetryLater -> { blocked = outcome; break }
                is PushOutcome.NeedsReview -> { blocked = outcome; break }
            }
        }

        if (sessions.currentToken() == null) {
            return Outcome(pushed, 0, blocked, error = "Sesi berakhir. Login ulang untuk sinkronisasi.")
        }
        val result = runCatching { puller.pull() }
        val pulled = result.getOrNull()
        if (pulled != null) {
            db.syncStateDao().upsert(
                SyncStateEntity(
                    collection = SYNC_STATE,
                    lastSyncAt = System.currentTimeMillis(),
                    status = "ok",
                ),
            )
        } else {
            db.syncStateDao().upsert(
                SyncStateEntity(
                    collection = SYNC_STATE,
                    lastSyncAt = db.syncStateDao().find(SYNC_STATE)?.lastSyncAt ?: 0L,
                    status = "error",
                ),
            )
        }
        return Outcome(pushed, pulled?.records ?: 0, blocked, result.exceptionOrNull()?.message)
    }

    data class Outcome(val pushed: Int, val pulled: Int, val blocked: PushOutcome?, val error: String? = null)

    companion object {
        const val SYNC_STATE = "sync"
    }

    suspend fun pendingCount(): Int = db.outboxDao().count()

    @Suppress("unused")
    private fun needsReviewStatus() = OutboxStatus.NEEDS_REVIEW
}
package id.primamotor.pos.data.sync

import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.OutboxStatus
import id.primamotor.pos.data.remote.SessionManager

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
    suspend fun run(): Outcome {
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
            return Outcome(pushed, 0, blocked)
        }
        val pulled = runCatching { puller.pull() }.getOrNull()
        return Outcome(pushed, pulled?.records ?: 0, blocked)
    }

    data class Outcome(val pushed: Int, val pulled: Int, val blocked: PushOutcome?)

    suspend fun pendingCount(): Int = db.outboxDao().count()

    @Suppress("unused")
    private fun needsReviewStatus() = OutboxStatus.NEEDS_REVIEW
}
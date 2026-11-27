package id.primamotor.pos.data.local

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class DatabaseTest {

    private lateinit var db: AppDatabase

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java)
            .allowMainThreadQueries()
            .build()
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun outbox_row_keeps_payload_and_status() = runBlocking {
        db.outboxDao().enqueue(
            OutboxEntity(requestId = "r1", status = OutboxStatus.PENDING, createdAt = 1L, payloadJson = "{}"),
        )
        val oldest = db.outboxDao().oldestPending()
        assertEquals("r1", oldest?.requestId)
        assertEquals("{}", oldest?.payloadJson)
    }

    @Test
    fun enqueue_with_same_request_id_does_not_duplicate() = runBlocking {
        db.outboxDao().enqueue(OutboxEntity(requestId = "r1", status = OutboxStatus.PENDING, createdAt = 1L, payloadJson = "{}"))
        db.outboxDao().enqueue(OutboxEntity(requestId = "r1", status = OutboxStatus.PENDING, createdAt = 2L, payloadJson = "{}"))
        assertEquals(1, db.outboxDao().count())
    }

    @Test
    fun pull_deletes_missing_rows_but_keeps_dirty_ones() = runBlocking {
        db.localRecordDao().upsertAll(
            listOf(
                record("menu", "a", "2026-10-18"),
                record("menu", "b", "2026-10-18"),
                record("menu", "c", "2026-10-18").copy(dirty = 1),
            ),
        )

        db.localRecordDao().deleteMissing("menu", "2026-10-01", "2026-10-31", listOf("a"))

        assertEquals(
            listOf("a", "c"),
            db.localRecordDao().idsInRange("menu", "2026-10-01", "2026-10-31").sorted(),
        )
    }

    @Test
    fun upsert_replaces_payload_and_clears_dirty() = runBlocking {
        db.localRecordDao().upsertAll(listOf(record("menu", "a", "2026-10-18").copy(dirty = 1, json = "old")))
        db.localRecordDao().upsertAll(listOf(record("menu", "a", "2026-10-18").copy(dirty = 0, json = "new")))

        assertEquals("new", db.localRecordDao().find("menu", "a")?.json)
        assertEquals(0, db.localRecordDao().find("menu", "a")?.dirty)
    }

    @Test
    fun outbox_operations_keep_order_per_request() = runBlocking {
        db.outboxDao().enqueue(OutboxEntity(requestId = "r1", status = OutboxStatus.PENDING, createdAt = 1L, payloadJson = "{}"))
        db.outboxDao().insertOperations(
            listOf(
                OutboxOperationEntity(requestId = "r1", seq = 1, collection = "menu", method = "create", recordId = "m1", payloadJson = "{}"),
                OutboxOperationEntity(requestId = "r1", seq = 2, collection = "cashflow", method = "create", recordId = "c1", payloadJson = "{}"),
            ),
        )

        assertEquals(
            listOf("menu", "cashflow"),
            db.outboxDao().operations("r1").map { it.collection },
        )
    }

    @Test
    fun status_update_is_visible_on_next_read() = runBlocking {
        db.outboxDao().enqueue(OutboxEntity(requestId = "r1", status = OutboxStatus.PENDING, createdAt = 1L, payloadJson = "{}"))
        db.outboxDao().setStatus("r1", OutboxStatus.SENT, lastError = null)

        assertNull(db.outboxDao().oldestPending())
        assertEquals("sent", db.outboxDao().find("r1")?.status)
    }

    @Test
    fun logout_cleanup_keeps_dirty_gaji_rows() = runBlocking {
        db.localRecordDao().upsertAll(
            listOf(
                record("gaji", "g1", "2026-10-18"),
                record("gaji", "g2", "2026-10-18").copy(dirty = 1),
            ),
        )

        db.outboxDao().enqueue(
            id.primamotor.pos.data.local.OutboxEntity("req-keep", id.primamotor.pos.data.local.OutboxStatus.PENDING, 1L, "{}"),
        )

        db.localRecordDao().deleteCleanCollection("gaji")

        assertEquals(listOf("g2"), db.localRecordDao().idsInRange("gaji", "0000-01-01", "9999-12-31"))
        assertEquals(1, db.outboxDao().count())
    }

    private fun record(collection: String, id: String, dateKey: String) = LocalRecordEntity(
        collection = collection,
        id = id,
        dateKey = dateKey,
        groupKey = "",
        text = id,
        json = "{}",
        dirty = 0,
        updatedAt = 0L,
    )
}
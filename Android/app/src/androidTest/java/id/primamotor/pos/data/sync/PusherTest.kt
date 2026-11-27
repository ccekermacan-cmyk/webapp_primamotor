package id.primamotor.pos.data.sync

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.LocalRecordEntity
import id.primamotor.pos.data.local.OutboxEntity
import id.primamotor.pos.data.local.OutboxOperationEntity
import id.primamotor.pos.data.local.OutboxStatus
import id.primamotor.pos.data.remote.SessionManager
import id.primamotor.pos.data.remote.TokenStore
import id.primamotor.pos.data.remote.UserSession
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.SocketPolicy
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class PusherTest {

    private lateinit var db: AppDatabase
    private lateinit var server: MockWebServer
    private lateinit var pusher: Pusher
    private lateinit var store: MemoryStore

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).allowMainThreadQueries().build()
        server = MockWebServer()
        server.start()
        store = MemoryStore()
        store.save(UserSession("u1", "kasir", "Kasir", 2, "active", "t1"))
        val client = id.primamotor.pos.data.remote.PocketBaseClient(
            baseUrl = server.url("/").toString().trimEnd('/'),
            http = OkHttpClient.Builder().callTimeout(500, TimeUnit.MILLISECONDS).build(),
        )
        pusher = Pusher(db, SessionManager(client, store))
    }

    @After
    fun tearDown() {
        db.close()
        server.shutdown()
    }

    @Test
    fun success_marks_sent_and_clears_dirty() = runBlocking {
        seed(requestId = "r1", createdAt = 1L)
        server.enqueue(
            MockResponse().setBody("""[{"status":200,"body":{"id":"m1"}},{"status":200,"body":{"atomic":true}}]"""),
        )

        val outcome = pusher.pushNext()

        assertEquals(PushOutcome.Done, outcome)
        assertEquals(OutboxStatus.SENT, db.outboxDao().find("r1")!!.status)
        assertEquals(0, db.localRecordDao().dirtyCount("menu"))
        assertEquals(1, server.requestCount)
    }

    @Test
    fun lost_response_but_committed_is_treated_as_success() = runBlocking {
        seed(requestId = "r1", createdAt = 1L)
        server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AT_START))
        server.enqueue(MockResponse().setBody("""{"status":"committed","results":[{"status":200,"body":{"atomic":true}}]}"""))

        val outcome = pusher.pushNext()

        assertEquals(PushOutcome.Done, outcome)
        assertEquals(OutboxStatus.SENT, db.outboxDao().find("r1")!!.status)
        assertEquals(2, server.requestCount)
    }

    @Test
    fun cancelled_request_needs_review_and_is_not_retried() = runBlocking {
        seed(requestId = "r1", createdAt = 1L)
        server.enqueue(MockResponse().setResponseCode(400).setBody("""{"message":"stok tidak cukup"}"""))
        server.enqueue(MockResponse().setBody("""{"status":"cancelled"}"""))

        val first = pusher.pushNext()
        val second = pusher.pushNext()

        assertTrue(first is PushOutcome.NeedsReview)
        assertEquals(OutboxStatus.NEEDS_REVIEW, db.outboxDao().find("r1")!!.status)
        assertEquals(PushOutcome.Idle, second)
        assertEquals(2, server.requestCount)
    }

    @Test
    fun oldest_pending_is_pushed_before_newer_one() = runBlocking {
        seed(requestId = "r2", createdAt = 2L)
        seed(requestId = "r1", createdAt = 1L)
        server.enqueue(
            MockResponse().setBody("""[{"status":200,"body":{"id":"m-r1"}},{"status":200,"body":{"atomic":true}}]"""),
        )

        pusher.pushNext()

        assertEquals(OutboxStatus.SENT, db.outboxDao().find("r1")!!.status)
        assertEquals(OutboxStatus.PENDING, db.outboxDao().find("r2")!!.status)
        assertEquals(1, server.requestCount)
    }

    @Test
    fun network_failure_without_resolution_stays_pending_for_retry() = runBlocking {
        seed(requestId = "r1", createdAt = 1L)
        server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.NO_RESPONSE))
        server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.NO_RESPONSE))

        val outcome = pusher.pushNext()

        assertEquals(PushOutcome.RetryLater::class, outcome::class)
        assertEquals(OutboxStatus.PENDING, db.outboxDao().find("r1")!!.status)
        assertEquals(1, db.outboxDao().find("r1")!!.attempts)
    }

    @Test
    fun empty_outbox_is_idle() = runBlocking {
        assertEquals(PushOutcome.Idle, pusher.pushNext())
        assertEquals(0, server.requestCount)
    }

    @Test
    fun no_token_fails_without_touching_network() = runBlocking {
        seed(requestId = "r1", createdAt = 1L)
        store.clear()

        val outcome = pusher.pushNext()

        assertTrue(outcome is PushOutcome.RetryLater)
        assertEquals(0, server.requestCount)
        assertEquals(OutboxStatus.PENDING, db.outboxDao().find("r1")!!.status)
    }

    private suspend fun seed(requestId: String, createdAt: Long) {
        db.localRecordDao().upsertAll(
            listOf(
                LocalRecordEntity(
                    collection = "menu",
                    id = "m-$requestId",
                    dateKey = "2026-10-18",
                    groupKey = "",
                    text = "nota",
                    json = Json.parseToJsonElement("""{"id":"m-$requestId","total":1000}""").toString(),
                    dirty = 1,
                ),
            ),
        )
        db.outboxDao().enqueueWithOperations(
            OutboxEntity(requestId = requestId, status = OutboxStatus.PENDING, createdAt = createdAt, payloadJson = "{}"),
            listOf(
                OutboxOperationEntity(
                    requestId = requestId,
                    seq = 1,
                    collection = "menu",
                    method = "create",
                    recordId = "m-$requestId",
                    payloadJson = """{"id":"m-$requestId","total":1000}""",
                ),
            ),
        )
    }
}

private class MemoryStore : TokenStore {
    private var session: UserSession? = null
    override fun token(): String? = session?.token
    override fun save(session: UserSession) { this.session = session }
    override fun clear() { session = null }
}
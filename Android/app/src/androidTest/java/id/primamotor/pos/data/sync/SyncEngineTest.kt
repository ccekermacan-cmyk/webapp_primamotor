package id.primamotor.pos.data.sync

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.remote.PocketBaseClient
import id.primamotor.pos.data.remote.SessionManager
import id.primamotor.pos.data.remote.TokenStore
import id.primamotor.pos.data.remote.UserSession
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SyncEngineTest {

    private lateinit var db: AppDatabase
    private lateinit var server: MockWebServer
    private lateinit var engine: SyncEngine
    private lateinit var store: EngineStore

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).allowMainThreadQueries().build()
        server = MockWebServer()
        server.start()
        store = EngineStore()
        val client = PocketBaseClient(
            baseUrl = server.url("/").toString().trimEnd('/'),
            http = OkHttpClient(),
        )
        val sessions = SessionManager(client, store)
        engine = SyncEngine(db, sessions, Pusher(db, sessions), Puller(db, sessions), MediaUploader(db, sessions))
    }

    @After
    fun tearDown() {
        db.close()
        server.shutdown()
    }

    @Test
    fun successful_pull_marks_sync_state_ok() = runBlocking {
        respondWith { """{"page":1,"totalItems":0,"items":[]}""" }

        val outcome = engine.run()

        assertEquals(0, outcome.pulled)
        assertNull(outcome.error)
        val state = db.syncStateDao().find(SyncEngine.SYNC_STATE)!!
        assertEquals("ok", state.status)
        assertTrue(state.lastSyncAt > 0)
    }

    @Test
    fun failed_pull_reports_error_instead_of_failing_silently() = runBlocking {
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse =
                MockResponse().setResponseCode(500).setBody("""{"message":"boom"}""")
        }

        val outcome = engine.run()

        assertNotNull(outcome.error)
        val state = db.syncStateDao().find(SyncEngine.SYNC_STATE)!!
        assertEquals("error", state.status)
    }

    @Test
    fun missing_session_reports_error_without_pull() = runBlocking {
        store.clear()

        val outcome = engine.run()

        assertEquals(0, outcome.pulled)
        assertNotNull(outcome.error)
    }

    private fun respondWith(body: () -> String) {
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse = MockResponse().setBody(body())
        }
    }
}

private class EngineStore : TokenStore {
    private var session: UserSession? = null

    init {
        save(UserSession("u1", "kasir", "Kasir", 2, "active", "t1"))
    }

    override fun token(): String? = session?.token
    override fun save(session: UserSession) { this.session = session }
    override fun clear() { session = null }
}

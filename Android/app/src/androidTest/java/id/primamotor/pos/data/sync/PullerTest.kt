package id.primamotor.pos.data.sync

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.LocalRecordEntity
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PullerTest {

    private lateinit var db: AppDatabase
    private lateinit var server: MockWebServer
    private lateinit var puller: Puller

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).allowMainThreadQueries().build()
        server = MockWebServer()
        server.start()
        val store = Store()
        store.save(UserSession("u1", "kasir", "Kasir", 2, "active", "t1"))
        val client = PocketBaseClient(
            baseUrl = server.url("/").toString().trimEnd('/'),
            http = OkHttpClient(),
        )
        puller = Puller(db, SessionManager(client, store))
    }

    @After
    fun tearDown() {
        db.close()
        server.shutdown()
    }

    @Test
    fun reference_collection_is_pulled_with_search_text() = runBlocking {
        respondWith(mapOf("produk" to """[{"id":"p1","nama":"Oli Mesin","id_lama":"A1","barcode":"899"}]"""))

        puller.pull()

        val record = db.localRecordDao().find("produk", "p1")!!
        assertTrue(record.text.contains("oli mesin"))
        assertTrue(record.text.contains("899"))
        assertEquals("", record.dateKey)
        assertEquals(0, record.dirty)
    }

    @Test
    fun financial_pull_uses_created_at_window() = runBlocking {
        val paths = mutableListOf<String>()
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                paths += request.path.orEmpty()
                return MockResponse().setBody("""{"page":1,"totalItems":0,"items":[]}""")
            }
        }

        puller.pull()

        val cashflowRequest = paths.first { it.contains("/collections/cashflow/") }
        assertTrue("filter tanggal hilang: $cashflowRequest", cashflowRequest.contains("created_at%3E%3D%22"))
        assertTrue("filter bukan string terkutip: $cashflowRequest", cashflowRequest.contains("%22&") || cashflowRequest.endsWith("%22"))
    }

    @Test
    fun offline_dirty_row_survives_pull_and_absent_row_is_deleted() = runBlocking {
        val today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Jakarta")).toString()
        db.localRecordDao().upsertAll(
            listOf(
                seed("cashflow", "c-offline", today, dirty = 1),
                seed("cashflow", "c-gone", today, dirty = 0),
            ),
        )
        respondWith(
            mapOf(
                "cashflow" to """[{"id":"c-server","created_at":"$today 10:00:00.000Z","account_1":"acc-a","nominal":1000,"note":"kas masuk"}]""",
            ),
        )

        puller.pull()

        val ids = db.localRecordDao().idsInRange("cashflow", "2000-01-01", "2999-12-31").sorted()
        assertEquals(listOf("c-offline", "c-server"), ids)
        assertEquals(1, db.localRecordDao().find("cashflow", "c-offline")!!.dirty)
    }

    private fun seed(collection: String, id: String, dateKey: String, dirty: Int) = LocalRecordEntity(
        collection = collection,
        id = id,
        dateKey = dateKey,
        groupKey = "",
        text = id,
        json = "{}",
        dirty = dirty,
    )

    /** Semua koleksi dijawab; yang tidak disebut mengembalikan daftar kosong. */
    private fun respondWith(items: Map<String, String>) {
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path.orEmpty()
                val collection = Regex("/collections/([a-z_]+)/").find(path)?.groupValues?.get(1)
                val body = items[collection]
                return if (body != null) {
                    MockResponse().setBody("""{"page":1,"totalItems":1,"items":$body}""")
                } else {
                    MockResponse().setBody("""{"page":1,"totalItems":0,"items":[]}""")
                }
            }
        }
    }
}

private class Store : TokenStore {
    private var session: UserSession? = null
    override fun token(): String? = session?.token
    override fun save(session: UserSession) { this.session = session }
    override fun clear() { session = null }
}
package id.primamotor.pos.data.remote

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.SocketPolicy
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.concurrent.TimeUnit

class PocketBaseClientTest {

    private lateinit var server: MockWebServer
    private lateinit var client: PocketBaseClient

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        client = PocketBaseClient(
            baseUrl = server.url("/").toString().trimEnd('/'),
            http = OkHttpClient.Builder()
                .callTimeout(500, TimeUnit.MILLISECONDS)
                .build(),
        )
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun auth_returns_session_fields() = runTest {
        server.enqueue(
            MockResponse().setBody(
                """{"token":"t1","record":{"id":"u1","username":"kasir","name":"Kasir Satu","level":2,"status":"active"}}""",
            ),
        )

        val session = client.auth("kasir", "rahasia")

        assertEquals("t1", session.token)
        assertEquals("u1", session.id)
        assertEquals("Kasir Satu", session.name)
        assertEquals(2, session.level)

        val request = server.takeRequest()
        assertEquals("/api/collections/user/auth-with-password", request.path)
        assertTrue(request.body.readUtf8().contains("rahasia"))
    }

    @Test
    fun auth_failure_surfaces_server_message() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(400).setBody("""{"message":"Failed to authenticate."}"""),
        )

        val error = runCatching { client.auth("kasir", "salah") }.exceptionOrNull()

        assertTrue(error is PocketBaseException)
        assertEquals(400, (error as PocketBaseException).status)
        assertTrue(error.message!!.contains("authenticate"))
    }

    @Test
    fun refresh_sends_bearer_token() = runTest {
        server.enqueue(MockResponse().setBody("""{"token":"t2","record":{"id":"u1","username":"kasir","level":2}}"""))

        val session = client.refresh("t1")

        assertEquals("t2", session.token)
        assertEquals("Bearer t1", server.takeRequest().getHeader("Authorization"))
    }

    @Test
    fun unauthorized_request_refreshes_once_then_retries() = runTest {
        val store = MemoryTokenStore()
        store.save(UserSession(id = "u1", username = "kasir", name = "Kasir", level = 2, status = "active", token = "t1"))
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"message":"unauthorized"}"""))
        server.enqueue(MockResponse().setBody("""{"token":"t2","record":{"id":"u1","username":"kasir","level":2}}"""))
        server.enqueue(MockResponse().setBody("""[{"id":"p1","nama":"Oli"}]"""))

        val sessions = SessionManager(client, store)
        val result = sessions.call("/api/collections/produk/records?perPage=1")

        assertEquals("p1", result.jsonArray[0].jsonObject["id"]!!.jsonPrimitive.content)
        assertEquals("t2", store.token())
        assertEquals(3, server.requestCount)
    }

    @Test
    fun unreachable_server_reports_timeout() = runTest {
        server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.NO_RESPONSE))

        val error = runCatching { client.auth("kasir", "rahasia") }.exceptionOrNull()

        assertTrue(error is PocketBaseException)
        assertTrue(error?.message?.contains("jaringan", ignoreCase = true) == true)
        assertNull(server.takeRequest(1, TimeUnit.SECONDS)?.getHeader("Authorization"))
    }

    @Test
    fun batch_payload_matches_pocketbase_format() = runTest {
        server.enqueue(
            MockResponse().setBody("""[{"status":200,"body":{"id":"m1"}},{"status":200,"body":{"atomic":true}}]"""),
        )

        val operations = listOf(
            BatchOperation(
                method = "POST",
                path = "/api/collections/menu/records",
                body = Json.parseToJsonElement("""{"id":"m1","total":1000}"""),
            ),
        )

        val result = client.batch("req1", operations, token = "t1")

        assertEquals(2, result.size)
        assertEquals(200, result[0].status)
        val request = server.takeRequest()
        assertEquals("/api/batch?atomic_request_id=req1", request.path)
        assertTrue(request.body.readUtf8().contains("\"requests\""))
    }

    @Test
    fun resolve_returns_committed_results() = runTest {
        server.enqueue(
            MockResponse().setBody("""{"status":"committed","results":[{"status":200,"body":{"atomic":true}}]}"""),
        )

        val resolution = client.resolveRequest("req1", token = "t1")

        assertEquals("committed", resolution.status)
        assertEquals(1, resolution.results?.size)
        assertEquals("/api/financial/requests/req1/resolve", server.takeRequest().path)
    }

    @Test
    fun uploadFile_sends_bearer_token_and_multipart_field() {
        val file = java.io.File.createTempFile("foto", ".jpg").apply { writeBytes(byteArrayOf(1, 2, 3)) }
        try {
            server.enqueue(MockResponse().setBody("""{"id":"m1"}"""))

            client.uploadFile("/api/collections/produk/records/m1", "file", file.absolutePath, "token-abc")

            val request = server.takeRequest()
            assertEquals("PATCH", request.method)
            assertEquals("/api/collections/produk/records/m1", request.path)
            assertEquals("Bearer token-abc", request.getHeader("Authorization"))
            assertTrue(request.body.readUtf8().contains("name=\"file\""))
        } finally {
            file.delete()
        }
    }

    @Test
    fun uploadFile_reports_server_message() {
        val file = java.io.File.createTempFile("foto", ".jpg").apply { writeBytes(byteArrayOf(1)) }
        try {
            server.enqueue(MockResponse().setResponseCode(413).setBody("""{"message":"File too large"}"""))

            val error = runCatching {
                client.uploadFile("/api/collections/produk/records/m1", "file", file.absolutePath, "t")
            }.exceptionOrNull() as PocketBaseException

            assertEquals("File too large", error.message)
        } finally {
            file.delete()
        }
    }
}

class MemoryTokenStore : TokenStore {
    private var session: UserSession? = null
    override fun token(): String? = session?.token
    override fun save(session: UserSession) { this.session = session }
    override fun clear() { session = null }
}

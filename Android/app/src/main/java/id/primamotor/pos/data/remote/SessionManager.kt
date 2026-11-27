package id.primamotor.pos.data.remote

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonElement

/**
 * Lapisan sesi: menyimpan token, dan memperbarui token sekali saat server menjawab 401.
 * Token disimpan SEBELUM request keuangan dikirim (lihat Pusher) agar idempoten.
 */
class SessionManager(
    private val client: PocketBaseClient,
    private val store: TokenStore,
) {
    fun currentToken(): String? = store.token()

    suspend fun login(identity: String, password: String): UserSession = withContext(Dispatchers.IO) {
        client.auth(identity, password).also(store::save)
    }

    suspend fun restore(): UserSession? = withContext(Dispatchers.IO) {
        val token = store.token() ?: return@withContext null
        runCatching { client.refresh(token) }.getOrNull()?.also(store::save)
    }

    suspend fun logout() = withContext(Dispatchers.IO) { store.clear() }

    suspend fun call(path: String, method: String = "GET", body: JsonElement? = null): JsonElement =
        authorized { client.request(path, method, body, it) }

    suspend fun batch(requestId: String, operations: List<BatchOperation>): List<BatchResult> =
        authorized { client.batch(requestId, operations, it) }

    suspend fun resolve(requestId: String): Resolution = authorized { client.resolveRequest(requestId, it) }

    private suspend fun <T> authorized(block: (String) -> T): T = withContext(Dispatchers.IO) {
        val token = store.token()
            ?: throw PocketBaseException("Sesi berakhir. Silakan login ulang.", 401)
        try {
            block(token)
        } catch (error: PocketBaseException) {
            if (error.status != 401) throw error
            val refreshed = client.refresh(token)
            store.save(refreshed)
            block(refreshed.token)
        }
    }
}
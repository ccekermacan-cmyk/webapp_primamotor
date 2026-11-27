package id.primamotor.pos.data.remote

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

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

    /**
     * Verifikasi ulang password tanpa mengganti sesi aktif.
     * Dipakai untuk aksi sensitif seperti hapus produk, sama seperti web.
     */
    suspend fun verifyPassword(identity: String, password: String): Boolean = withContext(Dispatchers.IO) {
        runCatching { client.auth(identity, password) }.isSuccess
    }

    /** Ubah password akun sendiri. Wajib online; server menolak bila password lama salah. */
    suspend fun changePassword(userId: String, oldPassword: String, password: String) = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            put("oldPassword", oldPassword)
            put("password", password)
            put("passwordConfirm", password)
        }
        call("/api/collections/user/records/$userId", "PATCH", body)
        Unit
    }

    /**
     * Ubah profil sendiri: nama, avatar, dan opsional password.
     * Cermin `handleUpdateProfile` web: password hanya dikirim bila diisi.
     */
    suspend fun updateProfile(
        userId: String,
        name: String,
        linkImage: String,
        oldPassword: String?,
        password: String?,
    ) = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            put("name", name)
            put("link_image", linkImage)
            if (!password.isNullOrBlank()) {
                put("oldPassword", oldPassword.orEmpty())
                put("password", password)
                put("passwordConfirm", password)
            }
        }
        call("/api/collections/user/records/$userId", "PATCH", body)
        store.saveName(name)
        Unit
    }

    /** Minta perubahan email; PocketBase mengirim tautan konfirmasi ke email baru. */
    suspend fun requestEmailChange(newEmail: String) = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            put("newEmail", newEmail)
        }
        call("/api/collections/user/request-email-change", "POST", body)
        Unit
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

    /** POST ke backend Laravel (bukan PocketBase) memakai token sesi yang sama seperti web. */
    suspend fun laravelPost(apiUrl: String, path: String, body: JsonElement) = withContext(Dispatchers.IO) {
        val token = store.token() ?: throw PocketBaseException("Sesi berakhir. Silakan login ulang.", 401)
        client.request(apiUrl.trimEnd('/') + path, "POST", body, token)
    }

    suspend fun upload(path: String, field: String, filePath: String) = withContext(Dispatchers.IO) {
        val token = store.token() ?: throw PocketBaseException("Sesi berakhir. Login ulang untuk unggah media.")
        client.uploadFile(path, field, filePath, token)
    }

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
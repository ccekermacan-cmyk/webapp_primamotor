package id.primamotor.pos.data.remote

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

class PocketBaseException(message: String, val status: Int = 0, cause: Throwable? = null) :
    Exception(message, cause)

data class UserSession(
    val id: String,
    val username: String,
    val name: String,
    val level: Int,
    val status: String,
    val token: String,
)

/** Satu operasi di dalam batch PocketBase. `path` relatif, mis. `/api/collections/menu/records`. */
data class BatchOperation(
    val method: String,
    val path: String,
    val body: JsonElement,
)

data class BatchResult(val status: Int, val body: JsonObject?)

/** Hasil `POST /api/financial/requests/{id}/resolve`. */
data class Resolution(val status: String, val results: List<BatchResult>?) {
    val committed: Boolean get() = status == "committed"
}

interface TokenStore {
    fun token(): String?
    fun save(session: UserSession)
    /** Default no-op agar penyimpanan uji tidak perlu diubah. */
    fun saveName(name: String) {}
    fun clear()
}
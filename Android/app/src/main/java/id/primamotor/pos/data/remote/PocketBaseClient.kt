package id.primamotor.pos.data.remote

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.net.URLEncoder

/**
 * Klien HTTP minimum: OkHttp + kotlinx.serialization, tanpa Retrofit/Ktor.
 * Semua error jaringan dan error server dipetakan ke [PocketBaseException] berbahasa Indonesia.
 */
class PocketBaseClient(
    baseUrl: String,
    private val http: OkHttpClient = OkHttpClient(),
    private val json: Json = Json { ignoreUnknownKeys = true; isLenient = true; explicitNulls = false },
) {
    private val base = baseUrl.trimEnd('/')
    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    fun auth(identity: String, password: String): UserSession {
        val body = buildJsonObject {
            put("identity", identity)
            put("password", password)
        }
        return parseSession(execute("/api/collections/user/auth-with-password", "POST", body, token = null))
    }

    fun refresh(token: String): UserSession =
        parseSession(execute("/api/collections/user/auth-refresh", "POST", JsonObject(emptyMap()), token))

    fun batch(requestId: String, operations: List<BatchOperation>, token: String?): List<BatchResult> {
        val body = buildJsonObject {
            put(
                "requests",
                buildJsonArray {
                    operations.forEach { op ->
                        add(
                            buildJsonObject {
                                put("method", op.method)
                                put("url", op.path)
                                put("body", op.body)
                            },
                        )
                    }
                },
            )
        }
        val path = "/api/batch?atomic_request_id=${URLEncoder.encode(requestId, "UTF-8")}"
        val element = execute(path, "POST", body, token)
        return (element as? JsonArray)?.map(::parseBatchResult)
            ?: throw PocketBaseException("Respons batch tidak valid.")
    }

    fun resolveRequest(requestId: String, token: String?): Resolution {
        val path = "/api/financial/requests/${URLEncoder.encode(requestId, "UTF-8")}/resolve"
        val element = execute(path, "POST", JsonObject(emptyMap()), token).jsonObject
        val status = element["status"]?.jsonPrimitive?.content ?: "unknown"
        val results = (element["results"] as? JsonArray)?.map(::parseBatchResult)
        return Resolution(status, results)
    }

    fun request(path: String, method: String = "GET", body: JsonElement? = null, token: String? = null): JsonElement =
        execute(path, method, body, token)

    private fun execute(path: String, method: String, body: JsonElement?, token: String?): JsonElement {
        val url = if (path.startsWith("http")) path else base + path
        val requestBody = when {
            method == "GET" || method == "DELETE" && body == null -> null
            body == null -> "".toRequestBody(jsonMedia)
            else -> json.encodeToString(JsonElement.serializer(), body).toRequestBody(jsonMedia)
        }
        val request = Request.Builder()
            .url(url)
            .method(method, requestBody)
            .apply { if (token != null) header("Authorization", "Bearer $token") }
            .header("Accept", "application/json")
            .build()

        val response = try {
            http.newCall(request).execute()
        } catch (error: IOException) {
            throw PocketBaseException("Koneksi ke server gagal atau timeout. Periksa jaringan.", cause = error)
        }

        response.use {
            val text = it.body?.string().orEmpty()
            val parsed = runCatching { json.parseToJsonElement(text) }.getOrElse { JsonNull }
            if (!it.isSuccessful) {
                val message = (parsed as? JsonObject)?.get("message")?.jsonPrimitive?.content
                    ?: "Permintaan ditolak server (${it.code})."
                throw PocketBaseException(message, it.code)
            }
            return parsed
        }
    }

    private fun parseSession(element: JsonElement): UserSession {
        val root = element.jsonObject
        val record = root["record"]?.jsonObject ?: throw PocketBaseException("Respons login tidak valid.")
        val token = root["token"]?.jsonPrimitive?.content ?: throw PocketBaseException("Token login tidak ditemukan.")
        return UserSession(
            id = record["id"]?.jsonPrimitive?.content.orEmpty(),
            username = record["username"]?.jsonPrimitive?.content.orEmpty(),
            name = record["name"]?.jsonPrimitive?.content.orEmpty(),
            level = record["level"]?.jsonPrimitive?.intOrNull ?: 0,
            status = record["status"]?.jsonPrimitive?.content.orEmpty(),
            token = token,
        )
    }

    private fun parseBatchResult(element: JsonElement): BatchResult {
        val obj = element.jsonObject
        return BatchResult(
            status = obj["status"]?.jsonPrimitive?.intOrNull ?: 0,
            body = obj["body"] as? JsonObject,
        )
    }
}
package id.primamotor.pos.data.local

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import id.primamotor.pos.data.remote.TokenStore
import id.primamotor.pos.data.remote.UserSession
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/** Token dan identitas pengguna di EncryptedSharedPreferences (kunci dari Android Keystore). */
class EncryptedTokenStore(context: Context) : TokenStore {

    private val prefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "prima_session",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    override fun token(): String? = prefs.getString(KEY_TOKEN, null)

    override fun save(session: UserSession) {
        prefs.edit()
            .putString(KEY_TOKEN, session.token)
            .putString(
                KEY_USER,
                buildJsonObject {
                    put("id", session.id)
                    put("username", session.username)
                    put("name", session.name)
                    put("level", session.level)
                    put("status", session.status)
                }.toString(),
            )
            .apply()
    }

    override fun clear() {
        prefs.edit().clear().apply()
    }

    /** Sesi terakhir dari cache, dipakai untuk membuka POS saat offline. */
    fun cachedUser(): UserSession? {
        val raw = prefs.getString(KEY_USER, null) ?: return null
        val token = token() ?: return null
        val obj = runCatching { Json.parseToJsonElement(raw).jsonObject }.getOrNull() ?: return null
        return UserSession(
            id = obj["id"]?.jsonPrimitive?.content.orEmpty(),
            username = obj["username"]?.jsonPrimitive?.content.orEmpty(),
            name = obj["name"]?.jsonPrimitive?.content.orEmpty(),
            level = obj["level"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0,
            status = obj["status"]?.jsonPrimitive?.content.orEmpty(),
            token = token,
        )
    }

    private companion object {
        const val KEY_TOKEN = "token"
        const val KEY_USER = "user"
    }
}
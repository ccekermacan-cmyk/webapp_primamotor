package id.primamotor.pos.ui.media

import android.graphics.BitmapFactory
import android.util.LruCache
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import id.primamotor.pos.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

/**
 * Pemuat gambar produk tanpa pustaka tambahan: OkHttp + BitmapFactory, cache memori kecil.
 * Lampiran PocketBase butuh token sesi, jadi gambar diambil lewat request ber-autentikasi.
 */
object MediaImages {
    private val http = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private val cache = LruCache<String, ImageBitmap>(24)

    fun url(collection: String, recordId: String, fileName: String, thumb: String? = null): String {
        val safe = URLEncoder.encode(fileName, "UTF-8").replace("+", "%20")
        val base = "${BuildConfig.POS_BASE_URL.trimEnd('/')}/api/files/$collection/$recordId/$safe"
        return if (thumb == null) base else "$base?thumb=$thumb"
    }

    /** Lampiran produk (halaman Produk). */
    fun url(recordId: String, fileName: String, thumb: String? = null): String =
        url("produk", recordId, fileName, thumb)

    fun cached(url: String?): ImageBitmap? = url?.let(cache::get)

    suspend fun load(url: String, token: String?): ImageBitmap? = withContext(Dispatchers.IO) {
        cache.get(url)?.let { return@withContext it }
        runCatching {
            val request = Request.Builder().url(url)
                .apply { if (!token.isNullOrBlank()) header("Authorization", token) }
                .build()
            http.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                val bytes = response.body?.bytes() ?: return@withContext null
                val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return@withContext null
                bitmap.asImageBitmap().also { cache.put(url, it) }
            }
        }.getOrNull()
    }
}

@Composable
fun RemoteImage(
    url: String?,
    token: String?,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
    placeholder: String = "Foto",
) {
    var image by remember(url) { mutableStateOf(MediaImages.cached(url)) }
    LaunchedEffect(url, token) {
        if (url != null && image == null) image = MediaImages.load(url, token)
    }
    Box(modifier, contentAlignment = Alignment.Center) {
        val bitmap = image
        if (bitmap != null) {
            Image(
                bitmap,
                contentDescription = contentDescription,
                modifier = Modifier.fillMaxSize(),
                contentScale = contentScale,
            )
        } else {
            Text(placeholder, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

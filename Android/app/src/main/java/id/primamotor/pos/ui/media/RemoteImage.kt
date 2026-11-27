package id.primamotor.pos.ui.media

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import coil.compose.AsyncImage
import coil.request.CachePolicy
import coil.request.ImageRequest
import id.primamotor.pos.BuildConfig
import java.net.URLEncoder

/**
 * URL lampiran PocketBase. Lampiran butuh token sesi, jadi pemuatan gambar memakai
 * OkHttp milik Coil dengan header `Authorization` (lihat [RemoteImage]).
 */
object MediaImages {

    fun url(collection: String, recordId: String, fileName: String, thumb: String? = null): String {
        val safe = URLEncoder.encode(fileName, "UTF-8").replace("+", "%20")
        val base = "${BuildConfig.POS_BASE_URL.trimEnd('/')}/api/files/$collection/$recordId/$safe"
        return if (thumb == null) base else "$base?thumb=$thumb"
    }

    /** Lampiran produk (halaman Produk). */
    fun url(recordId: String, fileName: String, thumb: String? = null): String =
        url("produk", recordId, fileName, thumb)
}

/**
 * Gambar lampiran server. Coil menangani penurunan ukuran sesuai slot Compose,
 * cache memori + disk, pembatalan saat scroll, dan satu permintaan per URL.
 * Tanpa Coil, bitmap 12 MP di-decode penuh dan memori cepat habis.
 */
@Composable
fun RemoteImage(
    url: String?,
    token: String?,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
    placeholder: String = "Foto",
) {
    val context = LocalContext.current
    Box(modifier, contentAlignment = Alignment.Center) {
        if (url.isNullOrBlank()) {
            Text(
                placeholder,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            AsyncImage(
                model = ImageRequest.Builder(context)
                    .data(url)
                    .apply { if (!token.isNullOrBlank()) addHeader("Authorization", token) }
                    .memoryCachePolicy(CachePolicy.ENABLED)
                    .diskCachePolicy(CachePolicy.ENABLED)
                    .crossfade(true)
                    .build(),
                contentDescription = contentDescription,
                contentScale = contentScale,
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}

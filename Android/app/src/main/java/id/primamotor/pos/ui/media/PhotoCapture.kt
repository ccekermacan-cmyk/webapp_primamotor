package id.primamotor.pos.ui.media

import android.content.Context
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.FileProvider
import java.io.File

/**
 * Ambil foto lewat kamera sistem dan kembalikan path file di penyimpanan aplikasi.
 *
 * Media tidak diunggah langsung: path disimpan bersama outbox dan diunggah
 * [id.primamotor.pos.data.sync.MediaUploader] begitu jaringan tersedia.
 */
@Composable
fun rememberPhotoCapture(onCaptured: (String) -> Unit): () -> Unit {
    val context: Context = LocalContext.current
    var pendingPath by remember { mutableStateOf<String?>(null) }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        val path = pendingPath
        pendingPath = null
        if (ok && path != null) {
            onCaptured(path)
        } else {
            path?.let { runCatching { File(it).delete() } }
        }
    }
    return {
        val dir = File(context.filesDir, "media").apply { mkdirs() }
        val file = File(dir, "bukti_${System.currentTimeMillis()}.jpg")
        pendingPath = file.absolutePath
        val uri = FileProvider.getUriForFile(context, context.packageName + ".fileprovider", file)
        launcher.launch(uri)
    }
}

package id.primamotor.pos.data.sync

import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.remote.SessionManager
import java.io.File

/**
 * Unggah media tertunda setelah batch keuangan dikonfirmasi server.
 *
 * File diambil dari penyimpanan aplikasi; baris antrean hanya dihapus setelah server menerima.
 * File yang sudah hilang dari disk dibuang agar antrean tidak macet selamanya.
 */
class MediaUploader(
    private val db: AppDatabase,
    private val sessions: SessionManager,
) {

    suspend fun uploadPending(): Int {
        var uploaded = 0
        for (media in db.mediaDao().all()) {
            val file = File(media.filePath)
            if (!file.exists()) {
                db.mediaDao().remove(media.id)
                continue
            }
            val result = runCatching {
                sessions.upload(
                    path = "/api/collections/${media.collection}/records/${media.recordId}",
                    field = media.field,
                    filePath = file.absolutePath,
                )
            }
            if (result.isSuccess) {
                db.mediaDao().remove(media.id)
                uploaded += 1
            } else {
                break // jaringan belum siap; sisa antrean dicoba pada siklus berikutnya
            }
        }
        return uploaded
    }
}

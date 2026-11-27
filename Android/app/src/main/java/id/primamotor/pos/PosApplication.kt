package id.primamotor.pos

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import id.primamotor.pos.data.sync.SyncWorker

class PosApplication : Application(), ImageLoaderFactory {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        SyncWorker.schedule(this)
        SyncWorker.watchNetwork(this)
    }

    /**
     * Cache gambar di disk supaya foto produk tidak diunduh ulang tiap aplikasi dibuka.
     * Server PocketBase tidak mengirim `Cache-Control`, jadi header cache diabaikan.
     */
    override fun newImageLoader(): ImageLoader = ImageLoader.Builder(this)
        .memoryCache { MemoryCache.Builder(this).maxSizePercent(0.1).build() }
        .diskCache {
            DiskCache.Builder()
                .directory(cacheDir.resolve("images"))
                .maxSizeBytes(64L * 1024 * 1024)
                .build()
        }
        .respectCacheHeaders(false)
        .build()
}

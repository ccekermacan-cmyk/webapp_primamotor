package id.primamotor.pos

import android.app.Application

/**
 * Tempat graph dependency manual. Tanpa Hilt: hanya satu graph untuk aplikasi ini.
 * Repository, database, dan klien jaringan dipasang di sini pada task berikutnya.
 */
class PosApplication : Application() {
    override fun onCreate() {
        super.onCreate()
    }
}
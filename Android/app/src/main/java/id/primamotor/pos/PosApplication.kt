package id.primamotor.pos

import android.app.Application
import id.primamotor.pos.data.sync.SyncWorker

class PosApplication : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        SyncWorker.schedule(this)
        SyncWorker.watchNetwork(this)
    }
}

package id.primamotor.pos

import android.content.Context
import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.EncryptedTokenStore
import id.primamotor.pos.data.remote.PocketBaseClient
import id.primamotor.pos.data.remote.SessionManager
import id.primamotor.pos.data.repo.CheckoutRepository
import id.primamotor.pos.data.repo.PosEditRepository
import id.primamotor.pos.data.repo.Repositories
import id.primamotor.pos.data.sync.Puller
import id.primamotor.pos.data.sync.Pusher
import id.primamotor.pos.data.sync.SyncEngine
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/**
 * Graph dependency manual. Cukup satu graph; Hilt tidak menambah nilai di sini.
 *
 * Base URL dibaca dari resource string `pos_base_url` yang diisi dari `datasource`
 * saat build (lihat app/build.gradle.kts), bukan hardcode di kode.
 */
class AppContainer(context: Context) {

    val database: AppDatabase = AppDatabase.open(context)

    val tokenStore: EncryptedTokenStore = EncryptedTokenStore(context)

    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build()

    val client: PocketBaseClient = PocketBaseClient(
        baseUrl = BuildConfig.POS_BASE_URL,
        http = http,
    )

    val sessions: SessionManager = SessionManager(client, tokenStore)

    val pusher: Pusher = Pusher(database, sessions)

    val puller: Puller = Puller(database, sessions)

    val syncEngine: SyncEngine = SyncEngine(database, sessions, pusher, puller)

    val repositories: Repositories = Repositories(database)

    val checkoutRepository: CheckoutRepository = CheckoutRepository(database)

    val editRepository: PosEditRepository = PosEditRepository(database)
}
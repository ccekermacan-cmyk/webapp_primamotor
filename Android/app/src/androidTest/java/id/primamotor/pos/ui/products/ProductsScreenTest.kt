package id.primamotor.pos.ui.products

import android.content.Context
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.LocalRecordEntity
import id.primamotor.pos.data.remote.PocketBaseClient
import id.primamotor.pos.data.remote.SessionManager
import id.primamotor.pos.data.remote.TokenStore
import id.primamotor.pos.data.remote.UserSession
import id.primamotor.pos.data.repo.ProductRepository
import id.primamotor.pos.data.repo.Repositories
import id.primamotor.pos.ui.theme.PrimaMotorTheme
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Parity daftar Produk web: header, pencarian, filter stok, dan detail. */
@RunWith(AndroidJUnit4::class)
class ProductsScreenTest {

    @get:Rule
    val rule = createComposeRule()

    private lateinit var db: AppDatabase

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).allowMainThreadQueries().build()
        runBlocking {
            db.localRecordDao().upsertAll(
                listOf(
                    record("p1", """{"id":"p1","id_lama":"1","kategori":"Oli","merk":"Shell","jenis":"Mesin","tipe":"Beat","unit":"pcs","stok_3":5,"stok_2":2,"beli":10000,"sell_6":15000}"""),
                    record("p2", """{"id":"p2","id_lama":"2","kategori":"Oli","merk":"Yamalube","jenis":"Mesin","tipe":"Vario","unit":"pcs","stok_3":0,"stok_2":2,"beli":10000,"sell_6":14000}"""),
                    record("p3", """{"id":"p3","id_lama":"3","kategori":"Kampas","merk":"Aspira","jenis":"Rem","tipe":"Beat","unit":"pcs","stok_3":1,"stok_2":2,"beli":20000,"sell_6":30000}"""),
                ),
            )
        }
    }

    @After
    fun tearDown() {
        db.close()
    }

    private fun record(id: String, json: String) = LocalRecordEntity(
        collection = "produk",
        id = id,
        dateKey = "",
        groupKey = "",
        text = "",
        json = json,
        dirty = 0,
        updatedAt = 0,
    )

    private fun viewModel(): ProductViewModel {
        val store = object : TokenStore {
            override fun token(): String? = "test-token"
            override fun save(session: UserSession) = Unit
            override fun clear() = Unit
        }
        // Port tertutup: permintaan jaringan gagal cepat, sama seperti keadaan offline.
        val sessions = SessionManager(PocketBaseClient("http://127.0.0.1:9"), store)
        return ProductViewModel(
            repos = Repositories(db),
            writer = ProductRepository(db) { "new-id" },
            sessions = sessions,
            identity = "kasir",
            operator = "kasir",
            level = 1,
        )
    }

    @Test
    fun list_showsHeaderTotalAndProducts() {
        rule.setContent { PrimaMotorTheme { ProductsScreen(viewModel()) } }

        rule.onNodeWithText("Manajemen Produk").assertIsDisplayed()
        rule.onNodeWithText("Total 3 produk terdaftar").assertIsDisplayed()
        rule.onNodeWithText("Oli Shell Mesin Beat").assertIsDisplayed()
        rule.onNodeWithText("Kampas Aspira Rem Beat").assertIsDisplayed()
    }

    @Test
    fun search_filtersByMultiTermQuery() {
        rule.setContent { PrimaMotorTheme { ProductsScreen(viewModel()) } }

        rule.onNodeWithTag("products_search").performTextInput("shell beat")
        rule.waitForIdle()
        rule.onNodeWithText("Oli Shell Mesin Beat").assertIsDisplayed()
        rule.onNodeWithText("Kampas Aspira Rem Beat").assertDoesNotExist()
        rule.onNodeWithText("Oli Yamalube Mesin Vario").assertDoesNotExist()
    }

    @Test
    fun stockFilter_habisOnlyShowsEmptyStock() {
        rule.setContent { PrimaMotorTheme { ProductsScreen(viewModel()) } }

        rule.onNodeWithTag("products_filter_toggle").performClick()
        rule.waitForIdle()
        rule.onNodeWithTag("products_filter_Habis").performClick()
        rule.waitForIdle()
        rule.onNodeWithText("Oli Yamalube Mesin Vario").assertIsDisplayed()
        rule.onNodeWithText("Oli Shell Mesin Beat").assertDoesNotExist()
    }

    @Test
    fun card_opensDetailSheet() {
        rule.setContent { PrimaMotorTheme { ProductsScreen(viewModel()) } }

        rule.onNodeWithText("Oli Shell Mesin Beat").performClick()
        rule.waitForIdle()
        rule.onNodeWithText("Detail Spesifikasi Produk").assertIsDisplayed()
    }
}

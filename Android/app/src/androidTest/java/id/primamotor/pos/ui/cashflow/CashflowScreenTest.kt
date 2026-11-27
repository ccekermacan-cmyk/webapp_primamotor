package id.primamotor.pos.ui.cashflow

import android.content.Context
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.LocalRecordEntity
import id.primamotor.pos.data.remote.PocketBaseClient
import id.primamotor.pos.data.remote.SessionManager
import id.primamotor.pos.data.remote.TokenStore
import id.primamotor.pos.data.remote.UserSession
import id.primamotor.pos.data.repo.CashflowRepository
import id.primamotor.pos.data.repo.Repositories
import id.primamotor.pos.ui.theme.PrimaMotorTheme
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Parity halaman Cashflow web: header, tab, riwayat, detail, dan form. */
@RunWith(AndroidJUnit4::class)
class CashflowScreenTest {

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
                    record("kas", "dropdown", """{"id":"kas","id_lama":"kas","text_1":"Kas Toko","jenis":"cashflow account","number_1":150000}"""),
                    record("jenis_in", "dropdown", """{"id":"jenis_in","id_lama":"jual","text_1":"Penjualan","text_2":"in","jenis":"cashflow jenis","kategori":"cashflow"}"""),
                    record("user1", "user", """{"id":"user1","name":"Andi","username":"andi","level":1,"status":"Active","number":50000}"""),
                    record(
                        "cf1",
                        "cashflow",
                        """{"id":"cf1","account_1":"kas","account_2":"","nominal":25000,"mutasi":"in","jenis":"penjualan","note":"jual oli","person":"","persontext":"","created_at":"2026-11-20T03:00:00.000Z","operator":"kasir","ref":"INV-1"}""",
                    ),
                    record(
                        "cf2",
                        "cashflow",
                        """{"id":"cf2","account_1":"kas","account_2":"","nominal":10000,"mutasi":"out","jenis":"pembelian","note":"beli air","person":"","persontext":"","created_at":"2026-11-19T03:00:00.000Z","operator":"kasir"}""",
                    ),
                ),
            )
        }
    }

    @After
    fun tearDown() = db.close()

    private fun record(id: String, collection: String, json: String) = LocalRecordEntity(
        collection = collection,
        id = id,
        dateKey = if (collection == "cashflow") "2026-11-20" else "",
        groupKey = "",
        text = "",
        json = json,
        dirty = 0,
        updatedAt = 0,
    )

    private fun viewModel(level: Int = 1): CashflowViewModel {
        val store = object : TokenStore {
            override fun token(): String? = "test-token"
            override fun save(session: UserSession) = Unit
            override fun clear() = Unit
        }
        val sessions = SessionManager(PocketBaseClient("http://127.0.0.1:9"), store)
        return CashflowViewModel(
            repos = Repositories(db),
            writer = CashflowRepository(db),
            sessions = sessions,
            level = level,
            operator = "kasir",
        )
    }

    @Test
    fun headerAndTabs_render() {
        rule.setContent { PrimaMotorTheme { CashflowScreen(viewModel()) } }
        rule.onNodeWithText("Arus Kas").assertIsDisplayed()
        rule.onNodeWithText("Monitoring perputaran modal Prima Motor").assertIsDisplayed()
        rule.onNodeWithText("Buku Kas & Saldo").assertIsDisplayed()
        rule.onNodeWithText("Histori Kas").assertIsDisplayed()
        rule.onNodeWithText("Jatuh Tempo").assertIsDisplayed()
        rule.onNodeWithText("Catat Kas Baru").assertIsDisplayed()
    }

    @Test
    fun history_showsRowsAndOpensDetail() {
        rule.setContent { PrimaMotorTheme { CashflowScreen(viewModel()) } }
        rule.waitUntil(5_000) { rule.onAllNodesWithTag("cashflow_row").fetchSemanticsNodes().size == 2 }
        rule.onNodeWithText("jual oli").assertIsDisplayed()
        rule.onNodeWithText("beli air").assertIsDisplayed()
        rule.onAllNodesWithTag("cashflow_row")[0].performClick()
        rule.waitUntil(5_000) { rule.onAllNodesWithTag("cashflow_detail").fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithText("Detail Log Transaksi Kas").assertIsDisplayed()
        rule.onNodeWithTag("cashflow_detail_edit").assertIsDisplayed()
    }

    @Test
    fun form_opensWithWebFields() {
        rule.setContent { PrimaMotorTheme { CashflowScreen(viewModel()) } }
        rule.onNodeWithText("Catat Kas Baru").performClick()
        rule.waitUntil(5_000) { rule.onAllNodesWithTag("cashflow_form").fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithText("Catat Transaksi Kas Baru").assertIsDisplayed()
        rule.onNodeWithTag("cashflow_nominal").assertIsDisplayed()
        rule.onNodeWithTag("cashflow_note").assertIsDisplayed()
    }

    @Test
    fun accountsTab_showsWalletBalance() {
        rule.setContent { PrimaMotorTheme { CashflowScreen(viewModel()) } }
        rule.onNodeWithTag("cashflow_tab_accounts").performClick()
        rule.waitUntil(5_000) { rule.onAllNodesWithTag("cashflow_wallet").fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithText("Kas Toko").assertIsDisplayed()
    }

    @Test
    fun tempoTab_hiddenForLevelThree() {
        rule.setContent { PrimaMotorTheme { CashflowScreen(viewModel(level = 3)) } }
        rule.onAllNodesWithTag("cashflow_tab_tempo").fetchSemanticsNodes().let {
            assertEquals(0, it.size)
        }
    }

    @Test
    fun addBon_hiddenWithoutAddbonMarker() {
        rule.setContent { PrimaMotorTheme { CashflowScreen(viewModel()) } }
        rule.onAllNodesWithTag("cashflow_add_bon").fetchSemanticsNodes().let {
            assertEquals(0, it.size)
        }
    }
}

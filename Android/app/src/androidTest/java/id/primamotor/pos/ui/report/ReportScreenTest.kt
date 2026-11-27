package id.primamotor.pos.ui.report

import android.content.Context
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performSemanticsAction
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
import id.primamotor.pos.data.repo.ReportRepository
import id.primamotor.pos.data.repo.Repositories
import id.primamotor.pos.ui.theme.PrimaMotorTheme
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Parity halaman Analitik Laporan web: KPI, tabel, filter, dan detail 5 tab. */
@RunWith(AndroidJUnit4::class)
class ReportScreenTest {

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
                    record(
                        "r1",
                        "report",
                        """{"id":"r1","text":"Rekap harian","created_at":"2026-11-20T00:00:00.000Z","omset_toko":500000,"omset_servis":0,"omset_minuman":0,"laba_penjualan":200000,"laba_service":0,"laba_minuman":0,"operasional_toko":50000,"pengeluaran_lain":0,"pemasukan_lain":100000,"piutang":30000,"hutang":20000,"kasir_toko":450000}""",
                        dateKey = "2026-11-20",
                    ),
                    record(
                        "m1",
                        "menu",
                        """{"id":"m1","person":"","person_baru":"PSN-0001","payment":"Tunai","total":100000,"dibayar":40000,"status":"belum","jenis":"Penjualan","operator":"kasir","created_at":"2026-11-20T03:00:00.000Z","qty":1}""",
                        dateKey = "2026-11-20",
                    ),
                    record(
                        "l1",
                        "log_stock",
                        """{"id":"l1","item":"PRD-1","item_baru":"p1","qty":1,"price_1":100000,"price_2":60000,"boolean":"out","ref_baru":"m1","operator":"kasir","created_at":"2026-11-20T03:00:00.000Z"}""",
                        dateKey = "2026-11-20",
                    ),
                    record(
                        "c1",
                        "cashflow",
                        """{"id":"c1","account_1":"Kas","account_2":"","nominal":100000,"mutasi":"in","jenis":"Penjualan","note":"Lunas nota","person":"","created_at":"2026-11-20T03:00:00.000Z"}""",
                        dateKey = "2026-11-20",
                    ),
                    record(
                        "o1",
                        "ongkos",
                        """{"id":"o1","id_lama":"ONG-1","person":"Joko","operator":"kasir","ref":"m1","ref_baru":"m1","date":"2026-11-20T03:00:00.000Z","ongkos":25000}""",
                        dateKey = "2026-11-20",
                    ),
                    record(
                        "p1",
                        "produk",
                        """{"id":"p1","nama":"Oli Shell","kategori":"Oli","merk":"Shell","jenis":"Mesin","beli":60000}""",
                    ),
                ),
            )
        }
    }

    @After
    fun tearDown() = db.close()

    private fun record(id: String, collection: String, json: String, dateKey: String = "") = LocalRecordEntity(
        collection = collection,
        id = id,
        dateKey = dateKey,
        groupKey = "",
        text = "",
        json = json,
        dirty = 0,
        updatedAt = 0,
    )

    private fun viewModel(level: Int = 1): ReportViewModel {
        val store = object : TokenStore {
            override fun token(): String? = null
            override fun save(session: UserSession) = Unit
            override fun clear() = Unit
        }
        val sessions = SessionManager(PocketBaseClient("http://127.0.0.1:9"), store)
        return ReportViewModel(
            repos = Repositories(db),
            reports = ReportRepository(db, sessions, "http://127.0.0.1:9"),
            sessions = sessions,
            level = level,
            operator = "kasir",
        )
    }

    @Test
    fun headerKpisAndTable_renderWebValues() {
        rule.setContent { PrimaMotorTheme { ReportScreen(viewModel()) } }
        rule.onNodeWithText("Analitik Laporan").assertIsDisplayed()
        rule.onNodeWithText("Overview Mutasi & Performa Bisnis Prima Motor").assertIsDisplayed()
        rule.onNodeWithText("GENERATE OTOMATIS").assertIsDisplayed()
        rule.onNodeWithText("UNDUH REPORT").assertIsDisplayed()
        rule.waitUntil(5_000) { rule.onAllNodesWithTag("report_row_r1").fetchSemanticsNodes().size == 1 }
        listOf("Rp 500.000", "Rp 200.000", "Rp 250.000", "Rp 30.000", "Rp 20.000", "Rp 450.000").forEach { value ->
            assertTrue(
                "KPI $value tidak tampil",
                rule.onAllNodesWithText(value).fetchSemanticsNodes().isNotEmpty(),
            )
        }
        rule.onNodeWithText("Hal. 1 / 1").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("Rekap harian").performScrollTo().assertIsDisplayed()
    }

    @Test
    fun rowOpensDetailAndTabsShowDayData() {
        rule.setContent { PrimaMotorTheme { ReportScreen(viewModel()) } }
        rule.waitUntil(5_000) { rule.onAllNodesWithTag("report_row_r1").fetchSemanticsNodes().size == 1 }
        rule.onNodeWithTag("report_row_r1").performScrollTo().performSemanticsAction(SemanticsActions.OnClick)
        rule.waitUntil(5_000) { rule.onAllNodesWithTag("report_detail_tab_menu").fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithText("Detail Laporan 20 Nov 2026").assertExists()

        rule.onNodeWithTag("report_detail_tab_menu").performScrollTo().performClick()
        rule.waitUntil(5_000) { rule.onAllNodesWithTag("report_menu_row_m1").fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithTag("report_menu_row_m1").assertExists()

        rule.onNodeWithTag("report_menu_row_m1").performScrollTo().performSemanticsAction(SemanticsActions.OnClick)
        rule.waitUntil(5_000) { rule.onAllNodesWithTag("report_log_row_l1").fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithText("Oli Shell Mesin").assertExists()
        rule.onNodeWithText("Sesuaikan Harga Beli Hari Ini").assertExists()

        rule.onNodeWithTag("report_detail_tab_kas").performScrollTo().performClick()
        rule.waitUntil(5_000) { rule.onAllNodesWithTag("report_cash_row_c1").fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithText("Lunas nota").assertExists()

        rule.onNodeWithTag("report_detail_tab_ongkos").performScrollTo().performClick()
        rule.waitUntil(5_000) { rule.onAllNodesWithTag("report_ongkos_row_o1").fetchSemanticsNodes().isNotEmpty() }
        assertTrue(rule.onAllNodesWithText("Joko").fetchSemanticsNodes().isNotEmpty())
        assertTrue(rule.onAllNodesWithText("Rp 25.000").fetchSemanticsNodes().isNotEmpty())
    }

    @Test
    fun deleteButtonOnlyForAllowedLevels() {
        rule.setContent { PrimaMotorTheme { ReportScreen(viewModel(level = 1)) } }
        rule.waitUntil(5_000) { rule.onAllNodesWithTag("report_row_r1").fetchSemanticsNodes().size == 1 }
        rule.onNodeWithTag("report_row_r1").performScrollTo().performSemanticsAction(SemanticsActions.OnClick)
        rule.waitUntil(5_000) { rule.onAllNodesWithTag("report_delete").fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithTag("report_delete").performScrollTo().performClick()
        rule.onNodeWithText("Yakin ingin menghapus laporan tanggal 20 Nov 2026 secara permanen?").assertExists()
    }

    @Test
    fun searchAndEmptyState() {
        rule.setContent { PrimaMotorTheme { ReportScreen(viewModel()) } }
        rule.waitUntil(5_000) { rule.onAllNodesWithTag("report_row_r1").fetchSemanticsNodes().size == 1 }
        rule.onNodeWithTag("report_search").performTextInput("tidak-ada")
        rule.waitUntil(5_000) {
            rule.onAllNodesWithText("Tidak ada data laporan ditemukan untuk filter ini.").fetchSemanticsNodes().isNotEmpty()
        }
    }
}

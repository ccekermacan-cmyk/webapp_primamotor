package id.primamotor.pos.ui.person

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
import id.primamotor.pos.data.repo.EmployeeRepository
import id.primamotor.pos.data.repo.MasterRepository
import id.primamotor.pos.data.repo.Repositories
import id.primamotor.pos.ui.theme.PrimaMotorTheme
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Parity halaman People web: tab, tabel, form, dan detail bertab. */
@RunWith(AndroidJUnit4::class)
class PersonScreenTest {

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
                        "p1",
                        "dropdown",
                        """{"id":"p1","kategori":"Person","jenis":"Customer","text_1":"Budi Santoso","text_2":"Bengkel Budi","text_3":"Dusun Krajan","number_2":2,"number_3":3,"text_4":"Sukamaju","text_5":"Krajan","text_6":"Malang","text_7":"Jawa Timur","text_9":"Pelanggan","number_4":3500000000000,"phone":"08123456789","id_lama":"PSN-0001"}""",
                    ),
                    record(
                        "p2",
                        "dropdown",
                        """{"id":"p2","kategori":"Person","jenis":"Supplier","text_1":"Oli Jaya","text_2":"","id_lama":"PSN-0002"}""",
                    ),
                    record(
                        "u1",
                        "user",
                        """{"id":"u1","name":"Andi","username":"andi","email":"andi@primamotor.com","level":1,"status":"active","phone":"08987654321","number":50000}""",
                    ),
                    record(
                        "m1",
                        "menu",
                        """{"id":"m1","person":"PSN-0001","total":100000,"dibayar":40000,"status":"belum","operator":"kasir","jenis":"Penjualan","created_at":"2026-11-20T03:00:00.000Z","id_lama":"m1"}""",
                    ),
                    record(
                        "g1",
                        "gaji",
                        """{"id":"g1","person":"andi","pokok":1000000,"tunjangan":100000,"lembur":0,"bonus_1":0,"alfa":0,"setengah_hari":0,"sakit":0,"telat":0,"bpjs":0,"bon_diambil":0,"bon_dibayar":0,"qty":1,"total":1100000,"created_at":"2026-11-20T03:00:00.000Z"}""",
                    ),
                    record(
                        "b1",
                        "cashflow",
                        """{"id":"b1","account_1":"kas","account_2":"","nominal":25000,"mutasi":"out","jenis":"bon","note":"Ambil bon","person":"andi","persontext":"","id_lama":"addbon","created_at":"2026-11-20T03:00:00.000Z"}""",
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
        dateKey = "",
        groupKey = "",
        text = "",
        json = json,
        dirty = 0,
        updatedAt = 0,
    )

    private fun viewModel(level: Int = 1): PersonViewModel {
        val store = object : TokenStore {
            override fun token(): String? = "test-token"
            override fun save(session: UserSession) = Unit
            override fun clear() = Unit
        }
        val sessions = SessionManager(PocketBaseClient("http://127.0.0.1:9"), store)
        return PersonViewModel(
            repos = Repositories(db),
            masters = MasterRepository(db),
            employees = EmployeeRepository(db),
            sessions = sessions,
            level = level,
            operator = "kasir",
        )
    }

    @Test
    fun headerAndTabs_render() {
        rule.setContent { PrimaMotorTheme { PersonScreen(viewModel()) } }
        rule.onNodeWithText("People").assertIsDisplayed()
        rule.onNodeWithText("Semua (Person)").assertIsDisplayed()
        rule.onNodeWithText("Customers").assertIsDisplayed()
        rule.onNodeWithText("Suppliers").assertIsDisplayed()
        rule.onNodeWithText("Karyawan").assertIsDisplayed()
        rule.onNodeWithText("Add Cust / Supp").assertIsDisplayed()
    }

    @Test
    fun people_showsRowsWithBadgeAndId() {
        rule.setContent { PrimaMotorTheme { PersonScreen(viewModel()) } }
        rule.waitUntil(5_000) { rule.onAllNodesWithTag("person_row_p1").fetchSemanticsNodes().size == 1 }
        rule.onNodeWithText("Budi Santoso").assertIsDisplayed()
        rule.onNodeWithText("Bengkel Budi").assertIsDisplayed()
        rule.onNodeWithText("Customer").assertIsDisplayed()
        rule.onNodeWithText("#PSN-0001").assertIsDisplayed()
    }

    @Test
    fun personDetail_showsAddressAndHistory() {
        rule.setContent { PrimaMotorTheme { PersonScreen(viewModel()) } }
        rule.waitUntil(5_000) { rule.onAllNodesWithTag("person_row_p1").fetchSemanticsNodes().size == 1 }
        rule.onAllNodesWithTag("person_row_p1")[0].performClick()
        rule.onNodeWithText("Alamat Lengkap").assertIsDisplayed()
        rule.onNodeWithText("Dusun Krajan, RT 2/RW 3, Ds. Sukamaju, Kec. Krajan, Malang, Jawa Timur").assertIsDisplayed()
        rule.onNodeWithTag("person_detail_history").performClick()
        rule.waitForIdle()
        rule.onNodeWithText("Total Belanja").assertExists()
        rule.onNodeWithText("Total Piutang Berjalan").assertExists()
        rule.onNodeWithText("BELUM").assertExists()
    }

    @Test
    fun staffTab_showsUsersAndDetailTabs() {
        rule.setContent { PrimaMotorTheme { PersonScreen(viewModel()) } }
        rule.onNodeWithTag("person_tab_staff").performClick()
        rule.waitUntil(5_000) { rule.onAllNodesWithTag("staff_row_u1").fetchSemanticsNodes().size == 1 }
        rule.onNodeWithText("andi@primamotor.com • @andi").assertIsDisplayed()
        rule.onAllNodesWithTag("staff_row_u1")[0].performClick()
        rule.onNodeWithText("Informasi Karyawan").assertIsDisplayed()
        rule.onNodeWithTag("staff_detail_gaji").performClick()
        rule.waitForIdle()
        rule.onNodeWithText("Rp 1.100.000").assertExists()
        rule.onNodeWithTag("staff_detail_bon").performClick()
        rule.waitForIdle()
        rule.onNodeWithText("TOTAL SISA BON BERJALAN").assertExists()
        rule.onNodeWithText("Ambil bon", substring = true).assertExists()
    }

    @Test
    fun personForm_opensWithWebFields() {
        rule.setContent { PrimaMotorTheme { PersonScreen(viewModel()) } }
        rule.onNodeWithTag("person_add").performClick()
        rule.waitUntil(5_000) { rule.onAllNodesWithTag("person_save").fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithText("Tambah Partner Baru").assertIsDisplayed()
        rule.onNodeWithTag("person_nama").assertIsDisplayed()
        rule.onNodeWithTag("person_nik").assertExists()
        rule.onNodeWithTag("person_dusun").assertExists()
    }

    @Test
    fun karyawanTab_hiddenForLevelThree() {
        rule.setContent { PrimaMotorTheme { PersonScreen(viewModel(level = 3)) } }
        rule.onAllNodesWithTag("person_tab_staff").fetchSemanticsNodes().let {
            assertEquals(0, it.size)
        }
    }
}

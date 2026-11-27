package id.primamotor.pos.ui.pos

import android.content.Context
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.LocalRecordEntity
import id.primamotor.pos.data.repo.CheckoutRepository
import id.primamotor.pos.data.repo.PosEditRepository
import id.primamotor.pos.data.repo.SettlementRepository
import id.primamotor.pos.data.repo.Repositories
import id.primamotor.pos.ui.theme.PrimaMotorTheme
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class CheckoutFlowTest {

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
                    LocalRecordEntity(
                        collection = "produk",
                        id = "p1",
                        dateKey = "",
                        groupKey = "",
                        text = "oli mesin",
                        json = """{"id":"p1","nama":"Oli Mesin","stok_3":5,"sell_1":15000,"sell_6":15000}""",
                    ),
                    LocalRecordEntity(
                        collection = "dropdown",
                        id = "acc1",
                        dateKey = "",
                        groupKey = "",
                        text = "kas",
                        json = """{"id":"acc1","id_lama":"acc-1","text_1":"Kas","jenis":"cashflow account","kategori":"akun","number_1":0}""",
                    ),
                    LocalRecordEntity(
                        collection = "dropdown",
                        id = "menu1",
                        dateKey = "",
                        groupKey = "",
                        text = "penjualan",
                        json = """{"id":"menu1","text_1":"Penjualan","kategori":"menu","jenis":"jenis menu"}""",
                    ),
                ),
            )
        }
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun cashier_can_checkout_offline_and_outbox_holds_transaction() {
        val viewModel = PosViewModel(Repositories(db), CheckoutRepository(db), PosEditRepository(db), SettlementRepository(db), operatorName = "kasir")
        rule.setContent { PrimaMotorTheme { PosScreen(viewModel) } }

        // Menu pilihan paritas web: Overview default, lalu pilih menu transaksi.
        rule.onNodeWithTag("menu_Penjualan").performClick()
        rule.onNodeWithText("Oli Mesin").assertIsDisplayed()
        rule.onNodeWithText("Oli Mesin").performClick()
        rule.onNodeWithTag("pos_open_cart").performClick()
        rule.onNodeWithTag("checkout_tab_1").performClick()
        rule.onNodeWithTag("account_acc1").performScrollTo().performClick()
        rule.onNodeWithTag("checkout_nominal").performScrollTo().performTextInput("20000")
        rule.onNodeWithTag("checkout_submit").performScrollTo().performClick()

        // Review wajib sebelum simpan, cermin CheckoutReviewModal web.
        rule.onNodeWithTag("review_save").performClick()
        rule.waitForIdle()
        val snapshot = viewModel.state.value
        org.junit.Assert.assertNotNull("state=$snapshot", snapshot.saved)
        rule.onNodeWithTag("pos_saved_dialog").assertIsDisplayed()
        assertEquals(1, runBlocking { db.outboxDao().count() })
    }
}

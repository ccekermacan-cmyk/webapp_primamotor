package id.primamotor.pos.data.repo

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.LocalRecordEntity
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.math.BigDecimal

@RunWith(AndroidJUnit4::class)
class SettlementRepositoryTest {

    private lateinit var db: AppDatabase
    private lateinit var repo: SettlementRepository

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).allowMainThreadQueries().build()
        repo = SettlementRepository(db) { "cf-new" }
        runBlocking {
            db.localRecordDao().upsertAll(
                listOf(
                    LocalRecordEntity(
                        "menu", "menu1", "2026-11-27", "umum1", "tempo",
                        """{"id":"menu1","jenis":"Penjualan","person":"umum1","payment":"tempo","total":100000,"dibayar":40000,"status":"belum"}""",
                    ),
                    LocalRecordEntity(
                        "dropdown", "acc1", "", "", "kas",
                        """{"id":"acc1","id_lama":"acc-1","text_1":"Kas","number_1":50000}""",
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
    fun full_payment_closes_note_and_writes_cashflow() = runBlocking {
        val result = repo.settle("menu1", BigDecimal("60000"), "acc1", "kasir")

        assertTrue(result is CheckoutResult.Saved)
        val menu = db.localRecordDao().find("menu", "menu1")!!
        assertTrue(menu.json.contains("\"status\":\"lunas\""))
        assertTrue(menu.json.contains("\"dibayar\":100000"))
        assertEquals(1, db.outboxDao().count())
        val pending = db.outboxDao().oldestPending()!!
        assertEquals(listOf("cashflow", "menu"), db.outboxDao().operations(pending.requestId).map { it.collection })
        assertEquals(0, BigDecimal("110000").compareTo(balance()))
    }

    @Test
    fun overpayment_leaves_note_untouched() = runBlocking {
        val result = repo.settle("menu1", BigDecimal("90000"), "acc1", "kasir")

        assertTrue(result is CheckoutResult.Rejected)
        assertEquals(0, db.outboxDao().count())
        assertTrue(db.localRecordDao().find("menu", "menu1")!!.json.contains("\"status\":\"belum\""))
    }

    private suspend fun balance(): BigDecimal =
        Regex("\"number_1\":([0-9.]+)").find(db.localRecordDao().find("dropdown", "acc1")!!.json)!!
            .groupValues[1].toBigDecimal()
}
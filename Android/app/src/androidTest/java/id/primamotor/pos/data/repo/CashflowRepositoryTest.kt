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
class CashflowRepositoryTest {

    private lateinit var db: AppDatabase
    private lateinit var repo: CashflowRepository

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).allowMainThreadQueries().build()
        repo = CashflowRepository(db) { "generated" }
        runBlocking {
            db.localRecordDao().upsertAll(
                listOf(
                    LocalRecordEntity(
                        collection = "dropdown",
                        id = "kas",
                        dateKey = "",
                        groupKey = "Kas",
                        text = "kas",
                        json = """{"id":"kas","id_lama":"kas","text_1":"Kas","jenis":"cashflow account","number_1":100000}""",
                    ),
                ),
            )
        }
    }

    @After
    fun tearDown() = db.close()

    @Test
    fun catat_kas_writes_outbox_and_updates_balance() = runBlocking {
        val result = repo.catatKas(
            CashDraft(jenis = "penjualan", accountId = "kas", nominal = BigDecimal("25000"), note = "jual oli"),
            operator = "kasir",
        )
        assertTrue(result is CashSave.Saved)
        val balance = db.localRecordDao().find("dropdown", "kas")?.object_()?.number("number_1")
        assertEquals(0, BigDecimal("125000").compareTo(balance))
        assertEquals(1, db.outboxDao().count())
        val cashflow = db.localRecordDao().find("cashflow", "generated")
        assertEquals("in", cashflow?.object_()?.text("mutasi"))
        assertEquals("penjualan", cashflow?.object_()?.text("jenis"))
    }

    @Test
    fun reject_when_balance_insufficient() = runBlocking {
        val result = repo.catatKas(
            CashDraft(jenis = "pembelian", mutasi = "Keluar", accountId = "kas", nominal = BigDecimal("200000"), note = "beli"),
            operator = "kasir",
        )
        assertTrue(result is CashSave.Rejected)
        assertEquals(0, db.outboxDao().count())
    }

    @Test
    fun delete_restores_balance() = runBlocking {
        repo.catatKas(
            CashDraft(jenis = "penjualan", accountId = "kas", nominal = BigDecimal("25000"), note = "jual oli"),
            operator = "kasir",
        )
        assertTrue(repo.deleteCashflow("generated"))
        val balance = db.localRecordDao().find("dropdown", "kas")?.object_()?.number("number_1")
        assertEquals(0, BigDecimal("100000").compareTo(balance))
    }
}

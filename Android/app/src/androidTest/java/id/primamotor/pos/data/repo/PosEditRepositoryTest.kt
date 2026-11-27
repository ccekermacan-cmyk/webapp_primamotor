package id.primamotor.pos.data.repo

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.LocalRecordEntity
import id.primamotor.pos.domain.CartLine
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.math.BigDecimal

@RunWith(AndroidJUnit4::class)
class PosEditRepositoryTest {

    private lateinit var db: AppDatabase
    private lateinit var repo: PosEditRepository

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).allowMainThreadQueries().build()
        repo = PosEditRepository(db) { "new-id" }
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun update_reverses_old_children_and_writes_new_ones_in_one_request() = runBlocking {
        seedTransaction(qty = "2", nominal = "30000")
        val session = repo.prepare("menu1")!!

        val result = repo.update(
            session = session,
            jenis = "Penjualan",
            cart = listOf(CartLine("p1", "Oli", BigDecimal("1"), BigDecimal("15000"))),
            form = CheckoutForm(payment = "Tunai", nominalBayar = BigDecimal("15000")),
            operator = "kasir",
        )

        assertTrue(result is CheckoutResult.Saved)
        val pending = db.outboxDao().oldestPending()!!
        val ops = db.outboxDao().operations(pending.requestId)
        assertEquals("menu", ops.first().collection)
        assertEquals("update", ops.first().method)
        assertEquals(listOf("delete", "delete", "create"), ops.drop(1).map { it.method })
        assertEquals(0, BigDecimal("4").compareTo(stockOf()))
        assertEquals(1, db.localRecordDao().dirtyCount("menu"))
    }

    @Test
    fun update_rejects_when_edited_quantity_exceeds_stock_after_revert() = runBlocking {
        seedTransaction(qty = "2", nominal = "30000")
        val session = repo.prepare("menu1")!!

        val result = repo.update(
            session = session,
            jenis = "Penjualan",
            cart = listOf(CartLine("p1", "Oli", BigDecimal("9"), BigDecimal("15000"))),
            form = CheckoutForm(payment = "Tunai", nominalBayar = BigDecimal("135000")),
            operator = "kasir",
        )

        assertTrue(result is CheckoutResult.Rejected)
        assertEquals(0, db.outboxDao().count())
    }

    @Test
    fun delete_reverts_stock_balance_and_queues_single_delete() = runBlocking {
        seedTransaction(qty = "2", nominal = "30000")
        val session = repo.prepare("menu1")!!

        repo.delete(session)

        assertEquals(0, BigDecimal("5").compareTo(stockOf()))
        assertEquals(0, BigDecimal("40000").compareTo(balanceOf()))
        val pending = db.outboxDao().oldestPending()!!
        val ops = db.outboxDao().operations(pending.requestId)
        assertEquals(1, ops.size)
        assertEquals("delete", ops[0].method)
        assertEquals("menu1", ops[0].recordId)
        assertTrue(db.localRecordDao().find("menu", "menu1") == null)
        assertTrue(db.localRecordDao().find("log_stock", "log1") == null)
    }

    private suspend fun stockOf(): BigDecimal =
        Repositories(db).produkById("p1")!!.stok

    private suspend fun balanceOf(): BigDecimal =
        Regex("\"number_1\":([0-9.]+)").find(db.localRecordDao().find("dropdown", "acc1")!!.json)!!
            .groupValues[1].toBigDecimal()

    private suspend fun seedTransaction(qty: String, nominal: String) {
        db.localRecordDao().upsertAll(
            listOf(
                LocalRecordEntity(
                    "produk", "p1", "", "", "oli",
                    """{"id":"p1","nama":"Oli","stok_3":3,"sell_1":15000}""",
                ),
                LocalRecordEntity(
                    "dropdown", "acc1", "", "", "kas",
                    """{"id":"acc1","id_lama":"acc-1","text_1":"Kas","number_1":70000}""",
                ),
                LocalRecordEntity(
                    "menu", "menu1", "2026-11-27", "umum1", "penjualan",
                    """{"id":"menu1","jenis":"Penjualan","person":"umum1","total":30000,"status":"lunas","created_at":"2026-11-27T02:00:00.000Z","ref_baru":"menu1"}""",
                ),
                LocalRecordEntity(
                    "log_stock", "log1", "2026-11-27", "p1", "oli",
                    """{"id":"log1","item_baru":"p1","qty":$qty,"boolean":"out","ref_baru":"menu1"}""",
                ),
                LocalRecordEntity(
                    "cashflow", "cf1", "2026-11-27", "acc1", "nota",
                    """{"id":"cf1","account_1":"acc1","account_2":"","nominal":$nominal,"mutasi":"in","jenis":"Penjualan","ref_baru":"menu1"}""",
                ),
            ),
        )
    }
}
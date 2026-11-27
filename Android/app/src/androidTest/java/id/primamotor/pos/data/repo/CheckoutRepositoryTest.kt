package id.primamotor.pos.data.repo

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.LocalRecordEntity
import id.primamotor.pos.data.local.OutboxStatus
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
class CheckoutRepositoryTest {

    private lateinit var db: AppDatabase
    private lateinit var repo: CheckoutRepository

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).allowMainThreadQueries().build()
        repo = CheckoutRepository(db) { "id-fixed" }
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun sale_writes_menu_children_and_outbox_in_one_transaction() = runBlocking {
        seedProduct("p1", stock = "5")
        seedAccount("acc1", balance = "100000")

        val result = repo.commit(
            jenis = "Penjualan",
            cart = listOf(CartLine("p1", "Oli", BigDecimal("2"), BigDecimal("15000"))),
            form = CheckoutForm(
                payment = "Tunai",
                nominalBayar = BigDecimal("30000"),
                cashflow = listOf(CashflowInput("acc1", BigDecimal("30000"))),
            ),
            operator = "kasir",
        )

        assertTrue(result is CheckoutResult.Saved)
        val menu = db.localRecordDao().find("menu", "id-fixed")!!
        assertTrue(menu.json.contains("\"status\":\"lunas\""))
        assertEquals(1, menu.dirty)
        assertEquals(1, db.outboxDao().count())
        val pending = db.outboxDao().oldestPending()!!
        assertEquals(OutboxStatus.PENDING, pending.status)
        assertEquals(3, db.outboxDao().operations(pending.requestId).size)
        assertTrue(db.localRecordDao().find("log_stock", "id-fixed") != null)
        assertTrue(db.localRecordDao().find("cashflow", "id-fixed") != null)
        assertEquals(0, BigDecimal("3").compareTo(stockOf("p1")))
        assertEquals(0, BigDecimal("130000").compareTo(balanceOf("acc1")))
    }

    @Test
    fun insufficient_stock_is_rejected_without_writing() = runBlocking {
        seedProduct("p1", stock = "1")

        val result = repo.commit(
            jenis = "Penjualan",
            cart = listOf(CartLine("p1", "Oli", BigDecimal("2"), BigDecimal("15000"))),
            form = CheckoutForm(nominalBayar = BigDecimal("30000")),
            operator = "kasir",
        )

        assertTrue(result is CheckoutResult.Rejected)
        assertEquals(0, db.outboxDao().count())
        assertTrue(db.localRecordDao().find("menu", "id-fixed") == null)
    }

    @Test
    fun insufficient_account_balance_is_rejected() = runBlocking {
        seedProduct("p1", stock = "5")
        seedAccount("acc1", balance = "1000")

        val result = repo.commit(
            jenis = "Pembelian",
            cart = listOf(CartLine("p1", "Oli", BigDecimal("1"), BigDecimal("15000"))),
            form = CheckoutForm(
                payment = "Tunai",
                nominalBayar = BigDecimal("15000"),
                cashflow = listOf(CashflowInput("acc1", BigDecimal("15000"))),
            ),
            operator = "kasir",
        )

        assertTrue(result is CheckoutResult.Rejected)
        assertTrue((result as CheckoutResult.Rejected).message.contains("Saldo"))
        assertEquals(0, db.outboxDao().count())
    }

    @Test
    fun purchase_increases_stock_and_decreases_balance() = runBlocking {
        seedProduct("p1", stock = "5")
        seedAccount("acc1", balance = "100000")

        repo.commit(
            jenis = "Pembelian",
            cart = listOf(CartLine("p1", "Oli", BigDecimal("4"), BigDecimal("15000"))),
            form = CheckoutForm(
                payment = "Tunai",
                nominalBayar = BigDecimal("60000"),
                cashflow = listOf(CashflowInput("acc1", BigDecimal("60000"))),
            ),
            operator = "kasir",
        )

        assertEquals(0, BigDecimal("9").compareTo(stockOf("p1")))
        assertEquals(0, BigDecimal("40000").compareTo(balanceOf("acc1")))
    }

    private suspend fun stockOf(id: String): BigDecimal =
        Repositories(db).produkById(id)!!.stok

    private suspend fun balanceOf(id: String): BigDecimal {
        val raw = db.localRecordDao().find("dropdown", id)!!.json
        return Regex("\"number_1\":([0-9.]+)").find(raw)!!.groupValues[1].toBigDecimal()
    }

    private suspend fun seedProduct(id: String, stock: String) {
        db.localRecordDao().upsertAll(
            listOf(
                LocalRecordEntity(
                    collection = "produk",
                    id = id,
                    dateKey = "",
                    groupKey = "",
                    text = "oli",
                    json = """{"id":"$id","nama":"Oli","stok_3":$stock,"sell_1":15000,"sell_6":15000}""",
                ),
            ),
        )
    }

    private suspend fun seedAccount(id: String, balance: String) {
        db.localRecordDao().upsertAll(
            listOf(
                LocalRecordEntity(
                    collection = "dropdown",
                    id = id,
                    dateKey = "",
                    groupKey = "",
                    text = "kas",
                    json = """{"id":"$id","id_lama":"acc-1","text_1":"Kas","number_1":$balance}""",
                ),
            ),
        )
    }
}
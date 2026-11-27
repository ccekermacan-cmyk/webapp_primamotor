package id.primamotor.pos.data.sync

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.LocalRecordEntity
import id.primamotor.pos.data.local.OutboxEntity
import id.primamotor.pos.data.local.OutboxOperationEntity
import id.primamotor.pos.data.local.OutboxStatus
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.math.BigDecimal

@RunWith(AndroidJUnit4::class)
class ConflictResolverTest {

    private lateinit var db: AppDatabase
    private lateinit var resolver: ConflictResolver

    private val menuJson =
        """{"id":"menu1","person":"umum1","total":30000,"dibayar":30000,"status":"lunas","created_at":"2026-11-27 02:00:00.000Z"}"""

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).allowMainThreadQueries().build()
        resolver = ConflictResolver(db)
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun void_reverses_created_stock_and_cash_then_keeps_request_out_of_review() = runBlocking {
        seed()
        queueRejectedCheckout()

        resolver.void("req1")

        assertEquals(0, BigDecimal("5").compareTo(stock()))
        assertEquals(0, BigDecimal("70000").compareTo(balance()))
        assertTrue(db.localRecordDao().find("menu", "menu1") == null)
        assertTrue(db.localRecordDao().find("log_stock", "log1") == null)
        assertTrue(db.localRecordDao().find("cashflow", "cf1") == null)
        assertEquals(OutboxStatus.VOID, db.outboxDao().find("req1")!!.status)
        assertTrue(resolver.observeOpen().first().isEmpty())
    }

    @Test
    fun update_conflict_restores_previous_menu_json_on_void() = runBlocking {
        db.localRecordDao().upsertAll(
            listOf(
                LocalRecordEntity(
                    "menu", "menu1", "2026-11-27", "umum1", "penjualan",
                    """{"id":"menu1","person":"umum1","total":90000,"status":"lunas","created_at":"2026-11-27 02:00:00.000Z"}""",
                    dirty = 1,
                ),
            ),
        )
        db.outboxDao().enqueueWithOperations(
            OutboxEntity("req2", OutboxStatus.NEEDS_REVIEW, 1L, "{}", lastError = "Stok kurang"),
            listOf(
                OutboxOperationEntity(
                    "req2", 1, "menu", "update", "menu1",
                    """{"id":"menu1","person":"umum1","total":90000,"atomic_expected":"{\"id\":\"menu1\",\"person\":\"umum1\",\"total\":30000,\"status\":\"lunas\",\"created_at\":\"2026-11-27 02:00:00.000Z\"}"}""",
                ),
            ),
        )

        resolver.void("req2")

        val restored = db.localRecordDao().find("menu", "menu1")!!
        assertTrue(restored.json.contains("30000"))
        assertEquals(0, restored.dirty)
    }

    @Test
    fun retry_returns_request_to_pending_without_changing_batch() = runBlocking {
        seed()
        queueRejectedCheckout()

        resolver.retry("req1")

        val row = db.outboxDao().find("req1")!!
        assertEquals(OutboxStatus.PENDING, row.status)
        assertEquals(4, db.outboxDao().operations("req1").size)
        assertEquals(0, BigDecimal("3").compareTo(stock()))
    }

    private suspend fun queueRejectedCheckout() {
        db.outboxDao().enqueueWithOperations(
            OutboxEntity("req1", OutboxStatus.NEEDS_REVIEW, 1L, "{}", lastError = "Stok kurang"),
            listOf(
                OutboxOperationEntity("req1", 1, "menu", "create", "menu1", menuJson),
                OutboxOperationEntity(
                    "req1", 2, "log_stock", "create", "log1",
                    """{"id":"log1","item_baru":"p1","qty":2,"boolean":"out","ref_baru":"menu1","created_at":"2026-11-27 02:00:00.000Z"}""",
                ),
                OutboxOperationEntity(
                    "req1", 3, "cashflow", "create", "cf1",
                    """{"id":"cf1","account_1":"acc1","account_2":"","nominal":30000,"mutasi":"in","jenis":"Penjualan","created_at":"2026-11-27 02:00:00.000Z"}""",
                ),
                OutboxOperationEntity(
                    "req1", 4, "ongkos", "create", "ong1",
                    """{"id":"ong1","person":"mek1","ongkos":10000,"created_at":"2026-11-27 02:00:00.000Z"}""",
                ),
            ),
        )
    }

    /** Cache sudah memuat efek transaksi yang kemudian ditolak server. */
    private suspend fun seed() {
        db.localRecordDao().upsertAll(
            listOf(
                LocalRecordEntity("produk", "p1", "", "", "oli", """{"id":"p1","nama":"Oli","stok_3":3}"""),
                LocalRecordEntity("dropdown", "acc1", "", "", "kas", """{"id":"acc1","text_1":"Kas","number_1":100000}"""),
                LocalRecordEntity("menu", "menu1", "2026-11-27", "umum1", "penjualan", menuJson, dirty = 1),
                LocalRecordEntity(
                    "log_stock", "log1", "2026-11-27", "p1", "oli",
                    """{"id":"log1","item_baru":"p1","qty":2,"boolean":"out","ref_baru":"menu1"}""",
                    dirty = 1,
                ),
                LocalRecordEntity(
                    "cashflow", "cf1", "2026-11-27", "acc1", "nota",
                    """{"id":"cf1","account_1":"acc1","account_2":"","nominal":30000,"mutasi":"in","jenis":"Penjualan","ref_baru":"menu1"}""",
                    dirty = 1,
                ),
            ),
        )
    }

    private suspend fun stock(): BigDecimal =
        Regex("\\\"stok_3\\\":([0-9.]+)").find(db.localRecordDao().find("produk", "p1")!!.json)!!
            .groupValues[1].toBigDecimal()

    private suspend fun balance(): BigDecimal =
        Regex("\\\"number_1\\\":([0-9.]+)").find(db.localRecordDao().find("dropdown", "acc1")!!.json)!!
            .groupValues[1].toBigDecimal()
}

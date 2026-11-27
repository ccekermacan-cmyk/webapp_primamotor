package id.primamotor.pos.data.repo

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import id.primamotor.pos.data.local.AppDatabase
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.math.BigDecimal

@RunWith(AndroidJUnit4::class)
class ProductRepositoryTest {

    private lateinit var db: AppDatabase
    private lateinit var repo: ProductRepository

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).allowMainThreadQueries().build()
        repo = ProductRepository(db) { "p-new" }
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun new_product_is_queued_as_create_and_stays_dirty() = runBlocking {
        val result = repo.save(ProductDraft(nama = "Oli", barcode = "899", sell1 = BigDecimal("15000"), stok = BigDecimal("3")))

        assertTrue(result is ProductSave.Saved)
        val record = db.localRecordDao().find("produk", "p-new")!!
        assertEquals(1, record.dirty)
        assertEquals(1, db.localRecordDao().dirtyCount("produk"))
        val pending = db.outboxDao().oldestPending()!!
        val op = db.outboxDao().operations(pending.requestId).single()
        assertEquals("create", op.method)
        assertEquals("p-new", op.recordId)
    }

    @Test
    fun existing_product_is_updated_not_duplicated() = runBlocking {
        repo.save(ProductDraft(nama = "Oli", sell1 = BigDecimal("15000")))
        val saved = db.localRecordDao().find("produk", "p-new")!!

        val result = repo.save(ProductDraft(id = "p-new", nama = "Oli Baru", sell1 = BigDecimal("16000")))

        assertTrue(result is ProductSave.Saved && !(result as ProductSave.Saved).created)
        assertEquals("Oli Baru", Repositories(db).produkById("p-new")!!.nama)
        val ops = db.outboxDao().operations(db.outboxDao().all().last().requestId)
        assertEquals("update", ops.single().method)
        assertEquals(1, db.localRecordDao().idsInRange("produk", "", "zzzz").size)
    }

    @Test
    fun adjust_stock_writes_log_and_moves_local_stock() = runBlocking {
        repo.save(ProductDraft(nama = "Oli", stok = BigDecimal("5")))
        val id = db.localRecordDao().idsInRange("produk", "", "zzzz").single()

        val result = repo.adjustStock(id, -1, "kasir")

        assertTrue(result is ProductSave.Saved)
        assertEquals(0, BigDecimal("4").compareTo(Repositories(db).produkById(id)!!.stok))
        val log = db.localRecordDao().idsInRange("log_stock", "", "zzzz").single()
        assertEquals("out", db.localRecordDao().find("log_stock", log)!!.object_()!!.text("boolean"))
        assertEquals(2, db.outboxDao().count())
    }

    @Test
    fun adjust_stock_below_zero_is_rejected() = runBlocking {
        repo.save(ProductDraft(nama = "Oli", stok = BigDecimal.ZERO))
        val id = db.localRecordDao().idsInRange("produk", "", "zzzz").single()

        val result = repo.adjustStock(id, -1, "kasir")

        assertTrue(result is ProductSave.Rejected)
        assertEquals(0, BigDecimal.ZERO.compareTo(Repositories(db).produkById(id)!!.stok))
    }

    @Test
    fun blank_name_is_rejected_without_writing() = runBlocking {
        val result = repo.save(ProductDraft(nama = " "))

        assertTrue(result is ProductSave.Rejected)
        assertEquals(0, db.outboxDao().count())
    }
}
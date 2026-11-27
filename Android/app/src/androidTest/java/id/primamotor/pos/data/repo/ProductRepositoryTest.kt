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

    /** Draft valid menurut validasi web: kategori, merk, unit wajib; sell_6 > 0. */
    private fun draft(
        id: String? = null,
        nama: String = "Oli",
        barcode: String = "",
        sell1: BigDecimal = BigDecimal("15000"),
        sell6: BigDecimal = BigDecimal("18000"),
        stok: BigDecimal = BigDecimal.ZERO,
    ) = ProductDraft(
        id = id,
        nama = nama,
        barcode = barcode,
        kategori = "Oli",
        merk = "Shell",
        unit = "pcs",
        sell1 = sell1,
        sell6 = sell6,
        stok = stok,
    )

    @Test
    fun new_product_is_queued_as_create_and_stays_dirty() = runBlocking {
        val result = repo.save(draft(barcode = "899", stok = BigDecimal("3")))

        assertTrue(result is ProductSave.Saved)
        val record = db.localRecordDao().find("produk", "p-new")!!
        assertEquals(1, record.dirty)
        assertEquals(1, db.localRecordDao().dirtyCount("produk"))
        val pending = db.outboxDao().oldestPending()!!
        val ops = db.outboxDao().operations(pending.requestId)
        assertEquals("create", ops.first().method)
        assertEquals("p-new", ops.first().recordId)
        // Stok awal hanya lewat `log_stock`, jadi create + log dalam satu request.
        assertEquals("create", ops.single { it.collection == "log_stock" }.method)
    }

    @Test
    fun existing_product_is_updated_not_duplicated() = runBlocking {
        repo.save(draft())
        db.localRecordDao().find("produk", "p-new")!!

        val result = repo.save(draft(id = "p-new", nama = "Oli Baru", sell1 = BigDecimal("16000")))

        assertTrue(result is ProductSave.Saved && !(result as ProductSave.Saved).created)
        assertEquals("Oli Baru", Repositories(db).produkById("p-new")!!.nama)
        val ops = db.outboxDao().operations(db.outboxDao().all().last().requestId)
        assertEquals("update", ops.first().method)
        assertEquals(1, db.localRecordDao().idsInRange("produk", "", "zzzz").size)
    }

    @Test
    fun adjust_stock_writes_log_and_moves_local_stock() = runBlocking {
        repo.save(draft(stok = BigDecimal("5")))
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
        repo.save(draft())
        val id = db.localRecordDao().idsInRange("produk", "", "zzzz").single()

        val result = repo.adjustStock(id, -1, "kasir")

        assertTrue(result is ProductSave.Rejected)
        assertEquals(0, BigDecimal.ZERO.compareTo(Repositories(db).produkById(id)!!.stok))
    }

    @Test
    fun blank_kategori_is_rejected_without_writing() = runBlocking {
        val result = repo.save(draft().copy(kategori = " "))

        assertTrue(result is ProductSave.Rejected)
        assertEquals(0, db.outboxDao().count())
    }

    @Test
    fun zero_retail_price_is_rejected() = runBlocking {
        val result = repo.save(draft(sell6 = BigDecimal.ZERO))

        assertTrue(result is ProductSave.Rejected)
        assertEquals(0, db.outboxDao().count())
    }
}

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
import org.junit.Assert.assertNotNull
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
                    dropdown("kas", "Kas", "100000"),
                    dropdown("bank", "Bank", "50000"),
                ),
            )
        }
    }

    private fun dropdown(id: String, name: String, balance: String) = LocalRecordEntity(
        collection = "dropdown",
        id = id,
        dateKey = "",
        groupKey = name,
        text = name.lowercase(),
        json = """{"id":"$id","id_lama":"$id","text_1":"$name","jenis":"cashflow account","number_1":$balance}""",
    )

    @After
    fun tearDown() = db.close()

    @Test
    fun save_writes_outbox_and_updates_balance() = runBlocking {
        val result = repo.save(
            CashDraft(jenis = "penjualan", accountId = "kas", nominal = BigDecimal("25000"), note = "jual oli"),
            operator = "kasir",
        )
        assertTrue(result is CashSave.Saved)
        assertEquals(0, BigDecimal("125000").compareTo(balance("kas")))
        assertEquals(1, db.outboxDao().count())
        val cashflow = db.localRecordDao().find("cashflow", "generated")
        assertEquals("in", cashflow?.object_()?.text("mutasi"))
        assertEquals("penjualan", cashflow?.object_()?.text("jenis"))
    }

    @Test
    fun save_rejects_insufficient_balance() = runBlocking {
        val result = repo.save(
            CashDraft(jenis = "pembelian", mutasi = "Keluar", accountId = "kas", nominal = BigDecimal("200000"), note = "beli"),
            operator = "kasir",
        )
        assertTrue(result is CashSave.Rejected)
        assertEquals(0, db.outboxDao().count())
    }

    @Test
    fun transfer_moves_balance_between_accounts() = runBlocking {
        val result = repo.save(
            CashDraft(
                mutasi = "Keluar",
                jenis = "transfer kas",
                accountId = "kas",
                account2Id = "bank",
                nominal = BigDecimal("30000"),
                note = "pindah kas",
            ),
            operator = "kasir",
        )
        assertTrue(result is CashSave.Saved)
        assertEquals(0, BigDecimal("70000").compareTo(balance("kas")))
        assertEquals(0, BigDecimal("80000").compareTo(balance("bank")))
    }

    @Test
    fun transfer_rejects_same_target() = runBlocking {
        val result = repo.save(
            CashDraft(
                mutasi = "Keluar",
                jenis = "transfer kas",
                accountId = "kas",
                account2Id = "kas",
                nominal = BigDecimal("10000"),
                note = "salah",
            ),
            operator = "kasir",
        )
        assertTrue(result is CashSave.Rejected)
        assertEquals(
            "Akun tujuan transfer harus berbeda dari akun sumber!",
            (result as CashSave.Rejected).message,
        )
    }

    @Test
    fun edit_keeps_atomic_expected_snapshot_and_reverts_old_value() = runBlocking {
        repo.save(
            CashDraft(jenis = "penjualan", accountId = "kas", nominal = BigDecimal("25000"), note = "jual oli"),
            operator = "kasir",
        )
        val saved = db.localRecordDao().find("cashflow", "generated")!!.object_()!!
        val result = repo.save(
            CashDraft(
                id = "generated",
                createdAtIso = saved.text("created_at"),
                jenis = "penjualan",
                accountId = "kas",
                nominal = BigDecimal("40000"),
                note = "jual oli revisi",
            ),
            operator = "kasir",
        )
        assertTrue(result is CashSave.Saved)
        // 100000 + 40000, bukan 100000 + 25000 + 40000.
        assertEquals(0, BigDecimal("140000").compareTo(balance("kas")))
        val updated = db.localRecordDao().find("cashflow", "generated")!!.object_()!!
        assertEquals(0, BigDecimal("40000").compareTo(updated.number("nominal")))
        assertNotNull(updated["atomic_expected"])
    }

    @Test
    fun bon_with_cashflow_writes_single_cashflow_record() = runBlocking {
        val result = repo.catatBon(
            BonDraft(
                catatCashflow = true,
                accountId = "kas",
                personUserId = "user1",
                personText = "Andi",
                nominal = BigDecimal("15000"),
                note = "bon makan",
            ),
            operator = "kasir",
        )
        assertTrue(result is CashSave.Saved)
        assertNotNull(db.localRecordDao().find("cashflow", "generated"))
        // Server yang membuat baris bon; klien tidak menulis bon kedua.
        assertEquals(0, db.localRecordDao().count("bon"))
        assertEquals(0, BigDecimal("85000").compareTo(balance("kas")))
    }

    @Test
    fun delete_bon_from_salary_is_rejected() = runBlocking {
        db.localRecordDao().upsertAll(
            listOf(
                LocalRecordEntity(
                    collection = "bon",
                    id = "bon1",
                    dateKey = "2026-11-20",
                    groupKey = "user1",
                    text = "gaji",
                    json = """{"id":"bon1","nominal":10000,"jenis":"out","ref_gaji":"gaji1","ref_cashflow":""}""",
                ),
            ),
        )
        val result = repo.deleteBon("bon1")
        assertTrue(result is CashSave.Rejected)
        assertNotNull(db.localRecordDao().find("bon", "bon1"))
    }

    @Test
    fun delete_cashflow_restores_balance() = runBlocking {
        repo.save(
            CashDraft(jenis = "penjualan", accountId = "kas", nominal = BigDecimal("25000"), note = "jual oli"),
            operator = "kasir",
        )
        assertTrue(repo.deleteCashflow("generated"))
        assertEquals(0, BigDecimal("100000").compareTo(balance("kas")))
    }

    private suspend fun balance(id: String): BigDecimal =
        db.localRecordDao().find("dropdown", id)?.object_()?.number("number_1") ?: BigDecimal.ZERO
}

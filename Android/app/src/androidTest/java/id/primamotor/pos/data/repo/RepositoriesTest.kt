package id.primamotor.pos.data.repo

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.LocalRecordEntity
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
class RepositoriesTest {

    private lateinit var db: AppDatabase
    private lateinit var repos: Repositories

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).allowMainThreadQueries().build()
        repos = Repositories(db)
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun produk_flow_emits_cached_rows_without_network() = runBlocking {
        db.localRecordDao().upsertAll(
            listOf(
                record(
                    "produk",
                    "p1",
                    """{"id":"p1","nama":"Oli Mesin","stok_3":4,"sell_1":55000,"sell_2":50000,"sell_3":45000}""",
                ),
            ),
        )

        val rows = repos.observeProduk().first()

        assertEquals(1, rows.size)
        assertEquals("Oli Mesin", rows[0].nama)
        assertEquals(BigDecimal("4"), rows[0].stok)
        assertEquals(0, BigDecimal("45000").compareTo(rows[0].price(3)))
    }

    @Test
    fun menu_day_only_returns_that_wib_day() = runBlocking {
        db.localRecordDao().upsertAll(
            listOf(
                record("menu", "m1", """{"id":"m1","total":1000}""", dateKey = "2026-11-27"),
                record("menu", "m2", """{"id":"m2","total":2000}""", dateKey = "2026-11-26"),
            ),
        )

        val rows = repos.observeMenuDay("2026-11-27").first()

        assertEquals(listOf("m1"), rows.map { it.id })
        assertEquals(BigDecimal("1000"), rows[0].total)
    }

    @Test
    fun salary_flow_only_exposes_own_person() = runBlocking {
        db.localRecordDao().upsertAll(
            listOf(
                record("gaji", "g1", """{"id":"g1","person":"d1","pokok":3000000}""", groupKey = "d1"),
                record("gaji", "g2", """{"id":"g2","person":"d2","pokok":9000000}""", groupKey = "d2"),
            ),
        )

        val rows = repos.observeGajiSendiri("d1").first()

        assertEquals(listOf("g1"), rows.map { it.id })
        assertEquals(0, BigDecimal("3000000").compareTo(rows[0].diterima))
    }

    @Test
    fun salary_diterima_matches_web_formula() = runBlocking {
        db.localRecordDao().upsertAll(
            listOf(
                record(
                    "gaji",
                    "g1",
                    """{"id":"g1","person":"d1","pokok":3000000,"tunjangan":500000,"lembur":100000,""" +
                        """"bonus_1":50000,"bonus_2":25000,"bpjs":30000,"bon_diambil":40000,"bon_dibayar":10000}""",
                    groupKey = "d1",
                ),
            ),
        )

        val gaji = repos.observeGajiSendiri("d1").first().single()

        assertEquals(0, BigDecimal("3595000").compareTo(gaji.diterima))
    }

    @Test
    fun person_flow_only_returns_person_category() = runBlocking {
        db.localRecordDao().upsertAll(
            listOf(
                record("dropdown", "d1", """{"id":"d1","kategori":"Person","text_1":"Budi"}"""),
                record("dropdown", "d2", """{"id":"d2","kategori":"Satuan","text_1":"Pcs"}"""),
            ),
        )

        val rows = repos.observePerson().first()

        assertEquals(listOf("Budi"), rows.map { it.nama })
        assertTrue(rows.all { it.kategori.equals("person", ignoreCase = true) })
    }

    private fun record(
        collection: String,
        id: String,
        json: String,
        dateKey: String = "",
        groupKey: String = "",
    ) = LocalRecordEntity(
        collection = collection,
        id = id,
        dateKey = dateKey,
        groupKey = groupKey,
        text = id,
        json = json,
        dirty = 0,
    )
}
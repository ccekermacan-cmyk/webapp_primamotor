package id.primamotor.pos.data.repo

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import id.primamotor.pos.data.local.AppDatabase
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/** Parity dengan `pages/person.tsx` dan `pages/settings.tsx`: tulis lokal + outbox. */
@RunWith(AndroidJUnit4::class)
class MasterRepositoryTest {

    private lateinit var db: AppDatabase
    private lateinit var masters: MasterRepository
    private lateinit var employees: EmployeeRepository

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).allowMainThreadQueries().build()
        masters = MasterRepository(db) { "ddb000000000001" }
        employees = EmployeeRepository(db) { "usr000000000001" }
    }

    @After
    fun tearDown() = db.close()

    @Test
    fun person_create_writes_local_and_outbox() = runBlocking {
        val result = masters.save(
            MasterDraft(kategori = "Person", jenis = "Customer", text1 = "Budi", idLama = "PSN-1"),
        )

        assertTrue(result is MasterSave.Saved)
        val row = db.localRecordDao().find("dropdown", "ddb000000000001")!!
        assertTrue(row.json.contains("\"text_1\":\"Budi\""))
        assertTrue(row.json.contains("\"address\""))
        val requestId = db.outboxDao().all().first().requestId
        val ops = db.outboxDao().operations(requestId)
        assertEquals("create", ops.single().method)
    }

    @Test
    fun person_update_keeps_id_and_enqueues_update() = runBlocking {
        masters.save(MasterDraft(kategori = "Person", jenis = "Customer", text1 = "Budi"))
        val saved = masters.save(
            MasterDraft(
                id = "ddb000000000001",
                kategori = "Person",
                jenis = "Customer",
                text1 = "Budi Santoso",
                number1 = "250000",
            ),
        )

        assertTrue(saved is MasterSave.Saved)
        val requestId = db.outboxDao().all().last().requestId
        assertEquals("update", db.outboxDao().operations(requestId).single().method)
        assertTrue(db.localRecordDao().find("dropdown", "ddb000000000001")!!.json.contains("250000"))
    }

    @Test
    fun blank_label_is_rejected_without_writing() = runBlocking {
        val result = masters.save(MasterDraft(kategori = "Person", jenis = "Customer", text1 = " "))

        assertTrue(result is MasterSave.Rejected)
        assertTrue(db.outboxDao().all().isEmpty())
    }

    @Test
    fun employee_create_uses_default_password_and_user_collection() = runBlocking {
        val result = employees.save(EmployeeDraft(name = "Rina", username = "rina", email = "rina@primamotor.com", level = 5))

        assertTrue(result is EmployeeSave.Saved)
        val row = db.localRecordDao().find("user", "usr000000000001")
        assertNotNull(row)
        assertTrue(row!!.json.contains("password123"))
        val requestId = db.outboxDao().all().single().requestId
        assertEquals("user", db.outboxDao().operations(requestId).single().collection)
    }
}

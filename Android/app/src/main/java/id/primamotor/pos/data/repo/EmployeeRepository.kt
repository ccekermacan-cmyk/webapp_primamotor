package id.primamotor.pos.data.repo

import androidx.room.withTransaction
import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.LocalRecordEntity
import id.primamotor.pos.data.local.OutboxEntity
import id.primamotor.pos.data.local.OutboxOperationEntity
import id.primamotor.pos.data.local.OutboxStatus
import id.primamotor.pos.domain.RecordId
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Cermin form karyawan `pages/person.tsx` (koleksi auth `user`). */
data class EmployeeDraft(
    val id: String? = null,
    val name: String = "",
    val username: String = "",
    val email: String = "",
    val phone: String = "",
    val level: Int = 2,
    val status: String = "active",
    val linkImage: String = "",
    val password: String = "password123",
)

sealed interface EmployeeSave {
    data class Saved(val id: String, val created: Boolean) : EmployeeSave
    data class Rejected(val message: String) : EmployeeSave
}

class EmployeeRepository(
    private val db: AppDatabase,
    private val idGenerator: () -> String = { RecordId.create() },
) {

    suspend fun save(draft: EmployeeDraft): EmployeeSave = db.withTransaction {
        if (draft.name.isBlank()) return@withTransaction EmployeeSave.Rejected("Nama wajib diisi.")
        if (draft.id == null && draft.username.isBlank()) {
            return@withTransaction EmployeeSave.Rejected("Username wajib diisi.")
        }
        if (draft.level !in setOf(1, 2, 3, 4, 5, 6, 7, 10)) {
            return@withTransaction EmployeeSave.Rejected("Level tidak dikenal.")
        }

        val existing = draft.id?.let { db.localRecordDao().find("user", it) }
        if (draft.id != null && existing == null) {
            return@withTransaction EmployeeSave.Rejected("Karyawan tidak ditemukan di cache. Sinkronkan dulu.")
        }
        val id = existing?.id ?: idGenerator()
        val previous = existing?.json?.let(::parse)

        val json = buildJsonObject {
            previous?.forEach { (key, value) -> put(key, value) }
            put("id", id)
            put("name", draft.name.trim())
            put("username", draft.username.trim())
            put("email", draft.email.trim())
            put("phone", draft.phone.trim())
            put("level", draft.level)
            put("status", draft.status.trim().ifBlank { "active" })
            put("link_image", draft.linkImage.trim())
            put("emailVisibility", true)
            if (existing == null) {
                put("password", draft.password)
                put("passwordConfirm", draft.password)
            }
        }

        db.localRecordDao().upsertAll(
            listOf(
                LocalRecordEntity(
                    collection = "user",
                    id = id,
                    dateKey = "",
                    groupKey = draft.level.toString(),
                    text = listOf(draft.name, draft.username, draft.email).joinToString(" ") { it.lowercase().trim() },
                    json = json.toString(),
                    dirty = 1,
                    updatedAt = System.currentTimeMillis(),
                ),
            ),
        )

        enqueue(
            method = if (existing == null) "create" else "update",
            recordId = id,
            json = json.toString(),
        )
        EmployeeSave.Saved(id, existing == null)
    }

    suspend fun delete(id: String): Boolean = db.withTransaction {
        val existing = db.localRecordDao().find("user", id) ?: return@withTransaction false
        db.localRecordDao().delete("user", id)
        enqueue("delete", id, existing.json)
        true
    }

    private suspend fun enqueue(method: String, recordId: String, json: String) {
        val requestId = RecordId.create(24)
        db.outboxDao().enqueueWithOperations(
            OutboxEntity(requestId, OutboxStatus.PENDING, System.currentTimeMillis(), "{}"),
            listOf(
                OutboxOperationEntity(
                    requestId = requestId,
                    seq = 1,
                    collection = "user",
                    method = method,
                    recordId = recordId,
                    payloadJson = json,
                ),
            ),
        )
    }

    private fun parse(raw: String): JsonObject? =
        runCatching { Json.parseToJsonElement(raw) as? JsonObject }.getOrNull()
}

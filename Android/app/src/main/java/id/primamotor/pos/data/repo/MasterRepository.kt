package id.primamotor.pos.data.repo

import androidx.room.withTransaction
import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.LocalRecordEntity
import id.primamotor.pos.data.local.OutboxEntity
import id.primamotor.pos.data.local.OutboxOperationEntity
import id.primamotor.pos.data.local.OutboxStatus
import id.primamotor.pos.data.local.PendingMediaEntity
import id.primamotor.pos.domain.RecordId
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Master data `dropdown` (Person, Cashflow, Persenan, User) dengan aturan yang sama seperti
 * `pages/person.tsx` dan `pages/settings.tsx`: satu koleksi, dikelompokkan `kategori` + `jenis`.
 *
 * Tulis offline lewat outbox. Hapus hanya untuk level 1 dan tetap melewati batch atomik server.
 */
data class MasterDraft(
    val id: String? = null,
    val kategori: String = "",
    val jenis: String = "",
    val text1: String = "",
    val text2: String = "",
    val text3: String = "",
    val text4: String = "",
    val text5: String = "",
    val text6: String = "",
    val text7: String = "",
    val text8: String = "",
    val text9: String = "",
    val text10: String = "",
    val number1: String = "0",
    val number2: String = "0",
    val number3: String = "0",
    val number4: String = "0",
    val number5: String = "0",
    val enum1: String = "",
    val enum2: String = "",
    val enum3: String = "",
    val enum4: String = "",
    val alamat: String = "",
    val phone: String = "",
    val latlong: String = "",
    val linkImage: String = "",
    val linkDokumen: String = "",
    val visibilitas: String = "1,2,3,4,5,6,7",
    val idLama: String = "",
    val operator: String = "",
    /** Foto/berkas lokal; diunggah setelah baris server ada. */
    val mediaPath: String? = null,
)

sealed interface MasterSave {
    data class Saved(val id: String, val created: Boolean) : MasterSave
    data class Rejected(val message: String) : MasterSave
}

private val MASTER_SYSTEM_FIELDS = setOf("created", "updated", "collectionId", "collectionName", "expand")

class MasterRepository(
    private val db: AppDatabase,
    private val idGenerator: () -> String = { RecordId.create() },
) {

    suspend fun save(draft: MasterDraft): MasterSave = db.withTransaction {
        val isPerson = draft.kategori.equals("Person", ignoreCase = true)
        val required = if (isPerson) "Nama dan Jenis Transaksi wajib diisi!" else null
        if (draft.kategori.isBlank()) return@withTransaction MasterSave.Rejected("Kategori wajib diisi.")
        if (draft.jenis.isBlank()) {
            return@withTransaction MasterSave.Rejected(required ?: "Jenis wajib diisi.")
        }
        if (draft.text1.isBlank()) {
            return@withTransaction MasterSave.Rejected(required ?: "Label utama wajib diisi.")
        }

        val existing = draft.id?.let { db.localRecordDao().find("dropdown", it) }
        if (draft.id != null && existing == null) {
            return@withTransaction MasterSave.Rejected("Data tidak ditemukan di cache. Sinkronkan dulu.")
        }
        val id = existing?.id ?: idGenerator()
        val previous = existing?.json?.let(::parse)

        val json = buildJsonObject {
            previous?.forEach { (key, value) ->
                if (key !in MASTER_SYSTEM_FIELDS) put(key, value)
            }
            put("id", id)
            put("kategori", draft.kategori.trim())
            put("jenis", draft.jenis.trim())
            put("text_1", draft.text1.trim())
            put("text_2", draft.text2.trim())
            put("text_3", draft.text3.trim())
            put("text_4", draft.text4.trim())
            put("text_5", draft.text5.trim())
            put("text_6", draft.text6.trim())
            put("text_7", draft.text7.trim())
            put("text_8", draft.text8.trim())
            put("text_9", draft.text9.trim())
            put("text_10", draft.text10.trim())
            put("number_1", draft.number1.toBigDecimalOrNull() ?: 0)
            put("number_2", draft.number2.toBigDecimalOrNull() ?: 0)
            put("number_3", draft.number3.toBigDecimalOrNull() ?: 0)
            put("number_4", draft.number4.toBigDecimalOrNull() ?: 0)
            put("number_5", draft.number5.toBigDecimalOrNull() ?: 0)
            put("enum_1", draft.enum1.trim())
            put("enum_2", draft.enum2.trim())
            put("enum_3", draft.enum3.trim())
            put("enum_4", draft.enum4.trim())
            put("address", draft.alamat.trim())
            put("phone", draft.phone.filter { it.isDigit() }.toBigDecimalOrNull() ?: 0)
            put("latlong", draft.latlong.trim())
            put("link_image", draft.linkImage.trim())
            put("doc", draft.linkDokumen.trim())
            put("visibilitas", draft.visibilitas.trim())
            // Web mengirim id_lama kosong (bertabrakan dengan unique index). Native membuat unik.
            put("id_lama", draft.idLama.trim().ifBlank { if (isPerson) personCode() else uniqueCode() })
            put("operator", draft.operator.trim())
        }

        db.localRecordDao().upsertAll(
            listOf(
                LocalRecordEntity(
                    collection = "dropdown",
                    id = id,
                    dateKey = "",
                    groupKey = draft.jenis.trim(),
                    text = listOf(draft.text1, draft.text2, draft.jenis, draft.kategori, draft.idLama)
                        .joinToString(" ") { it.lowercase().trim() },
                    json = json.toString(),
                    dirty = 1,
                    updatedAt = System.currentTimeMillis(),
                ),
            ),
        )

        enqueue(
            collection = "dropdown",
            method = if (existing == null) "create" else "update",
            recordId = id,
            json = json.toString(),
        )
        draft.mediaPath?.let { path ->
            db.mediaDao().add(
                PendingMediaEntity(
                    collection = "dropdown",
                    recordId = id,
                    field = "file",
                    filePath = path,
                ),
            )
        }
        MasterSave.Saved(id, existing == null)
    }

    suspend fun delete(id: String): Boolean = db.withTransaction {
        val existing = db.localRecordDao().find("dropdown", id) ?: return@withTransaction false
        db.localRecordDao().delete("dropdown", id)
        enqueue("dropdown", "delete", id, existing.json)
        true
    }

    /** `PSN-####`, cermin `id_lama` otomatis form person web. */
    private fun personCode(): String =
        "PSN-" + (System.currentTimeMillis() % 10_000).toString().padStart(4, '0')

    private fun uniqueCode(): String = "m" + RecordId.create(14)

    private suspend fun enqueue(collection: String, method: String, recordId: String, json: String) {
        val requestId = RecordId.create(24)
        db.outboxDao().enqueueWithOperations(
            OutboxEntity(requestId, OutboxStatus.PENDING, System.currentTimeMillis(), "{}"),
            listOf(
                OutboxOperationEntity(
                    requestId = requestId,
                    seq = 1,
                    collection = collection,
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

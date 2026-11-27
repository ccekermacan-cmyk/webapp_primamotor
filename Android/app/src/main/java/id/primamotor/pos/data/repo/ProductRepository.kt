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
import java.math.BigDecimal

data class ProductDraft(
    val id: String? = null,
    val nama: String = "",
    val barcode: String = "",
    val idLama: String = "",
    val kategori: String = "",
    val merk: String = "",
    val jenis: String = "",
    val varian: String = "",
    val tipe: String = "",
    val unit: String = "Pcs",
    val beli: BigDecimal = BigDecimal.ZERO,
    val sell1: BigDecimal = BigDecimal.ZERO,
    val sell2: BigDecimal = BigDecimal.ZERO,
    val sell3: BigDecimal = BigDecimal.ZERO,
    val stok: BigDecimal = BigDecimal.ZERO,
    val min1: BigDecimal = BigDecimal.ZERO,
)

sealed interface ProductSave {
    data class Saved(val id: String, val created: Boolean) : ProductSave
    data class Rejected(val message: String) : ProductSave
}

/** Tambah/ubah produk lewat outbox. Hapus produk tetap di web (aturan hapus tidak dilonggarkan). */
class ProductRepository(
    private val db: AppDatabase,
    private val idGenerator: () -> String = { RecordId.create() },
) {

    suspend fun save(draft: ProductDraft): ProductSave = db.withTransaction {
        if (draft.nama.isBlank()) return@withTransaction ProductSave.Rejected("Nama produk wajib diisi.")
        if (draft.sell1.signum() < 0 || draft.beli.signum() < 0) {
            return@withTransaction ProductSave.Rejected("Harga tidak boleh negatif.")
        }
        if (draft.stok.signum() < 0) return@withTransaction ProductSave.Rejected("Stok tidak boleh negatif.")

        val existing = draft.id?.let { db.localRecordDao().find("produk", it) }
        if (draft.id != null && existing == null) {
            return@withTransaction ProductSave.Rejected("Produk tidak ditemukan di cache. Sinkronkan dulu.")
        }
        val id = existing?.id ?: idGenerator()
        val previous = existing?.json?.let(::parse)

        val json = buildJsonObject {
            previous?.forEach { (key, value) -> put(key, value) }
            put("id", id)
            put("nama", draft.nama.trim())
            put("barcode", draft.barcode.trim())
            put("id_lama", draft.idLama.trim())
            put("kategori", draft.kategori.trim())
            put("merk", draft.merk.trim())
            put("jenis", draft.jenis.trim())
            put("varian", draft.varian.trim())
            put("tipe", draft.tipe.trim())
            put("unit", draft.unit.trim())
            put("beli", draft.beli)
            put("sell_1", draft.sell1)
            put("sell_2", draft.sell2)
            put("sell_3", draft.sell3)
            put("stok_3", draft.stok)
            put("min_1", draft.min1)
        }

        db.localRecordDao().upsertAll(
            listOf(
                LocalRecordEntity(
                    collection = "produk",
                    id = id,
                    dateKey = "",
                    groupKey = draft.kategori.trim(),
                    text = listOf(draft.nama, draft.barcode, draft.idLama, draft.merk, draft.kategori)
                        .joinToString(" ") { it.lowercase().trim() },
                    json = json.toString(),
                    dirty = 1,
                    updatedAt = System.currentTimeMillis(),
                ),
            ),
        )

        val requestId = RecordId.create(24)
        db.outboxDao().enqueueWithOperations(
            OutboxEntity(requestId, OutboxStatus.PENDING, System.currentTimeMillis(), "{}"),
            listOf(
                OutboxOperationEntity(
                    requestId = requestId,
                    seq = 1,
                    collection = "produk",
                    method = if (existing == null) "create" else "update",
                    recordId = id,
                    payloadJson = json.toString(),
                ),
            ),
        )

        ProductSave.Saved(id, existing == null)
    }

    private fun parse(raw: String): JsonObject? = runCatching { Json.parseToJsonElement(raw) as? JsonObject }.getOrNull()
}
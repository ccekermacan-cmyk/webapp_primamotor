package id.primamotor.pos.data.repo

import androidx.room.withTransaction
import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.LocalRecordEntity
import id.primamotor.pos.data.local.OutboxEntity
import id.primamotor.pos.data.local.OutboxOperationEntity
import id.primamotor.pos.data.local.OutboxStatus
import id.primamotor.pos.data.local.PendingMediaEntity
import id.primamotor.pos.domain.RecordId
import id.primamotor.pos.domain.WibDate
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.math.BigDecimal
import java.time.LocalDate

/** Field sama dengan form produk web: `beli`, `sell_1..6`, `min_1..3`, `stok_3`. */
data class ProductDraft(
    val id: String? = null,
    val nama: String = "",
    val barcode: String = "",
    val idLama: String = "",
    val kategori: String = "",
    val merk: String = "",
    val jenis: String = "",
    val varian: String = "",
    val keterangan: String = "",
    val tipe: String = "",
    val unit: String = "Pcs",
    val beli: BigDecimal = BigDecimal.ZERO,
    val sell1: BigDecimal = BigDecimal.ZERO,
    val sell2: BigDecimal = BigDecimal.ZERO,
    val sell3: BigDecimal = BigDecimal.ZERO,
    val sell4: BigDecimal = BigDecimal.ZERO,
    val sell5: BigDecimal = BigDecimal.ZERO,
    val sell6: BigDecimal = BigDecimal.ZERO,
    val stok: BigDecimal = BigDecimal.ZERO,
    val min1: BigDecimal = BigDecimal.ZERO,
    val min2: BigDecimal = BigDecimal.ZERO,
    val min3: BigDecimal = BigDecimal.ZERO,
    /** Path foto lokal yang menunggu jaringan; tidak dikirim sebagai field JSON. */
    val mediaPath: String? = null,
)

sealed interface ProductSave {
    data class Saved(val id: String, val created: Boolean) : ProductSave
    data class Rejected(val message: String) : ProductSave
}

/** Tambah/ubah/hapus produk lewat outbox. Hapus butuh verifikasi password di lapisan UI. */
class ProductRepository(
    private val db: AppDatabase,
    private val idGenerator: () -> String = { RecordId.create() },
) {

    suspend fun save(draft: ProductDraft): ProductSave = db.withTransaction {
        if (draft.nama.isBlank()) return@withTransaction ProductSave.Rejected("Nama produk wajib diisi.")
        if (listOf(draft.beli, draft.sell1, draft.sell2, draft.sell3, draft.sell4, draft.sell5, draft.sell6).any { it.signum() < 0 }) {
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
            put("keterangan", draft.keterangan.trim())
            put("tipe", draft.tipe.split(',').map { it.trim() }.filter { it.isNotBlank() }.distinct().sorted().joinToString(", "))
            put("unit", draft.unit.trim().ifBlank { "Pcs" })
            put("beli", draft.beli)
            put("sell_1", draft.sell1)
            put("sell_2", draft.sell2)
            put("sell_3", draft.sell3)
            put("sell_4", draft.sell4)
            put("sell_5", draft.sell5)
            put("sell_6", draft.sell6)
            put("stok_3", draft.stok)
            put("min_1", draft.min1)
            put("min_2", draft.min2)
            put("min_3", draft.min3)
        }

        db.localRecordDao().upsertAll(
            listOf(
                LocalRecordEntity(
                    collection = "produk",
                    id = id,
                    dateKey = "",
                    groupKey = draft.kategori.trim(),
                    text = listOf(draft.nama, draft.barcode, draft.idLama, draft.merk, draft.kategori, draft.jenis)
                        .joinToString(" ") { it.lowercase().trim() },
                    json = json.toString(),
                    dirty = 1,
                    updatedAt = System.currentTimeMillis(),
                ),
            ),
        )

        enqueue(if (existing == null) "create" else "update", id, json)
        draft.mediaPath?.let { path ->
            db.mediaDao().add(
                PendingMediaEntity(
                    collection = "produk",
                    recordId = id,
                    field = "file",
                    filePath = path,
                ),
            )
        }
        ProductSave.Saved(id, existing == null)
    }

    /**
     * Penyesuaian stok cepat (+1/-1) seperti tombol web: tulis `log_stock`, server
     * menghitung ulang stok. Stok lokal langsung bergerak supaya daftar tidak menunggu.
     */
    suspend fun adjustStock(productId: String, delta: Int, operator: String): ProductSave = db.withTransaction {
        if (delta != 1 && delta != -1) return@withTransaction ProductSave.Rejected("Perubahan stok hanya +1 atau -1.")
        val existing = db.localRecordDao().find("produk", productId)
            ?: return@withTransaction ProductSave.Rejected("Produk tidak ditemukan di cache. Sinkronkan dulu.")
        val previous = parse(existing.json) ?: return@withTransaction ProductSave.Rejected("Data produk rusak di cache.")
        val current = previous.number("stok_3")
        val next = current + BigDecimal.valueOf(delta.toLong())
        if (next.signum() < 0) return@withTransaction ProductSave.Rejected("Stok tidak cukup.")

        val updated = buildJsonObject {
            previous.forEach { (key, value) -> put(key, value) }
            put("stok_3", next)
        }
        db.localRecordDao().upsertAll(listOf(existing.copy(json = updated.toString(), dirty = 1, updatedAt = System.currentTimeMillis())))

        val nowIso = WibDate.nowIso()
        val dateKey = LocalDate.now(WibDate.WIB).toString()
        val logId = idGenerator()
        val logJson = buildJsonObject {
            put("id", logId)
            put("id_lama", "")
            put("created_at", nowIso)
            put("operator", operator)
            put("item", previous.text("id_lama").ifBlank { productId })
            put("item_baru", productId)
            put("qty", BigDecimal.ONE)
            put("price_1", BigDecimal.ZERO)
            put("price_2", BigDecimal.ZERO)
            put("normal", BigDecimal.ZERO)
            put("boolean", if (delta > 0) "in" else "out")
            put("ref", "")
            put("ref_baru", "")
        }
        db.localRecordDao().upsertAll(
            listOf(
                LocalRecordEntity(
                    collection = "log_stock",
                    id = logId,
                    dateKey = dateKey,
                    groupKey = productId,
                    text = previous.text("nama").lowercase(),
                    json = logJson.toString(),
                    dirty = 1,
                    updatedAt = System.currentTimeMillis(),
                ),
            ),
        )
        enqueueOperation("log_stock", "create", logId, logJson)
        ProductSave.Saved(productId, created = false)
    }

    suspend fun delete(id: String): Boolean = db.withTransaction {
        val existing = db.localRecordDao().find("produk", id) ?: return@withTransaction false
        db.localRecordDao().delete("produk", id)
        enqueue("delete", id, parse(existing.json) ?: JsonObject(emptyMap()))
        true
    }

    /** Salinan produk: id_lama acak, stok 0, sisanya sama; foto tidak ikut. */
    fun copyOf(product: Produk): ProductDraft = ProductDraft(
        nama = "${product.nama} (Salinan)",
        barcode = "",
        idLama = (100000..999999).random().toString(),
        kategori = product.kategori,
        merk = product.merk,
        jenis = product.jenis,
        varian = product.varian,
        keterangan = product.keterangan,
        tipe = product.tipe,
        unit = product.unit,
        beli = product.beli,
        sell1 = product.sell1,
        sell2 = product.sell2,
        sell3 = product.sell3,
        sell4 = product.sell4,
        sell5 = product.sell5,
        sell6 = product.sell6,
        stok = BigDecimal.ZERO,
        min1 = product.min1,
        min2 = product.min2,
        min3 = product.min3,
    )

    private suspend fun enqueue(method: String, recordId: String, json: JsonObject) =
        enqueueOperation("produk", method, recordId, json)

    private suspend fun enqueueOperation(collection: String, method: String, recordId: String, json: JsonObject) {
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
                    payloadJson = json.toString(),
                ),
            ),
        )
    }

    private fun parse(raw: String): JsonObject? = runCatching { Json.parseToJsonElement(raw) as? JsonObject }.getOrNull()
}

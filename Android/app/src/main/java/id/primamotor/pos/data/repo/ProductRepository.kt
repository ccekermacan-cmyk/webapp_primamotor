package id.primamotor.pos.data.repo

import androidx.room.withTransaction
import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.LocalRecordEntity
import id.primamotor.pos.data.local.OutboxEntity
import id.primamotor.pos.data.local.OutboxOperationEntity
import id.primamotor.pos.data.local.OutboxStatus
import id.primamotor.pos.data.local.PendingMediaEntity
import id.primamotor.pos.domain.ProductFeed
import id.primamotor.pos.domain.RecordId
import id.primamotor.pos.domain.WibDate
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.math.BigDecimal
import java.time.LocalDate

/** Field sama dengan form produk web: `beli`, `sell_1..6`, `min_1..3`, `stok_1..3`. */
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
    val stok1: BigDecimal = BigDecimal.ZERO,
    val stok2: BigDecimal = BigDecimal.ZERO,
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

    suspend fun save(draft: ProductDraft, operator: String = "Admin"): ProductSave = db.withTransaction {
        validate(draft)?.let { return@withTransaction ProductSave.Rejected(it) }

        val existing = draft.id?.let { db.localRecordDao().find("produk", it) }
        if (draft.id != null && existing == null) {
            return@withTransaction ProductSave.Rejected("Produk tidak ditemukan di cache. Sinkronkan dulu.")
        }
        val id = existing?.id ?: idGenerator()
        val previous = existing?.json?.let(::parse)
        val previousStok = previous?.number("stok_3") ?: BigDecimal.ZERO
        val requestedStok = draft.stok
        val delta = if (existing == null) requestedStok else requestedStok.subtract(previousStok)

        val code = if (existing == null) {
            ProductFeed.normalizeCode(draft.idLama).ifBlank { (1..99999).random().toString() }
        } else {
            draft.idLama.trim().ifBlank { previous?.text("id_lama").orEmpty() }
        }

        val json = buildJsonObject {
            previous?.forEach { (key, value) ->
                // Server menolak `stok_3` di update; stok hanya lewat `log_stock`.
                // Field sistem tidak boleh ikut dikirim.
                if (key != "stok_3" && key !in SYSTEM_FIELDS) put(key, value)
            }
            put("id", id)
            put("nama", draft.nama.trim())
            put("barcode", draft.barcode.trim())
            put("id_lama", code)
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
            put("stok_1", draft.stok1)
            put("stok_2", draft.stok2)
            if (existing == null) put("stok_3", BigDecimal.ZERO)
            put("min_1", draft.min1)
            put("min_2", draft.min2)
            put("min_3", draft.min3)
        }

        val operations = mutableListOf<Op>()
        operations += Op("produk", if (existing == null) "create" else "update", id, json)

        if (delta.signum() != 0) {
            val logId = idGenerator()
            val nowIso = WibDate.nowIso()
            val logJson = buildJsonObject {
                put("id", logId)
                put("id_lama", "")
                put("created_at", nowIso)
                put("operator", operator)
                put("item", code)
                put("item_baru", id)
                put("qty", delta.abs())
                put("price_1", BigDecimal.ZERO)
                put("price_2", BigDecimal.ZERO)
                put("normal", BigDecimal.ZERO)
                put("boolean", if (delta.signum() > 0) "in" else "out")
                put("ref", "")
                put("ref_baru", "")
                if (existing != null) put("expected_stock", previousStok)
            }
            operations += Op("log_stock", "create", logId, logJson)
        }

        val localJson = buildJsonObject {
            json.forEach { (key, value) -> put(key, value) }
            put("stok_3", requestedStok)
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
                    json = localJson.toString(),
                    dirty = 1,
                    updatedAt = System.currentTimeMillis(),
                ),
            ),
        )

        enqueueAll(operations)
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

    private fun validate(draft: ProductDraft): String? {
        listOf("kategori" to draft.kategori, "merk" to draft.merk, "unit" to draft.unit)
            .firstOrNull { it.second.isBlank() }
            ?.let { return "${it.first} wajib diisi." }
        val numerics = listOf(
            "beli" to draft.beli, "sell_1" to draft.sell1, "sell_2" to draft.sell2,
            "sell_3" to draft.sell3, "sell_4" to draft.sell4, "sell_5" to draft.sell5,
            "sell_6" to draft.sell6, "min_1" to draft.min1, "min_2" to draft.min2,
            "min_3" to draft.min3, "stok_1" to draft.stok1, "stok_2" to draft.stok2,
            "stok_3" to draft.stok,
        )
        numerics.firstOrNull { (_, value) -> !isWholeNonNegative(value) }
            ?.let { return "${it.first} harus bilangan bulat nol atau lebih." }
        if (draft.sell6.signum() <= 0) return "Harga retail harus lebih dari nol."
        return null
    }

    private fun isWholeNonNegative(value: BigDecimal): Boolean =
        value.signum() >= 0 && value.stripTrailingZeros().scale() <= 0

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

    /** Salinan produk: id_lama acak, stok_1/stok_3 nol, stok_2 ikut seperti web; foto tidak ikut. */
    fun copyOf(product: Produk): ProductDraft = ProductDraft(
        nama = ProductFeed.fullName(product),
        barcode = "",
        idLama = (1..99999).random().toString(),
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
        stok1 = BigDecimal.ZERO,
        stok2 = product.stok2,
        min1 = product.min1,
        min2 = product.min2,
        min3 = product.min3,
    )

    private data class Op(val collection: String, val method: String, val recordId: String, val json: JsonObject)

    private suspend fun enqueue(method: String, recordId: String, json: JsonObject) =
        enqueueAll(listOf(Op("produk", method, recordId, json)))

    private suspend fun enqueueAll(operations: List<Op>) {
        if (operations.isEmpty()) return
        val requestId = RecordId.create(24)
        db.outboxDao().enqueueWithOperations(
            OutboxEntity(requestId, OutboxStatus.PENDING, System.currentTimeMillis(), "{}"),
            operations.mapIndexed { index, op ->
                OutboxOperationEntity(
                    requestId = requestId,
                    seq = index + 1,
                    collection = op.collection,
                    method = op.method,
                    recordId = op.recordId,
                    payloadJson = op.json.toString(),
                )
            },
        )
    }

    private suspend fun enqueueOperation(collection: String, method: String, recordId: String, json: JsonObject) =
        enqueueAll(listOf(Op(collection, method, recordId, json)))

    private val SYSTEM_FIELDS = setOf("created", "updated", "collectionId", "collectionName", "expand")

private fun parse(raw: String): JsonObject? = runCatching { Json.parseToJsonElement(raw) as? JsonObject }.getOrNull()
}


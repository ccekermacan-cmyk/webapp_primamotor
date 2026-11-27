package id.primamotor.pos.data.sync

import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.LocalRecordEntity
import id.primamotor.pos.data.remote.SessionManager
import id.primamotor.pos.domain.WibDate
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.time.LocalDate

/**
 * Menarik data server ke Room.
 *
 * Referensi kecil (`produk`, `dropdown`, `user`, `gaji`) ditarik penuh.
 * Data finansial ditarik per jendela: 30 hari terakhir dihitung di WIB.
 * Baris lokal `dirty = 1` tidak pernah dihapus.
 */
class Puller(
    private val db: AppDatabase,
    private val sessions: SessionManager,
    private val windowDays: Int = 30,
) {
    private data class Spec(
        val collection: String,
        val dateField: String?,
        val groupField: String?,
        val textFields: List<String>,
    )

    private val specs = listOf(
        Spec("produk", null, "kategori", listOf("nama", "id_lama", "merk", "varian", "barcode", "kategori")),
        Spec("dropdown", null, "jenis", listOf("text_1", "text_2", "id_lama")),
        Spec("user", null, null, listOf("name", "username")),
        Spec("gaji", null, "person", listOf("person", "id_lama")),
        Spec("menu", "created_at", "person", listOf("text", "person", "id_lama")),
        Spec("cashflow", "created_at", "account_1", listOf("note", "person", "jenis", "mutasi")),
        Spec("log_stock", "created_at", "item", listOf("item", "id_lama")),
        Spec("ongkos", "created_at", "person", listOf("person")),
        Spec("bon", "created", "user", listOf("note", "person", "operator")),
        Spec("report", "created_at", null, listOf("kasir_toko")),
    )

    data class Result(val records: Int, val deleted: Int)

    suspend fun pull(): Result {
        val today = LocalDate.now(WibDate.WIB)
        val from = today.minusDays(windowDays.toLong()).toString()
        val to = today.toString()

        var records = 0
        var deleted = 0
        for (spec in specs) {
            val entities = fetch(spec, from).mapNotNull { toEntity(spec, it) }
            if (entities.isNotEmpty()) {
                db.localRecordDao().upsertAll(entities)
                records += entities.size
            }
            val range = if (spec.dateField != null) from to to else "0000-01-01" to "9999-12-31"
            deleted += db.localRecordDao().deleteMissing(
                spec.collection,
                range.first,
                range.second,
                entities.map { it.id }.ifEmpty { listOf("__none__") },
            )
        }
        return Result(records, deleted)
    }

    private suspend fun fetch(spec: Spec, from: String): List<JsonObject> {
        val result = mutableListOf<JsonObject>()
        var page = 1
        while (true) {
            val filter = spec.dateField?.let { field ->
                val start = WibDate.startOfDayIso(LocalDate.parse(from))
                "%22$field%22%20%3E%3D%20%22${start}%22"
            }
            val path = buildString {
                append("/api/collections/").append(spec.collection).append("/records?perPage=200&page=")
                append(page)
                if (filter != null) append("&filter=").append(filter)
                append("&sort=-").append(spec.dateField ?: "id")
            }
            val element = sessions.call(path)
            val items = (element as? JsonObject)?.get("items") as? JsonArray ?: break
            items.forEach { (it as? JsonObject)?.let(result::add) }
            if (items.size < 200) break
            page += 1
        }
        return result
    }

    private fun toEntity(spec: Spec, item: JsonObject): LocalRecordEntity? {
        val id = item.string("id") ?: return null
        val dateKey = spec.dateField?.let { field -> WibDate.dayOf(item.string(field))?.toString() }.orEmpty()
        val groupKey = spec.groupField?.let { field -> item.string(field) }.orEmpty()
        val text = spec.textFields
            .mapNotNull { field -> item.string(field)?.takeIf { it.isNotBlank() } }
            .joinToString(" ") { it.lowercase() }
        return LocalRecordEntity(
            collection = spec.collection,
            id = id,
            dateKey = dateKey,
            groupKey = groupKey,
            text = text,
            json = item.toString(),
            dirty = 0,
            updatedAt = 0L,
        )
    }

    private fun JsonObject.string(field: String): String? {
        val element = this[field] ?: return null
        if (element is JsonNull) return null
        return runCatching { element.jsonPrimitive.content }.getOrNull()?.takeIf { it.isNotBlank() }
    }

    @Suppress("unused")
    private fun JsonObject.rawString(field: String): String = string(field).orEmpty()
}
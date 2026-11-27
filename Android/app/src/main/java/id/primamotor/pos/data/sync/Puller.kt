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
        val days: Int = 30,
    )

    private val specs = listOf(
        Spec("produk", null, "kategori", listOf("nama", "id_lama", "merk", "varian", "barcode", "kategori")),
        Spec("dropdown", null, "jenis", listOf("text_1", "text_2", "id_lama")),
        Spec("user", null, null, listOf("name", "username")),
        Spec("gaji", null, "person", listOf("person", "id_lama")),
        // Riwayat nota disimpan lebih panjang supaya pelunasan tempo lama tetap bisa dicari.
        Spec("menu", "created_at", "person", listOf("text", "person", "id_lama"), days = 180),
        Spec("cashflow", "created_at", "account_1", listOf("note", "person", "jenis", "mutasi"), days = 90),
        Spec("log_stock", "created_at", "item", listOf("item", "id_lama")),
        Spec("ongkos", "created_at", "person", listOf("person")),
        Spec("bon", "created", "user", listOf("note", "person", "operator"), days = 180),
        Spec("report", "created_at", null, listOf("kasir_toko")),
    )

    data class Result(val records: Int, val deleted: Int)

    suspend fun pull(): Result {
        val today = LocalDate.now(WibDate.WIB)
        val to = today.toString()

        var records = 0
        var deleted = 0
        for (spec in specs) {
            val days = spec.days.coerceAtLeast(windowDays)
            val from = today.minusDays(days.toLong()).toString()
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
        // Jatuh tempo bisa lebih tua dari jendela nota, jadi ditarik tanpa batas tanggal.
        val tempo = fetchTempo().mapNotNull { toEntity(specs.first { it.collection == "menu" }, it) }
        if (tempo.isNotEmpty()) {
            db.localRecordDao().upsertAll(tempo)
            records += tempo.size
        }
        return Result(records, deleted)
    }

    private suspend fun fetchTempo(): List<JsonObject> {
        val result = mutableListOf<JsonObject>()
        var page = 1
        while (true) {
            val path = "/api/collections/menu/records?perPage=200&page=$page" +
                "&filter=" + "jenis%20~%20%22pembelian%22%20%26%26%20status%20%3D%20%22belum%22%20%26%26%20tempo%20!%3D%20%22%22" +
                "&sort=tempo"
            val items = (sessions.call(path) as? JsonObject)?.get("items") as? JsonArray ?: break
            items.forEach { (it as? JsonObject)?.let(result::add) }
            if (items.size < 200) break
            page += 1
        }
        return result
    }

    private suspend fun fetch(spec: Spec, from: String): List<JsonObject> {
        val result = mutableListOf<JsonObject>()
        var page = 1
        while (true) {
            val filter = spec.dateField?.let { field ->
                val start = WibDate.startOfDayIso(LocalDate.parse(from))
                // Sintaks PocketBase: nama field tanpa kutip, nilai string dikutip.
                "$field%3E%3D%22${start.replace(" ", "%20")}%22"
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
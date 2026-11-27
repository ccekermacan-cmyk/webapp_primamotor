package id.primamotor.pos.data.repo

import androidx.room.withTransaction
import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.LocalRecordEntity
import id.primamotor.pos.data.local.OutboxEntity
import id.primamotor.pos.data.local.OutboxOperationEntity
import id.primamotor.pos.data.local.OutboxStatus
import id.primamotor.pos.domain.CartLine
import id.primamotor.pos.domain.PosValidation
import id.primamotor.pos.domain.RecordId
import id.primamotor.pos.domain.WibDate
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.math.BigDecimal
import java.time.LocalDate

data class CashflowInput(
    val accountId: String,
    val nominal: BigDecimal,
)

data class MekanikInput(val idLama: String, val ongkos: BigDecimal)

data class CheckoutForm(
    val personIdLama: String = "umum1",
    val payment: String = "Tunai",
    val nominalBayar: BigDecimal = BigDecimal.ZERO,
    val cashflow: List<CashflowInput> = emptyList(),
    val mekanik: List<MekanikInput> = emptyList(),
    val note: String = "",
    val noteMenu: String = "",
    val tempoDate: String = "",
    val marketplace: String = "",
    val adminFee: BigDecimal = BigDecimal.ZERO,
    val cashback: BigDecimal = BigDecimal.ZERO,
    /** Waktu perangkat dalam ISO UTC; dipakai sebagai `created_at`. */
    val createdAtIso: String = WibDate.nowIso(),
)

sealed interface CheckoutResult {
    data class Saved(val notaId: String, val total: BigDecimal, val change: BigDecimal, val status: String) : CheckoutResult
    data class Rejected(val message: String) : CheckoutResult
}

/**
 * Menulis satu transaksi POS ke Room dan antrean outbox dalam SATU transaksi Room.
 *
 * Efek stok dan saldo diterapkan lokal agar transaksi berikutnya saat offline melihat angka terbaru.
 * Server tetap menghitung ulang saat push; nilai lokal hanya untuk pencegahan dini.
 */
class CheckoutRepository(
    private val db: AppDatabase,
    private val idGenerator: () -> String = { RecordId.create() },
) {

    suspend fun commit(
        jenis: String,
        cart: List<CartLine>,
        form: CheckoutForm,
        operator: String,
    ): CheckoutResult = db.withTransaction {
        PosValidation.cartError(cart)?.let { return@withTransaction CheckoutResult.Rejected(it) }

        val direction = PosValidation.directionOf(jenis)
        val stocks = cart.map { it.productId }.distinct().associateWith { productId ->
            db.localRecordDao().find("produk", productId)?.json
                ?.let { parseObject(it)?.number("stok_3") } ?: BigDecimal.ZERO
        }
        PosValidation.stockError(cart, stocks, direction)?.let { return@withTransaction CheckoutResult.Rejected(it) }

        val total = cart.fold(BigDecimal.ZERO) { sum, line -> sum + line.price.multiply(line.qty) }
        PosValidation.paymentError(form.payment, form.nominalBayar, total, form.tempoDate)
            ?.let { return@withTransaction CheckoutResult.Rejected(it) }

        val cashflows = form.cashflow.filter { it.accountId.isNotEmpty() && it.nominal.signum() > 0 }
        val balances = cashflows.map { it.accountId }.distinct().associateWith { accountId ->
            db.localRecordDao().find("dropdown", accountId)?.json
                ?.let { parseObject(it)?.number("number_1") } ?: BigDecimal.ZERO
        }
        val mutasi = if (direction == "out") "in" else "out"
        cashflows.forEach { entry ->
            val after = if (mutasi == "in") {
                balances.getValue(entry.accountId) + entry.nominal
            } else {
                balances.getValue(entry.accountId) - entry.nominal
            }
            if (after.signum() < 0) {
                return@withTransaction CheckoutResult.Rejected("Saldo akun tidak cukup untuk pembayaran ini.")
            }
        }

        val dibayar = cashflows.fold(BigDecimal.ZERO) { sum, entry -> sum + entry.nominal }
        val status = PosValidation.statusOf(dibayar, total)
        val notaId = idGenerator()
        val createdAt = form.createdAtIso
        val dateKey = WibDate.dayOf(createdAt)?.toString() ?: LocalDate.now(WibDate.WIB).toString()
        val personNama = form.personIdLama
        val lower = jenis.lowercase()
        val isService = lower.contains("service") || lower.contains("servis")

        val menuJson = buildJsonObject {
            put("id", notaId)
            put("jenis", jenis)
            put("person", personNama)
            put("text", form.noteMenu)
            put("payment", if (form.payment == "Tunai") "cash" else "tempo")
            put("operator", operator)
            put("created_at", createdAt)
            put("qty", cart.fold(BigDecimal.ZERO) { sum, line -> sum + line.qty })
            put("cashback", if (form.personIdLama == "umum1") BigDecimal.ZERO else form.cashback)
            put("admin", if (form.personIdLama == "umum1") BigDecimal.ZERO else form.adminFee)
            put("marketplace", if (form.personIdLama == "umum1") "" else form.marketplace)
            put("status", status)
            put("total", total)
            put("dibayar", dibayar)
            put("date_lunas", if (status == "lunas") createdAt else "")
            put("tempo", if (form.payment == "Tempo") form.tempoDate else "")
        }

        val records = mutableListOf(
            local("menu", notaId, menuJson, dateKey, personNama, text = "$jenis $personNama ${form.noteMenu}".lowercase(), dirty = 1),
        )
        val operations = mutableListOf(
            OutboxOperationEntity(
                requestId = "",
                seq = 0,
                collection = "menu",
                method = "create",
                recordId = notaId,
                payloadJson = menuJson.toString(),
            ),
        )

        val movingStock = stocks.toMutableMap()
        cart.forEach { line ->
            val logId = idGenerator()
            val logJson = buildJsonObject {
                put("id", logId)
                put("id_lama", "")
                put("created_at", createdAt)
                put("operator", operator)
                put("item", line.productId)
                put("qty", line.qty)
                put("item_baru", line.productId)
                put("price_1", line.price)
                put("price_2", if (direction == "in") BigDecimal.ZERO else line.price.multiply(line.qty))
                put("normal", if (direction == "in") BigDecimal.ZERO else line.normalPrice.multiply(line.qty))
                put("boolean", direction)
                put("ref", notaId)
                put("ref_baru", notaId)
            }
            records += local("log_stock", logId, logJson, dateKey, line.productId, text = line.nama.lowercase(), dirty = 1)
            operations += op(operations.size + 1, "log_stock", "create", logId, logJson)

            val nextStock = if (direction == "in") {
                movingStock.getValue(line.productId) + line.qty
            } else {
                movingStock.getValue(line.productId) - line.qty
            }
            movingStock[line.productId] = nextStock
            updateProductStock(line.productId, nextStock)
        }

        cashflows.forEach { entry ->
            val account = db.localRecordDao().find("dropdown", entry.accountId)?.let { parseObject(it.json) }
            val cashflowId = idGenerator()
            val json = buildJsonObject {
                put("id", cashflowId)
                put("id_lama", "")
                put("created_at", createdAt)
                put("operator", operator)
                put("nominal", entry.nominal)
                put("jenis", jenis)
                put("mutasi", mutasi)
                put("account_1", entry.accountId)
                put("account_2", "")
                put("acc1", account?.text("id_lama").orEmpty())
                put("acc2", "")
                put("note", form.note.ifBlank { "POS System: Nota $notaId" })
                put("ref_baru", notaId)
                put("persontext", form.personIdLama)
            }
            records += local("cashflow", cashflowId, json, dateKey, entry.accountId, text = "nota $notaId", dirty = 1)
            operations += op(operations.size + 1, "cashflow", "create", cashflowId, json)

            val next = if (mutasi == "in") {
                balances.getValue(entry.accountId) + entry.nominal
            } else {
                balances.getValue(entry.accountId) - entry.nominal
            }
            updateAccountBalance(entry.accountId, next)
        }

        if (isService) {
            form.mekanik.filter { it.idLama.isNotBlank() && it.ongkos.signum() > 0 }.forEach { mekanik ->
                val ongkosId = idGenerator()
                val json = buildJsonObject {
                    put("id", ongkosId)
                    put("id_lama", "")
                    put("date", createdAt)
                    put("person", mekanik.idLama)
                    put("ongkos", mekanik.ongkos)
                    put("operator", operator)
                    put("ref", "")
                    put("ref_baru", notaId)
                }
                records += local("ongkos", ongkosId, json, dateKey, mekanik.idLama, text = mekanik.idLama, dirty = 1)
                operations += op(operations.size + 1, "ongkos", "create", ongkosId, json)
            }
        }

        db.localRecordDao().upsertAll(records)

        val requestId = RecordId.create(24)
        db.outboxDao().enqueueWithOperations(
            OutboxEntity(
                requestId = requestId,
                status = OutboxStatus.PENDING,
                createdAt = System.currentTimeMillis(),
                payloadJson = JsonObject(emptyMap()).toString(),
            ),
            operations.map { it.copy(requestId = requestId) },
        )

        CheckoutResult.Saved(
            notaId = notaId,
            total = total,
            change = form.nominalBayar - total,
            status = status,
        )
    }

    private suspend fun updateProductStock(productId: String, stock: BigDecimal) {
        val entity = db.localRecordDao().find("produk", productId) ?: return
        val obj = parseObject(entity.json) ?: return
        val next = buildJsonObject {
            obj.forEach { (key, value) -> put(key, value) }
            put("stok_3", stock)
        }
        db.localRecordDao().upsertAll(listOf(entity.copy(json = next.toString())))
    }

    private suspend fun updateAccountBalance(accountId: String, balance: BigDecimal) {
        val entity = db.localRecordDao().find("dropdown", accountId) ?: return
        val obj = parseObject(entity.json) ?: return
        val next = buildJsonObject {
            obj.forEach { (key, value) -> put(key, value) }
            put("number_1", balance)
        }
        db.localRecordDao().upsertAll(listOf(entity.copy(json = next.toString())))
    }

    private fun local(
        collection: String,
        id: String,
        json: JsonObject,
        dateKey: String,
        groupKey: String,
        text: String,
        dirty: Int,
    ) = LocalRecordEntity(
        collection = collection,
        id = id,
        dateKey = dateKey,
        groupKey = groupKey,
        text = text,
        json = json.toString(),
        dirty = dirty,
        updatedAt = System.currentTimeMillis(),
    )

    private fun op(seq: Int, collection: String, method: String, id: String, json: JsonObject) =
        OutboxOperationEntity(
            requestId = "",
            seq = seq,
            collection = collection,
            method = method,
            recordId = id,
            payloadJson = json.toString(),
        )

    private fun parseObject(raw: String): JsonObject? =
        runCatching { kotlinx.serialization.json.Json.parseToJsonElement(raw) as? JsonObject }.getOrNull()
}
package id.primamotor.pos.data.repo

import androidx.room.withTransaction
import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.LocalRecordEntity
import id.primamotor.pos.data.local.OutboxEntity
import id.primamotor.pos.data.local.OutboxOperationEntity
import id.primamotor.pos.data.local.OutboxStatus
import id.primamotor.pos.data.local.PendingMediaEntity
import id.primamotor.pos.domain.CartLine
import id.primamotor.pos.domain.PosPricing
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
    val personName: String = "Umum",
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
    /** Bukti pembelian. Belum ada media -> status paksa `belum`, sama seperti web. */
    val mediaCount: Int = 0,
    /** Path foto bukti yang diunggah setelah nota dibuat. */
    val mediaPath: String? = null,
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
 * Payload cermin `Frontend/src/services/posCheckout.ts`: kolom menu, log_stock, cashflow,
 * dan ongkos sama nama dan artinya. Efek stok/saldo diterapkan lokal agar transaksi berikutnya
 * saat offline melihat angka terbaru; server tetap menghitung ulang saat push.
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
        val service = PosPricing.isService(jenis)
        if (cart.isEmpty() && !service) {
            return@withTransaction CheckoutResult.Rejected("Isi keranjang dengan item terlebih dahulu!")
        }
        if (cart.isNotEmpty()) {
            PosValidation.cartError(cart)?.let { return@withTransaction CheckoutResult.Rejected(it) }
        }

        val direction = PosValidation.directionOf(jenis)
        val stocks = cart.map { it.productId }.distinct().associateWith { productId ->
            db.localRecordDao().find("produk", productId)?.json
                ?.let { parseObject(it)?.number("stok_3") } ?: BigDecimal.ZERO
        }
        PosValidation.stockError(cart, stocks, direction)?.let { return@withTransaction CheckoutResult.Rejected(it) }

        val subtotal = cart.fold(BigDecimal.ZERO) { sum, line -> sum + line.price.multiply(line.qty) }
        val ongkosTotal = if (service) {
            form.mekanik.filter { it.idLama.isNotBlank() && it.ongkos.signum() > 0 }
                .fold(BigDecimal.ZERO) { sum, line -> sum + line.ongkos }
        } else {
            BigDecimal.ZERO
        }
        val total = PosPricing.grandTotal(jenis, subtotal, ongkosTotal, form.adminFee, form.cashback)
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
        // Web memaksa `belum` untuk pembelian tanpa bukti, walau dibayar penuh.
        val status = if (PosPricing.isPembelian(jenis) && form.mediaCount == 0) {
            "belum"
        } else {
            PosValidation.statusOf(dibayar, total)
        }
        val notaId = idGenerator()
        val createdAt = form.createdAtIso
        val dateKey = WibDate.dayOf(createdAt)?.toString() ?: LocalDate.now(WibDate.WIB).toString()
        val lower = jenis.lowercase()
        val isService = lower.contains("service") || lower.contains("servis")
        val online = PosPricing.isOnline(form.personIdLama, form.personName)
        val personBaru = dropdownIdByLama(form.personIdLama)

        val menuJson = buildJsonObject {
            put("id", notaId)
            put("jenis", jenis)
            put("person", form.personIdLama)
            put("person_baru", personBaru)
            put("text", form.noteMenu)
            put("payment", if (form.payment == "Tunai") "cash" else "tempo")
            put("operator", operator)
            put("created_at", createdAt)
            put("qty", cart.fold(BigDecimal.ZERO) { sum, line -> sum + line.qty })
            put("cashback", if (online) form.cashback else BigDecimal.ZERO)
            put("admin", if (online) form.adminFee else BigDecimal.ZERO)
            put("marketplace", if (online) form.marketplace else "")
            put("status", status)
            put("total", total)
            put("dibayar", dibayar)
            put("date_lunas", if (status == "lunas") createdAt else "")
            put("tempo", if (form.payment == "Tempo") form.tempoDate else "")
        }

        val records = mutableListOf(
            local("menu", notaId, menuJson, dateKey, form.personIdLama, text = "$jenis ${form.personIdLama} ${form.noteMenu}".lowercase(), dirty = 1),
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
                put("price_2", if (direction == "in") BigDecimal.ZERO else line.cost.multiply(line.qty))
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
                put("person", personBaru)
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

        form.mediaPath?.let { path ->
            db.mediaDao().add(
                PendingMediaEntity(
                    collection = "menu",
                    recordId = notaId,
                    field = "file",
                    filePath = path,
                ),
            )
        }

        CheckoutResult.Saved(
            notaId = notaId,
            total = total,
            change = form.nominalBayar - total,
            status = status,
        )
    }

    /** `person_baru` web = record id hasil cari `id_lama`. */
    private suspend fun dropdownIdByLama(idLama: String): String {
        if (idLama.isBlank()) return ""
        return db.localRecordDao().findByField("dropdown", "id_lama", idLama)?.id.orEmpty()
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

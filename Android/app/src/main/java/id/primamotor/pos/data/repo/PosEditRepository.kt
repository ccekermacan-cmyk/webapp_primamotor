package id.primamotor.pos.data.repo

import androidx.room.withTransaction
import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.LocalRecordEntity
import id.primamotor.pos.data.local.OutboxEntity
import id.primamotor.pos.data.local.OutboxOperationEntity
import id.primamotor.pos.data.local.OutboxStatus
import id.primamotor.pos.data.local.PendingMediaEntity
import id.primamotor.pos.data.ledger.CashflowEntry
import id.primamotor.pos.data.ledger.LocalLedger
import id.primamotor.pos.data.ledger.StockEntry
import id.primamotor.pos.domain.CartLine
import id.primamotor.pos.domain.PosPricing
import id.primamotor.pos.domain.PosValidation
import id.primamotor.pos.domain.RecordId
import id.primamotor.pos.domain.WibDate
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.math.BigDecimal

data class EditSession(
    val menuId: String,
    val menu: JsonObject,
    val menuJson: String,
    val dateKey: String,
    val groupKey: String,
    val logs: List<LocalRecordEntity>,
    val cashflows: List<LocalRecordEntity>,
    val ongkos: List<LocalRecordEntity>,
)

/**
 * Edit/hapus transaksi dengan pola "balik lama, terapkan baru" dalam SATU request outbox.
 *
 * Anak transaksi (log stok, cashflow, ongkos) dihapus lalu dibuat ulang, bukan dicocokkan per baris
 * seperti web. Server menerapkan efek hapus dan efek buat di batch atomik yang sama, jadi saldo/stok
 * berakhir sama; pola ini jauh lebih sedikit kode dan tidak punya kasus tepi pencocokan.
 */
class PosEditRepository(
    private val db: AppDatabase,
    private val idGenerator: () -> String = { RecordId.create() },
) {

    suspend fun prepare(menuId: String): EditSession? {
        val menu = db.localRecordDao().find("menu", menuId) ?: return null
        val needle = "\"ref_baru\":\"$menuId\""
        return EditSession(
            menuId = menuId,
            menu = parse(menu.json) ?: JsonObject(emptyMap()),
            menuJson = menu.json,
            dateKey = menu.dateKey,
            groupKey = menu.groupKey,
            logs = db.localRecordDao().byJsonFragment("log_stock", needle),
            cashflows = db.localRecordDao().byJsonFragment("cashflow", needle),
            ongkos = db.localRecordDao().byJsonFragment("ongkos", needle),
        )
    }

    suspend fun delete(session: EditSession): CheckoutResult = db.withTransaction {
        revertLocalEffects(session)
        val requestId = RecordId.create(24)
        db.localRecordDao().delete("menu", session.menuId)
        session.logs.forEach { db.localRecordDao().delete("log_stock", it.id) }
        session.cashflows.forEach { db.localRecordDao().delete("cashflow", it.id) }
        session.ongkos.forEach { db.localRecordDao().delete("ongkos", it.id) }
        db.outboxDao().enqueueWithOperations(
            OutboxEntity(requestId, OutboxStatus.PENDING, System.currentTimeMillis(), "{}"),
            listOf(op(requestId, 1, "menu", "delete", session.menuId, session.menu)),
        )
        CheckoutResult.Saved(session.menuId, session.menu.number("total"), BigDecimal.ZERO, "dihapus")
    }

    suspend fun update(
        session: EditSession,
        jenis: String,
        cart: List<CartLine>,
        form: CheckoutForm,
        operator: String,
    ): CheckoutResult = db.withTransaction {
        if (cart.isEmpty() && !PosPricing.isService(jenis)) {
            return@withTransaction CheckoutResult.Rejected("Isi keranjang dengan item terlebih dahulu!")
        }
        if (cart.isNotEmpty()) {
            PosValidation.cartError(cart)?.let { return@withTransaction CheckoutResult.Rejected(it) }
        }

        val direction = PosValidation.directionOf(jenis)
        val stocks = movingStocks(session, cart)
        PosValidation.stockError(cart, stocks, direction)?.let { return@withTransaction CheckoutResult.Rejected(it) }

        val subtotal = cart.fold(BigDecimal.ZERO) { sum, line -> sum + line.price.multiply(line.qty) }
        val ongkosTotal = if (PosPricing.isService(jenis)) {
            form.mekanik.filter { it.idLama.isNotBlank() && it.ongkos.signum() > 0 }
                .fold(BigDecimal.ZERO) { sum, line -> sum + line.ongkos }
        } else {
            BigDecimal.ZERO
        }
        val total = PosPricing.grandTotal(jenis, subtotal, ongkosTotal, form.adminFee, form.cashback)
        PosValidation.paymentError(form.payment, form.nominalBayar, total, form.tempoDate)
            ?.let { return@withTransaction CheckoutResult.Rejected(it) }

        val cashflows = form.cashflow.filter { it.accountId.isNotEmpty() && it.nominal.signum() > 0 }
        val mutasi = if (direction == "out") "in" else "out"
        val balances = movingBalances(session, cashflows)
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
        val status = if (PosPricing.isPembelian(jenis) && form.mediaCount == 0) {
            "belum"
        } else {
            PosValidation.statusOf(dibayar, total)
        }
        val createdAt = session.menu.text("created_at").ifBlank { form.createdAtIso }
        val dateKey = session.dateKey.ifBlank { WibDate.dayOf(createdAt)?.toString().orEmpty() }
        val personNama = form.personIdLama
        val lower = jenis.lowercase()
        val isService = lower.contains("service") || lower.contains("servis")
        val online = PosPricing.isOnline(form.personIdLama, form.personName)
        val personBaru = db.localRecordDao().findByField("dropdown", "id_lama", form.personIdLama)?.id.orEmpty()

        val menuJson = buildJsonObject {
            session.menu.forEach { (key, value) -> put(key, value) }
            put("jenis", jenis)
            put("person", personNama)
            put("person_baru", personBaru)
            put("text", form.noteMenu)
            put("payment", if (form.payment == "Tunai") "cash" else "tempo")
            put("operator", operator)
            put("qty", cart.fold(BigDecimal.ZERO) { sum, line -> sum + line.qty })
            put("cashback", if (online) form.cashback else BigDecimal.ZERO)
            put("admin", if (online) form.adminFee else BigDecimal.ZERO)
            put("marketplace", if (online) form.marketplace else "")
            put("status", status)
            put("total", total)
            put("dibayar", dibayar)
            put("date_lunas", if (status == "lunas") createdAt else "")
            put("tempo", if (form.payment == "Tempo") form.tempoDate else "")
            put("atomic_expected", session.menuJson)
        }

        val requestId = RecordId.create(24)
        val operations = mutableListOf(op(requestId, 1, "menu", "update", session.menuId, menuJson))
        val records = mutableListOf(
            LocalRecordEntity(
                collection = "menu",
                id = session.menuId,
                dateKey = dateKey,
                groupKey = personNama,
                text = "$jenis $personNama ${form.noteMenu}".lowercase(),
                json = menuJson.toString(),
                dirty = 1,
                updatedAt = System.currentTimeMillis(),
            ),
        )

        session.logs.forEach { operations += op(requestId, operations.size + 1, "log_stock", "delete", it.id, parse(it.json) ?: JsonObject(emptyMap())) }
        session.cashflows.forEach { operations += op(requestId, operations.size + 1, "cashflow", "delete", it.id, parse(it.json) ?: JsonObject(emptyMap())) }
        session.ongkos.forEach { operations += op(requestId, operations.size + 1, "ongkos", "delete", it.id, parse(it.json) ?: JsonObject(emptyMap())) }
        session.logs.forEach { db.localRecordDao().delete("log_stock", it.id) }
        session.cashflows.forEach { db.localRecordDao().delete("cashflow", it.id) }
        session.ongkos.forEach { db.localRecordDao().delete("ongkos", it.id) }

        cart.forEach { line ->
            val logId = idGenerator()
            val json = buildJsonObject {
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
                put("ref", session.menuId)
                put("ref_baru", session.menuId)
            }
            records += LocalRecordEntity("log_stock", logId, dateKey, line.productId, line.nama.lowercase(), json.toString(), 1, System.currentTimeMillis())
            operations += op(requestId, operations.size + 1, "log_stock", "create", logId, json)
        }

        cashflows.forEach { entry ->
            val account = db.localRecordDao().find("dropdown", entry.accountId)?.let { parse(it.json) }
            val cashflowId = idGenerator()
            val json = buildJsonObject {
                put("id", cashflowId)
                put("id_lama", "")
                put("created_at", form.createdAtIso)
                put("operator", operator)
                put("nominal", entry.nominal)
                put("jenis", jenis)
                put("mutasi", mutasi)
                put("account_1", entry.accountId)
                put("account_2", "")
                put("acc1", account?.text("id_lama").orEmpty())
                put("acc2", "")
                put("note", form.note.ifBlank { "POS System: Nota ${session.menuId}" })
                put("ref_baru", session.menuId)
                put("person", personBaru)
                put("persontext", form.personIdLama)
            }
            records += LocalRecordEntity("cashflow", cashflowId, dateKey, entry.accountId, "nota ${session.menuId}", json.toString(), 1, System.currentTimeMillis())
            operations += op(requestId, operations.size + 1, "cashflow", "create", cashflowId, json)
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
                    put("ref_baru", session.menuId)
                }
                records += LocalRecordEntity("ongkos", ongkosId, dateKey, mekanik.idLama, mekanik.idLama, json.toString(), 1, System.currentTimeMillis())
                operations += op(requestId, operations.size + 1, "ongkos", "create", ongkosId, json)
            }
        }

        db.localRecordDao().upsertAll(records)

        val finalStocks = stocks.toMutableMap()
        cart.forEach { line ->
            val delta = LocalLedger.stockDeltas(StockEntry(line.productId, line.qty, direction))
                .values.values.fold(BigDecimal.ZERO) { sum, value -> sum + value }
            finalStocks[line.productId] = finalStocks.getValue(line.productId) + delta
        }
        finalStocks.forEach { (id, value) -> setNumber("produk", id, "stok_3", value) }

        val finalBalances = balances.toMutableMap()
        cashflows.forEach { entry ->
            val delta = LocalLedger.cashDeltas(
                CashflowEntry(
                    account1 = entry.accountId,
                    nominal = entry.nominal,
                    mutasi = mutasi,
                    jenis = jenis,
                ),
            ).values.values.fold(BigDecimal.ZERO) { sum, value -> sum + value }
            finalBalances[entry.accountId] = finalBalances.getValue(entry.accountId) + delta
        }
        finalBalances.forEach { (id, value) -> setNumber("dropdown", id, "number_1", value) }

        db.outboxDao().enqueueWithOperations(
            OutboxEntity(requestId, OutboxStatus.PENDING, System.currentTimeMillis(), "{}"),
            operations,
        )

        val mediaField = if (form.mediaCount > 0) "file+" else "file"
        form.mediaPath?.let { path ->
            db.mediaDao().add(
                PendingMediaEntity(
                    collection = "menu",
                    recordId = session.menuId,
                    field = mediaField,
                    filePath = path,
                ),
            )
        }

        CheckoutResult.Saved(session.menuId, total, form.nominalBayar - total, status)
    }

    /** Stok setelah efek lama dibalik. */
    private suspend fun movingStocks(session: EditSession, cart: List<CartLine>): Map<String, BigDecimal> {
        val stocks = (session.logs.mapNotNull { parse(it.json)?.text("item_baru") } + cart.map { it.productId })
            .distinct()
            .associateWith { productId ->
                db.localRecordDao().find("produk", productId)?.json
                    ?.let { parse(it)?.number("stok_3") } ?: BigDecimal.ZERO
            }
            .toMutableMap()
        session.logs.forEach { log ->
            val row = parse(log.json) ?: return@forEach
            val id = row.text("item_baru")
            if (id.isEmpty()) return@forEach
            val entry = StockEntry(id, row.number("qty"), row.text("boolean"))
            stocks[id] = stocks.getValue(id) + LocalLedger.stockDeltas(entry).values.values.fold(BigDecimal.ZERO) { sum, value -> sum + value }.negate()
        }
        return stocks
    }

    private suspend fun movingBalances(session: EditSession, cashflows: List<CashflowInput>): Map<String, BigDecimal> {
        val balances = (session.cashflows.mapNotNull { parse(it.json)?.text("account_1") } + cashflows.map { it.accountId })
            .distinct()
            .associateWith { accountId ->
                db.localRecordDao().find("dropdown", accountId)?.json
                    ?.let { parse(it)?.number("number_1") } ?: BigDecimal.ZERO
            }
            .toMutableMap()
        session.cashflows.forEach { cash ->
            val row = parse(cash.json) ?: return@forEach
            val entry = CashflowEntry(
                account1 = row.text("account_1"),
                account2 = row.text("account_2"),
                nominal = row.number("nominal"),
                mutasi = row.text("mutasi"),
                jenis = row.text("jenis"),
            )
            LocalLedger.cashDeltas(entry).values.forEach { (id, delta) ->
                if (balances.containsKey(id)) balances[id] = balances.getValue(id) - delta
            }
        }
        return balances
    }

    /** Membalik efek stok/saldo transaksi lama di cache lokal sebelum baris anak dihapus. */
    private suspend fun revertLocalEffects(session: EditSession) {
        session.logs.forEach { log ->
            val row = parse(log.json) ?: return@forEach
            val productId = row.text("item_baru")
            if (productId.isEmpty()) return@forEach
            val delta = LocalLedger.stockDeltas(StockEntry(productId, row.number("qty"), row.text("boolean")))
                .values.values.fold(BigDecimal.ZERO) { sum, value -> sum + value }
            bumpNumber("produk", productId, "stok_3", delta.negate())
        }
        session.cashflows.forEach { cash ->
            val row = parse(cash.json) ?: return@forEach
            val entry = CashflowEntry(
                account1 = row.text("account_1"),
                account2 = row.text("account_2"),
                nominal = row.number("nominal"),
                mutasi = row.text("mutasi"),
                jenis = row.text("jenis"),
            )
            LocalLedger.cashDeltas(entry).values.forEach { (accountId, delta) ->
                bumpNumber("dropdown", accountId, "number_1", delta.negate())
            }
        }
    }

    private suspend fun bumpNumber(collection: String, id: String, field: String, delta: BigDecimal) {
        val entity = db.localRecordDao().find(collection, id) ?: return
        val obj = parse(entity.json) ?: return
        writeNumber(entity, obj, field, obj.number(field) + delta)
    }

    private suspend fun setNumber(collection: String, id: String, field: String, value: BigDecimal) {
        val entity = db.localRecordDao().find(collection, id) ?: return
        val obj = parse(entity.json) ?: return
        writeNumber(entity, obj, field, value)
    }

    private suspend fun writeNumber(entity: LocalRecordEntity, obj: JsonObject, field: String, value: BigDecimal) {
        val next = buildJsonObject {
            obj.forEach { (key, item) -> put(key, item) }
            put(field, value)
        }
        db.localRecordDao().upsertAll(listOf(entity.copy(json = next.toString())))
    }

    private fun op(requestId: String, seq: Int, collection: String, method: String, id: String, body: JsonObject) =
        OutboxOperationEntity(requestId, seq, collection, method, id, body.toString())

    private fun parse(raw: String): JsonObject? = runCatching { Json.parseToJsonElement(raw) as? JsonObject }.getOrNull()
}
package id.primamotor.pos.data.repo

import androidx.room.withTransaction
import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.LocalRecordEntity
import id.primamotor.pos.data.local.OutboxEntity
import id.primamotor.pos.data.local.OutboxOperationEntity
import id.primamotor.pos.data.local.OutboxStatus
import id.primamotor.pos.domain.RecordId
import id.primamotor.pos.domain.Settlement
import id.primamotor.pos.domain.WibDate
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.math.BigDecimal

/** Pelunasan nota tempo: satu cashflow masuk + update status menu, dalam satu request outbox. */
class SettlementRepository(
    private val db: AppDatabase,
    private val idGenerator: () -> String = { RecordId.create() },
) {

    suspend fun settle(
        menuId: String,
        amount: BigDecimal,
        accountId: String,
        operator: String,
        createdAtIso: String = WibDate.nowIso(),
    ): CheckoutResult = db.withTransaction {
        val entity = db.localRecordDao().find("menu", menuId)
            ?: return@withTransaction CheckoutResult.Rejected("Nota tidak ditemukan.")
        val menu = parse(entity.json) ?: return@withTransaction CheckoutResult.Rejected("Data nota rusak.")
        val total = menu.number("total")
        val paid = menu.number("dibayar")
        Settlement.error(total, paid, amount)?.let { return@withTransaction CheckoutResult.Rejected(it) }

        val account = db.localRecordDao().find("dropdown", accountId)
            ?: return@withTransaction CheckoutResult.Rejected("Akun kas tidak ditemukan.")
        val accountJson = parse(account.json) ?: JsonObject(emptyMap())
        val status = Settlement.statusAfter(total, paid, amount)

        val menuJson = buildJsonObject {
            menu.forEach { (key, value) -> put(key, value) }
            put("dibayar", paid + amount)
            put("status", status)
            put("date_lunas", if (status == "lunas") createdAtIso else menu.text("date_lunas"))
            put("atomic_expected", entity.json)
        }

        val cashflowId = idGenerator()
        val cashflowJson = buildJsonObject {
            put("id", cashflowId)
            put("id_lama", "")
            put("created_at", createdAtIso)
            put("operator", operator)
            put("nominal", amount)
            put("jenis", "Pelunasan")
            put("mutasi", "in")
            put("account_1", accountId)
            put("account_2", "")
            put("acc1", accountJson.text("id_lama"))
            put("acc2", "")
            put("note", "Pelunasan nota $menuId")
            put("ref_baru", menuId)
            put("persontext", menu.text("person"))
        }

        db.localRecordDao().upsertAll(
            listOf(
                entity.copy(
                    json = menuJson.toString(),
                    dirty = 1,
                    groupKey = menu.text("person"),
                    updatedAt = System.currentTimeMillis(),
                ),
                LocalRecordEntity(
                    collection = "cashflow",
                    id = cashflowId,
                    dateKey = WibDate.dayOf(createdAtIso)?.toString().orEmpty(),
                    groupKey = accountId,
                    text = "pelunasan $menuId",
                    json = cashflowJson.toString(),
                    dirty = 1,
                    updatedAt = System.currentTimeMillis(),
                ),
            ),
        )

        val balance = accountJson.number("number_1") + amount
        val balanceJson = buildJsonObject {
            accountJson.forEach { (key, value) -> put(key, value) }
            put("number_1", balance)
        }
        db.localRecordDao().upsertAll(listOf(account.copy(json = balanceJson.toString())))

        val requestId = RecordId.create(24)
        db.outboxDao().enqueueWithOperations(
            OutboxEntity(requestId, OutboxStatus.PENDING, System.currentTimeMillis(), "{}"),
            listOf(
                OutboxOperationEntity(requestId, 1, "cashflow", "create", cashflowId, cashflowJson.toString()),
                OutboxOperationEntity(requestId, 2, "menu", "update", menuId, menuJson.toString()),
            ),
        )

        CheckoutResult.Saved(menuId, total, BigDecimal.ZERO, status)
    }

    private fun parse(raw: String): JsonObject? = runCatching { Json.parseToJsonElement(raw) as? JsonObject }.getOrNull()
}
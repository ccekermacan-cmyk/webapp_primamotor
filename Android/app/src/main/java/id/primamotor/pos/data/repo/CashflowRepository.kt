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
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.math.BigDecimal
import java.time.LocalDate

/** Form Catat Kas, cermin `CashflowModalForm` web. */
data class CashDraft(
    val id: String? = null,
    val createdAtIso: String = WibDate.nowIso(),
    val mutasi: String = "Masuk",
    val jenis: String = "",
    val accountId: String = "",
    val account2Id: String = "",
    val personId: String = "",
    val personText: String = "",
    val nominal: BigDecimal = BigDecimal.ZERO,
    val note: String = "",
    val mediaPath: String? = null,
)

/** Form Bon Karyawan, cermin `CashflowBonModal` web. */
data class BonDraft(
    val createdAtIso: String = WibDate.nowIso(),
    val catatCashflow: Boolean = false,
    val accountId: String = "",
    val personRecordId: String = "",
    val personUserId: String = "",
    val personText: String = "",
    val nominal: BigDecimal = BigDecimal.ZERO,
    val note: String = "",
    val mediaPath: String? = null,
)

sealed interface CashSave {
    data class Saved(val id: String) : CashSave
    data class Rejected(val message: String) : CashSave
}

/**
 * Tulis cashflow dan bon lewat outbox, dengan efek saldo lokal agar layar langsung konsisten.
 * Server tetap menghitung ulang saat batch dieksekusi, sama seperti jalur POS.
 *
 * Edit transaksi kas belum diporting; hapus + catat ulang mencakup kebutuhan harian.
 */
class CashflowRepository(
    private val db: AppDatabase,
    private val idGenerator: () -> String = { RecordId.create() },
) {

    suspend fun catatKas(draft: CashDraft, operator: String): CashSave = db.withTransaction {
        if (draft.jenis.isBlank()) return@withTransaction CashSave.Rejected("Jenis Cashflow wajib dipilih!")
        if (draft.accountId.isBlank()) return@withTransaction CashSave.Rejected("Akun Pembayaran wajib dipilih!")
        if (draft.nominal.signum() <= 0) return@withTransaction CashSave.Rejected("Nominal harus diisi dan lebih dari 0!")
        if (draft.note.isBlank()) return@withTransaction CashSave.Rejected("Keterangan wajib diisi!")

        val transfer = isTransfer(draft.jenis)
        if (transfer && (draft.account2Id.isBlank() || draft.account2Id == draft.accountId)) {
            return@withTransaction CashSave.Rejected("Akun tujuan transfer harus berbeda dari akun sumber!")
        }

        val mutasi = if (draft.mutasi.equals("masuk", true) || draft.mutasi == "in") "in" else "out"
        val outgoing = transfer || mutasi == "out"
        if (outgoing) {
            val saldo = balance(draft.accountId)
            if (saldo < draft.nominal) {
                return@withTransaction CashSave.Rejected(
                    "Saldo tidak cukup! Saldo saat ini: ${id.primamotor.pos.domain.Money.formatRupiah(saldo)}",
                )
            }
        }

        val id = draft.id ?: idGenerator()
        val account = account(draft.accountId)
        val account2 = if (transfer) account(draft.account2Id) else null
        val dateKey = WibDate.dayOf(draft.createdAtIso)?.toString() ?: LocalDate.now(WibDate.WIB).toString()
        val personRecordId = if (isBonKaryawan(draft.jenis) && mutasi == "out") draft.personId else ""

        val json = buildJsonObject {
            put("id", id)
            put("created_at", draft.createdAtIso)
            put("operator", operator)
            put("jenis", draft.jenis)
            put("mutasi", mutasi)
            put("account_1", draft.accountId)
            put("account_2", if (transfer) draft.account2Id else if (isBonKaryawan(draft.jenis) && mutasi == "out") draft.personId else "")
            put("person", if (isBonKaryawan(draft.jenis) && mutasi == "out") "" else draft.personId)
            put("persontext", draft.personText)
            put("nominal", draft.nominal)
            put("note", draft.note)
            put("acc1", account?.text("id_lama").orEmpty())
            put("acc2", if (transfer) account2?.text("id_lama").orEmpty() else "")
        }

        db.localRecordDao().upsertAll(listOf(local("cashflow", id, json, dateKey, draft.accountId, text = draft.note.lowercase(), dirty = 1)))
        queue(listOf(Op("cashflow", "create", id, json)))

        applyBalance(draft.accountId, if (mutasi == "in") draft.nominal else draft.nominal.negate())
        if (transfer) applyBalance(draft.account2Id, draft.nominal)

        draft.mediaPath?.let { path ->
            db.mediaDao().add(PendingMediaEntity(collection = "cashflow", recordId = id, field = "file", filePath = path))
        }
        CashSave.Saved(id)
    }

    suspend fun catatBon(draft: BonDraft, operator: String): CashSave = db.withTransaction {
        if (draft.personRecordId.isBlank() && draft.personUserId.isBlank()) {
            return@withTransaction CashSave.Rejected("Pihak (Person) wajib dipilih!")
        }
        if (draft.nominal.signum() <= 0) return@withTransaction CashSave.Rejected("Nominal harus diisi!")
        if (draft.catatCashflow && draft.accountId.isBlank()) {
            return@withTransaction CashSave.Rejected("Akun asal wajib dipilih!")
        }
        if (draft.note.isBlank()) return@withTransaction CashSave.Rejected("Catatan wajib diisi!")

        if (draft.catatCashflow) {
            val saldo = balance(draft.accountId)
            if (saldo < draft.nominal) {
                return@withTransaction CashSave.Rejected(
                    "Saldo tidak cukup! Saldo saat ini: ${id.primamotor.pos.domain.Money.formatRupiah(saldo)}",
                )
            }
        }

        val dateKey = WibDate.dayOf(draft.createdAtIso)?.toString() ?: LocalDate.now(WibDate.WIB).toString()
        val cashflowId = if (draft.catatCashflow) idGenerator() else ""
        val bonId = idGenerator()
        val ops = mutableListOf<Op>()

        if (draft.catatCashflow) {
            val account = account(draft.accountId)
            val cf = buildJsonObject {
                put("id", cashflowId)
                put("created_at", draft.createdAtIso)
                put("operator", operator)
                put("jenis", "bonkaryawan")
                put("mutasi", "out")
                put("account_1", draft.accountId)
                put("account_2", draft.personUserId)
                put("person", draft.personRecordId)
                put("persontext", draft.personText)
                put("nominal", draft.nominal)
                put("note", draft.note)
                put("acc1", account?.text("id_lama").orEmpty())
                put("acc2", "")
            }
            db.localRecordDao().upsertAll(
                listOf(local("cashflow", cashflowId, cf, dateKey, draft.accountId, text = draft.note.lowercase(), dirty = 1)),
            )
            ops += Op("cashflow", "create", cashflowId, cf)
            applyBalance(draft.accountId, draft.nominal.negate())
            draft.mediaPath?.let { path ->
                db.mediaDao().add(PendingMediaEntity(collection = "cashflow", recordId = cashflowId, field = "file", filePath = path))
            }
        }

        val bon = buildJsonObject {
            put("id", bonId)
            put("created_at", draft.createdAtIso)
            put("person", draft.personRecordId)
            put("user", draft.personUserId)
            put("ref_cashflow", cashflowId)
            put("persontext", draft.personText)
            put("nominal", draft.nominal)
            put("note", draft.note)
            put("jenis", "out")
            put("operator", operator)
            if (draft.catatCashflow) put("akun_asal", draft.accountId)
        }
        val groupKey = draft.personUserId.ifBlank { draft.personRecordId }
        db.localRecordDao().upsertAll(
            listOf(local("bon", bonId, bon, dateKey, groupKey, text = draft.note.lowercase(), dirty = 1)),
        )
        ops += Op("bon", "create", bonId, bon)
        if (draft.mediaPath != null && !draft.catatCashflow) {
            db.mediaDao().add(PendingMediaEntity(collection = "bon", recordId = bonId, field = "file", filePath = draft.mediaPath))
        }

        queue(ops)
        CashSave.Saved(bonId)
    }

    /** Hapus kas + kembalikan saldo lokal. Server membalik nilai lama secara atomik. */
    suspend fun deleteCashflow(id: String): Boolean = db.withTransaction {
        val existing = db.localRecordDao().find("cashflow", id) ?: return@withTransaction false
        revertCashflow(existing.object_() ?: JsonObject(emptyMap()))
        db.localRecordDao().delete("cashflow", id)
        queue(listOf(Op("cashflow", "delete", id, safePayload(existing))))
        true
    }

    /** Hapus bon beserta cashflow rujukannya, sama seperti alur hapus riwayat bon web. */
    suspend fun deleteBon(id: String): Boolean = db.withTransaction {
        val existing = db.localRecordDao().find("bon", id) ?: return@withTransaction false
        val bon = existing.object_() ?: JsonObject(emptyMap())
        val ops = mutableListOf(Op("bon", "delete", id, safePayload(existing)))
        val refCashflow = bon.text("ref_cashflow")
        if (refCashflow.isNotBlank()) {
            db.localRecordDao().find("cashflow", refCashflow)?.let { cf ->
                revertCashflow(cf.object_() ?: JsonObject(emptyMap()))
                db.localRecordDao().delete("cashflow", refCashflow)
                ops += Op("cashflow", "delete", refCashflow, safePayload(cf))
            }
        }
        db.localRecordDao().delete("bon", id)
        queue(ops)
        true
    }

    private suspend fun revertCashflow(cf: JsonObject) {
        val nominal = cf.number("nominal")
        val mutasi = cf.text("mutasi")
        val account1 = cf.text("account_1")
        val account2 = cf.text("account_2")
        if (account1.isNotBlank()) {
            applyBalance(account1, if (mutasi == "in") nominal.negate() else nominal)
        }
        // Transfer dan bon karyawan menyentuh akun kedua / user; hanya transfer yang menambah saldo.
        if (account2.isNotBlank() && isTransfer(cf.text("jenis"))) {
            applyBalance(account2, nominal.negate())
        }
    }

    private suspend fun applyBalance(accountId: String, delta: BigDecimal) {
        if (accountId.isBlank()) return
        val entity = db.localRecordDao().find("dropdown", accountId) ?: return
        val obj = entity.object_() ?: return
        val next = buildJsonObject {
            obj.forEach { (key, value) -> put(key, value) }
            put("number_1", obj.number("number_1") + delta)
        }
        db.localRecordDao().upsertAll(listOf(entity.copy(json = next.toString())))
    }

    private suspend fun balance(accountId: String): BigDecimal =
        db.localRecordDao().find("dropdown", accountId)?.object_()?.number("number_1") ?: BigDecimal.ZERO

    private suspend fun account(id: String): JsonObject? = db.localRecordDao().find("dropdown", id)?.object_()

    private suspend fun queue(ops: List<Op>) {
        val requestId = RecordId.create(24)
        db.outboxDao().enqueueWithOperations(
            OutboxEntity(requestId, OutboxStatus.PENDING, System.currentTimeMillis(), "{}"),
            ops.mapIndexed { index, op ->
                OutboxOperationEntity(
                    requestId = requestId,
                    seq = index + 1,
                    collection = op.collection,
                    method = op.method,
                    recordId = op.id,
                    payloadJson = op.json.toString(),
                )
            },
        )
    }

    /** `delete` di batch server butuh payload record lama untuk pembalikan atomik. */
    private fun safePayload(entity: LocalRecordEntity): JsonObject =
        entity.object_() ?: buildJsonObject { put("id", entity.id) }

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

    private fun isTransfer(jenis: String) = jenis.lowercase().contains("transfer")

    private fun isBonKaryawan(jenis: String) = jenis.lowercase() == "bonkaryawan"

    private data class Op(val collection: String, val method: String, val id: String, val json: JsonObject)

}

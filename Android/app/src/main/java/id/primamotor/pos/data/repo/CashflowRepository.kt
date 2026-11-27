package id.primamotor.pos.data.repo

import androidx.room.withTransaction
import id.primamotor.pos.data.local.AppDatabase
import id.primamotor.pos.data.local.LocalRecordEntity
import id.primamotor.pos.data.local.OutboxEntity
import id.primamotor.pos.data.local.OutboxOperationEntity
import id.primamotor.pos.data.local.OutboxStatus
import id.primamotor.pos.data.local.PendingMediaEntity
import id.primamotor.pos.domain.Money
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
    /** Dropdown record id pihak (customer/karyawan). */
    val personId: String = "",
    /** `user` id pihak saat bon karyawan; kosong untuk customer. */
    val personUserId: String = "",
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
 * Edit kas ikut outbox dan membawa `atomic_expected` snapshot baris lama; server menolak
 * bila baris sudah berubah, sehingga koreksi tidak pernah menimpa data orang lain diam-diam.
 */
class CashflowRepository(
    private val db: AppDatabase,
    private val idGenerator: () -> String = { RecordId.create() },
) {

    suspend fun save(draft: CashDraft, operator: String): CashSave =
        db.withTransaction {
            if (draft.jenis.isBlank()) return@withTransaction CashSave.Rejected("Jenis Cashflow wajib dipilih!")
            if (draft.accountId.isBlank()) return@withTransaction CashSave.Rejected("Akun Pembayaran wajib dipilih!")
            if (draft.nominal.signum() <= 0) return@withTransaction CashSave.Rejected("Nominal harus diisi dan lebih dari 0!")
            if (draft.note.isBlank()) return@withTransaction CashSave.Rejected("Keterangan wajib diisi!")

            val transfer = isTransfer(draft.jenis)
            if (transfer && (draft.account2Id.isBlank() || draft.account2Id == draft.accountId)) {
                return@withTransaction CashSave.Rejected("Akun tujuan transfer harus berbeda dari akun sumber!")
            }

            val mutasi = if (draft.mutasi.equals("masuk", true) || draft.mutasi == "in") "in" else "out"
            if (transfer || mutasi == "out") {
                val current = balance(draft.accountId)
                if (current < draft.nominal) {
                    return@withTransaction CashSave.Rejected(
                        "Saldo tidak cukup! Saldo saat ini: ${Money.formatRupiah(current)}, " +
                            "dibutuhkan: ${Money.formatRupiah(draft.nominal)}",
                    )
                }
            }

            val existing = draft.id?.let { db.localRecordDao().find("cashflow", it) }
            if (draft.id != null && existing == null) {
                return@withTransaction CashSave.Rejected("Transaksi tidak ditemukan di cache. Sinkronkan dulu.")
            }
            val id = existing?.id ?: draft.id ?: idGenerator()
            val previousJson = existing?.object_()
            val dateKey = WibDate.dayOf(draft.createdAtIso)?.toString() ?: LocalDate.now(WibDate.WIB).toString()
            val account = account(draft.accountId)
            val account2 = if (transfer) account(draft.account2Id) else null
            val bonOut = draft.jenis.lowercase() == "bonkaryawan"
            val personAccount = bonOut && mutasi == "out"

            val json = buildJsonObject {
                put("id", id)
                put("created_at", draft.createdAtIso)
                put("operator", operator)
                put("jenis", draft.jenis)
                put("mutasi", mutasi)
                put("account_1", draft.accountId)
                put("account_2", if (transfer) draft.account2Id else if (personAccount) draft.personUserId else "")
                put("person", if (personAccount) draft.personId else "")
                put("persontext", draft.personText)
                put("nominal", draft.nominal)
                put("note", draft.note)
                put("acc1", account?.text("id_lama").orEmpty())
                put("acc2", if (transfer) account2?.text("id_lama").orEmpty() else "")
                // Server membandingkan snapshot ini sebelum mengubah baris (`atomic_ledger.js`).
                if (previousJson != null) put("atomic_expected", previousJson)
            }

            db.localRecordDao().upsertAll(
                listOf(local("cashflow", id, json, dateKey, draft.accountId, draft.note.lowercase(), dirty = 1)),
            )
            queue(
                listOf(
                    Op("cashflow", if (existing == null) "create" else "update", id, json),
                ),
            )

            if (previousJson != null) revertCashflow(previousJson)
            applyCashflow(json)
            draft.mediaPath?.let { path ->
                db.mediaDao().add(PendingMediaEntity(collection = "cashflow", recordId = id, field = "file", filePath = path))
            }
            CashSave.Saved(id)
        }

    /**
     * Bon karyawan dengan `catatCashflow` hanya menulis `cashflow`: server membuat baris `bon`
     * otomatis (`atomic_ledger.js:104-109`). Menulis keduanya membuat bon ganda, bug web yang
     * tidak dibawa ke native.
     */
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
            return@withTransaction save(
                CashDraft(
                    createdAtIso = draft.createdAtIso,
                    mutasi = "Keluar",
                    jenis = "bonkaryawan",
                    accountId = draft.accountId,
                    personId = draft.personRecordId,
                    personUserId = draft.personUserId,
                    personText = draft.personText,
                    nominal = draft.nominal,
                    note = draft.note,
                    mediaPath = draft.mediaPath,
                ),
                operator,
            )
        }

        val dateKey = WibDate.dayOf(draft.createdAtIso)?.toString() ?: LocalDate.now(WibDate.WIB).toString()
        val bonId = idGenerator()
        val bon = buildJsonObject {
            put("id", bonId)
            put("created_at", draft.createdAtIso)
            put("person", draft.personRecordId)
            put("user", draft.personUserId)
            put("ref_cashflow", "")
            put("persontext", draft.personText)
            put("nominal", draft.nominal)
            put("note", draft.note)
            put("jenis", "out")
            put("operator", operator)
        }
        val groupKey = draft.personUserId.ifBlank { draft.personRecordId }
        db.localRecordDao().upsertAll(
            listOf(local("bon", bonId, bon, dateKey, groupKey, draft.note.lowercase(), dirty = 1)),
        )
        queue(listOf(Op("bon", "create", bonId, bon)))
        draft.mediaPath?.let { path ->
            db.mediaDao().add(PendingMediaEntity(collection = "bon", recordId = bonId, field = "file", filePath = path))
        }
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

    /**
     * Hapus riwayat bon. Bon hasil slip gaji tidak boleh dihapus di sini; bon yang terhubung
     * kas dihapus lewat induknya supaya saldo ikut kembali.
     */
    suspend fun deleteBon(id: String): CashSave = db.withTransaction {
        val existing = db.localRecordDao().find("bon", id)
            ?: return@withTransaction CashSave.Rejected("Riwayat bon tidak ditemukan di cache.")
        val bon = existing.object_() ?: JsonObject(emptyMap())
        if (bon.text("ref_gaji").isNotBlank()) {
            return@withTransaction CashSave.Rejected(
                "Ubah atau hapus melalui transaksi gaji agar perhitungan slip dan pembayaran tetap konsisten.",
            )
        }
        val parent = bon.text("ref_cashflow")
        if (parent.isNotBlank()) {
            val deleted = deleteCashflow(parent)
            return@withTransaction if (deleted) {
                CashSave.Saved(parent)
            } else {
                CashSave.Rejected("Transaksi kas terkait tidak ditemukan di cache.")
            }
        }
        db.localRecordDao().delete("bon", id)
        queue(listOf(Op("bon", "delete", id, safePayload(existing))))
        CashSave.Saved(id)
    }

    /** Snapshot baris untuk `atomic_expected` saat form edit dibuka. */
    suspend fun expectedOf(rowId: String): JsonObject? =
        db.localRecordDao().find("cashflow", rowId)?.object_()

    private suspend fun applyCashflow(json: JsonObject) {
        val nominal = json.number("nominal")
        val mutasi = json.text("mutasi")
        val account1 = json.text("account_1")
        val account2 = json.text("account_2")
        if (account1.isNotBlank()) {
            applyBalance(account1, if (mutasi == "in") nominal else nominal.negate())
        }
        if (account2.isNotBlank() && isTransfer(json.text("jenis"))) {
            applyBalance(account2, nominal)
        }
    }

    private suspend fun revertCashflow(cf: JsonObject) {
        val nominal = cf.number("nominal")
        val mutasi = cf.text("mutasi")
        val account1 = cf.text("account_1")
        val account2 = cf.text("account_2")
        if (account1.isNotBlank()) {
            applyBalance(account1, if (mutasi == "in") nominal.negate() else nominal)
        }
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

    private data class Op(val collection: String, val method: String, val id: String, val json: JsonObject)
}

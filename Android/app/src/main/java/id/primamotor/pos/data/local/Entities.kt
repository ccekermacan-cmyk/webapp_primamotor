package id.primamotor.pos.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Satu baris per record server, JSON utuh + kolom yang dipakai untuk query.
 *
 * Skema server berubah sering (mis. `gaji` 5x); menyimpan JSON membuat field baru
 * tetap terbawa tanpa migrasi Room. Kolom typed ditambah hanya saat query butuh.
 */
@Entity(
    tableName = "local_record",
    primaryKeys = ["collection", "id"],
    indices = [
        Index("collection", "dateKey"),
        Index("collection", "groupKey"),
        Index("collection", "dirty"),
    ],
)
data class LocalRecordEntity(
    val collection: String,
    val id: String,
    /** Tanggal WIB `yyyy-MM-dd`, dipakai untuk jendela pull. Kosong jika record tak bertanggal. */
    val dateKey: String,
    /** Akun (`account_1`), pemilik (`user`), atau person, untuk filter tab. */
    val groupKey: String,
    /** Teks gabungan lowercase untuk pencarian nama/barcode. */
    val text: String,
    /** Payload JSON penuh dari server. */
    val json: String,
    /** 1 = dibuat/diubah lokal dan belum dikonfirmasi server; tidak boleh dihapus pull. */
    val dirty: Int = 0,
    val updatedAt: Long = 0L,
)

@Entity(tableName = "outbox", indices = [Index("status", "createdAt")])
data class OutboxEntity(
    @PrimaryKey val requestId: String,
    val status: String,
    val createdAt: Long,
    val payloadJson: String,
    val attempts: Int = 0,
    val lastError: String? = null,
)

@Entity(tableName = "outbox_operation", primaryKeys = ["requestId", "seq"])
data class OutboxOperationEntity(
    val requestId: String,
    val seq: Int,
    val collection: String,
    val method: String,
    val recordId: String,
    val payloadJson: String,
)

@Entity(tableName = "sync_state")
data class SyncStateEntity(
    @PrimaryKey val collection: String,
    val lastSyncAt: Long = 0L,
    val cursor: String? = null,
    val status: String = "idle",
)

@Entity(tableName = "conflict")
data class ConflictEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0L,
    val requestId: String,
    val reason: String,
    val createdAt: Long,
    val resolved: Int = 0,
)

object OutboxStatus {
    const val PENDING = "pending"
    const val SENDING = "sending"
    const val SENT = "sent"
    const val FAILED = "failed"
    const val NEEDS_REVIEW = "needs_review"
    const val VOID = "void"
}
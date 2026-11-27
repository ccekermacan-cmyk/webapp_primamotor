package id.primamotor.pos.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
interface LocalRecordDao {

    @Upsert
    suspend fun upsertAll(records: List<LocalRecordEntity>)

    @Query("SELECT * FROM local_record WHERE collection = :collection AND id = :id")
    suspend fun find(collection: String, id: String): LocalRecordEntity?

    @Query("SELECT * FROM local_record WHERE collection = :collection ORDER BY dateKey DESC, id DESC")
    fun observe(collection: String): Flow<List<LocalRecordEntity>>

    @Query("SELECT * FROM local_record WHERE collection = :collection AND dateKey = :dateKey ORDER BY id DESC")
    fun observeDay(collection: String, dateKey: String): Flow<List<LocalRecordEntity>>

    @Query("SELECT * FROM local_record WHERE collection = :collection AND groupKey = :groupKey ORDER BY dateKey DESC, id DESC")
    fun observeGroup(collection: String, groupKey: String): Flow<List<LocalRecordEntity>>

    @Query("SELECT * FROM local_record WHERE collection = :collection AND dateKey BETWEEN :from AND :to ORDER BY dateKey DESC, id DESC")
    suspend fun inRange(collection: String, from: String, to: String): List<LocalRecordEntity>

    @Query("SELECT id FROM local_record WHERE collection = :collection AND dateKey BETWEEN :from AND :to ORDER BY id")
    suspend fun idsInRange(collection: String, from: String, to: String): List<String>

    @Query(
        "SELECT * FROM local_record WHERE collection = :collection AND text LIKE '%' || :query || '%' " +
            "ORDER BY text LIMIT :limit",
    )
    suspend fun search(collection: String, query: String, limit: Int = 50): List<LocalRecordEntity>

    /**
     * Menghapus baris jendela yang tidak ada lagi di server.
     * Baris `dirty = 1` (transaksi offline yang belum terkirim) selalu dipertahankan.
     */
    @Query(
        "DELETE FROM local_record WHERE collection = :collection " +
            "AND dateKey BETWEEN :from AND :to AND dirty = 0 AND id NOT IN (:keepIds)",
    )
    suspend fun deleteMissing(collection: String, from: String, to: String, keepIds: List<String>): Int

    @Query("UPDATE local_record SET dirty = 0, json = :json, updatedAt = :updatedAt WHERE collection = :collection AND id = :id")
    suspend fun markClean(collection: String, id: String, json: String, updatedAt: Long)

    @Query("UPDATE local_record SET dirty = 0 WHERE collection = :collection AND id = :id")
    suspend fun clearDirty(collection: String, id: String)

    @Query("SELECT COUNT(*) FROM local_record WHERE collection = :collection AND dirty = 1")
    suspend fun dirtyCount(collection: String): Int
}

@Dao
interface OutboxDao {

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun enqueue(entry: OutboxEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOperations(operations: List<OutboxOperationEntity>)

    @Transaction
    suspend fun enqueueWithOperations(entry: OutboxEntity, operations: List<OutboxOperationEntity>) {
        enqueue(entry)
        insertOperations(operations)
    }

    @Query("SELECT * FROM outbox WHERE status = 'pending' ORDER BY createdAt ASC LIMIT 1")
    suspend fun oldestPending(): OutboxEntity?

    @Query("SELECT * FROM outbox WHERE requestId = :requestId")
    suspend fun find(requestId: String): OutboxEntity?

    @Query("SELECT * FROM outbox_operation WHERE requestId = :requestId ORDER BY seq ASC")
    suspend fun operations(requestId: String): List<OutboxOperationEntity>

    @Query("SELECT COUNT(*) FROM outbox")
    suspend fun count(): Int

    @Query("SELECT COUNT(*) FROM outbox WHERE status IN ('pending', 'sending', 'needs_review')")
    fun pendingCount(): Flow<Int>

    @Query("UPDATE outbox SET status = :status, lastError = :lastError, attempts = attempts + 1 WHERE requestId = :requestId")
    suspend fun markAttempt(requestId: String, status: String, lastError: String?)

    @Query("UPDATE outbox SET status = :status, lastError = :lastError WHERE requestId = :requestId")
    suspend fun setStatus(requestId: String, status: String, lastError: String?)

    @Query("UPDATE outbox SET status = 'pending', lastError = 'Interrupted while sending' WHERE status = 'sending'")
    suspend fun requeueInterrupted()

    @Query("SELECT * FROM outbox WHERE status = 'needs_review' ORDER BY createdAt ASC")
    fun observeNeedsReview(): Flow<List<OutboxEntity>>
}

@Dao
interface SyncStateDao {

    @Upsert
    suspend fun upsert(state: SyncStateEntity)

    @Query("SELECT * FROM sync_state WHERE collection = :collection")
    suspend fun find(collection: String): SyncStateEntity?

    @Query("SELECT * FROM sync_state")
    fun observeAll(): Flow<List<SyncStateEntity>>
}

@Dao
interface ConflictDao {

    @Insert
    suspend fun insert(conflict: ConflictEntity): Long

    @Query("SELECT * FROM conflict WHERE resolved = 0 ORDER BY createdAt ASC")
    fun observeOpen(): Flow<List<ConflictEntity>>

    @Query("UPDATE conflict SET resolved = 1 WHERE id = :id")
    suspend fun resolve(id: Long)
}
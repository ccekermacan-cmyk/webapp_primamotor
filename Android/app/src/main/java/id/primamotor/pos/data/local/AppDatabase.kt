package id.primamotor.pos.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        LocalRecordEntity::class,
        OutboxEntity::class,
        OutboxOperationEntity::class,
        SyncStateEntity::class,
        ConflictEntity::class,
    ],
    version = 1,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun localRecordDao(): LocalRecordDao
    abstract fun outboxDao(): OutboxDao
    abstract fun syncStateDao(): SyncStateDao
    abstract fun conflictDao(): ConflictDao

    companion object {
        fun open(context: Context): AppDatabase =
            Room.databaseBuilder(context, AppDatabase::class.java, "primamotor.db").build()
    }
}
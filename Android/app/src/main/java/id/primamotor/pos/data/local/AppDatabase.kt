package id.primamotor.pos.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [
        LocalRecordEntity::class,
        OutboxEntity::class,
        OutboxOperationEntity::class,
        SyncStateEntity::class,
        ConflictEntity::class,
        PendingMediaEntity::class,
    ],
    version = 2,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun localRecordDao(): LocalRecordDao
    abstract fun outboxDao(): OutboxDao
    abstract fun syncStateDao(): SyncStateDao
    abstract fun conflictDao(): ConflictDao
    abstract fun mediaDao(): MediaDao

    companion object {
        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS pending_media (" +
                        "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                        "collection TEXT NOT NULL, recordId TEXT NOT NULL, field TEXT NOT NULL, " +
                        "filePath TEXT NOT NULL, createdAt INTEGER NOT NULL)",
                )
            }
        }

        fun open(context: Context): AppDatabase =
            Room.databaseBuilder(context, AppDatabase::class.java, "primamotor.db")
                .addMigrations(MIGRATION_1_2)
                .build()
    }
}
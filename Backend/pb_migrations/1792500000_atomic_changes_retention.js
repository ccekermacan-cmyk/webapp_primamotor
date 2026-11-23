/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Jurnal atomic changes hanya mendukung dedup webhook lama, bukan history
  // permanen: retention 30 hari dijalankan oleh ledger.finish.
  const stamp = new Date().toISOString();
  app.db().newQuery(`ALTER TABLE _pm_atomic_changes ADD COLUMN created TEXT NOT NULL DEFAULT '${stamp}'`).execute();
  app.db().newQuery('CREATE INDEX IF NOT EXISTS pm_atomic_created ON _pm_atomic_changes(created)').execute();
}, (app) => {
  app.db().newQuery('DROP INDEX IF EXISTS pm_atomic_created').execute();
  // Kolom created dibiarkan: SQLite lama tidak mendukung DROP COLUMN dan kolom tersebut tidak berbahaya.
});
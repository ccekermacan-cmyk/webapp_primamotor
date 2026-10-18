/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  app.db().newQuery('CREATE TABLE IF NOT EXISTS _pm_atomic_requests (id TEXT PRIMARY KEY, response_json TEXT NOT NULL)').execute();
  app.db().newQuery('CREATE INDEX IF NOT EXISTS pm_atomic_batch ON _pm_atomic_changes(batch_id)').execute();
}, (app) => {
  // Preserve committed receipts so a delayed retry cannot repeat a financial mutation.
});

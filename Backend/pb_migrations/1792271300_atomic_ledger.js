/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  app.db().newQuery(`CREATE TABLE IF NOT EXISTS _pm_atomic_changes (
    id TEXT PRIMARY KEY, batch_id TEXT NOT NULL, collection_name TEXT NOT NULL,
    record_id TEXT NOT NULL, event TEXT NOT NULL, old_data TEXT NOT NULL, new_data TEXT NOT NULL
  )`).execute();
  app.db().newQuery('CREATE TABLE IF NOT EXISTS _pm_atomic_requests (id TEXT PRIMARY KEY, response_json TEXT NOT NULL)').execute();
  app.db().newQuery('CREATE INDEX IF NOT EXISTS pm_atomic_record ON _pm_atomic_changes(collection_name, record_id, event)').execute();
  try { app.findCollectionByNameOrId('_pm_atomic_commit'); } catch (_) {
    app.save(new Collection({type:'base', name:'_pm_atomic_commit',
      createRule:'@request.auth.id != ""', listRule:null, viewRule:null, updateRule:null, deleteRule:null,
      fields:[{type:'text',name:'nonce',required:true}]}));
  }
}, (app) => {
  // Keep the journal: old clients and delayed webhook retries must never apply effects twice.
});

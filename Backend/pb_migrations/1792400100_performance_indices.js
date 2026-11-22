/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Indeks performa untuk query pencarian & filter tabel utama
  app.db().newQuery('CREATE INDEX IF NOT EXISTS idx_produk_kategori ON produk(kategori)').execute();
  app.db().newQuery('CREATE INDEX IF NOT EXISTS idx_menu_created_at ON menu(created_at)').execute();
  app.db().newQuery('CREATE INDEX IF NOT EXISTS idx_menu_status ON menu(status)').execute();
  app.db().newQuery('CREATE INDEX IF NOT EXISTS idx_menu_person_baru ON menu(person_baru)').execute();
  app.db().newQuery('CREATE INDEX IF NOT EXISTS idx_gaji_person ON gaji(person)').execute();
  app.db().newQuery('CREATE INDEX IF NOT EXISTS idx_gaji_created_at ON gaji(created_at)').execute();
  app.db().newQuery('CREATE INDEX IF NOT EXISTS idx_bon_user ON bon(user)').execute();
  app.db().newQuery('CREATE INDEX IF NOT EXISTS idx_bon_created_at ON bon(created_at)').execute();
}, (app) => {
  app.db().newQuery('DROP INDEX IF EXISTS idx_produk_kategori').execute();
  app.db().newQuery('DROP INDEX IF EXISTS idx_menu_created_at').execute();
  app.db().newQuery('DROP INDEX IF EXISTS idx_menu_status').execute();
  app.db().newQuery('DROP INDEX IF EXISTS idx_menu_person_baru').execute();
  app.db().newQuery('DROP INDEX IF EXISTS idx_gaji_person').execute();
  app.db().newQuery('DROP INDEX IF EXISTS idx_gaji_created_at').execute();
  app.db().newQuery('DROP INDEX IF EXISTS idx_bon_user').execute();
  app.db().newQuery('DROP INDEX IF EXISTS idx_bon_created_at').execute();
});

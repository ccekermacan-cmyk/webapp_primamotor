/// <reference path="../pb_data/types.d.ts" />
// Barcode produk untuk pemindai Android. Aditif: field baru, backfill dari id_lama,
// lalu indeks agar lookup barcode tidak memindai tabel.
migrate((app) => {
  const collection = app.findCollectionByNameOrId('produk');
  if (!collection.fields.getByName('barcode')) {
    collection.fields.add(new Field({
      "help": "",
      "hidden": false,
      "id": "text_barcode_prima",
      "max": 120,
      "name": "barcode",
      "pattern": "",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "text"
    }));
  }
  app.save(collection);
  app.db().newQuery(
    "UPDATE produk SET barcode = id_lama WHERE (barcode IS NULL OR barcode = '') AND id_lama IS NOT NULL AND id_lama != ''"
  ).execute();
  app.db().newQuery('CREATE INDEX IF NOT EXISTS idx_produk_barcode ON produk(barcode)').execute();
}, (app) => {
  app.db().newQuery('DROP INDEX IF EXISTS idx_produk_barcode').execute();
  const collection = app.findCollectionByNameOrId('produk');
  const field = collection.fields.getByName('barcode');
  if (field) collection.fields.removeById(field.id);
  app.save(collection);
});

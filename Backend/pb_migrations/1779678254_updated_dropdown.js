/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_938605140")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_lmgt3xk8v2` ON `dropdown` (`id_lama`)",
      "CREATE INDEX `idx_tr8f0h90ej` ON `dropdown` (`kategori`)",
      "CREATE INDEX `idx_4n1gzgkvwy` ON `dropdown` (`jenis`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_938605140")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_lmgt3xk8v2` ON `dropdown` (`id_lama`)",
      "CREATE INDEX `idx_tr8f0h90ej` ON `dropdown` (\n  `kategori`,\n  `jenis`\n)"
    ]
  }, collection)

  return app.save(collection)
})

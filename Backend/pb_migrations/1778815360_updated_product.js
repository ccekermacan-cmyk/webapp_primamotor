/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1108966215")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_1ydnfwm0ih` ON `produk` (`id_lama`)"
    ],
    "name": "produk"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1108966215")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_1ydnfwm0ih` ON `product` (`id_lama`)"
    ],
    "name": "product"
  }, collection)

  return app.save(collection)
})

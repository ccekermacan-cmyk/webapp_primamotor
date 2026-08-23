/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4198167069")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_dw91hazhjn` ON `menu` (`id_lama`)"
    ],
    "name": "menu"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4198167069")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_dw91hazhjn` ON `Menu` (`id_lama`)"
    ],
    "name": "Menu"
  }, collection)

  return app.save(collection)
})

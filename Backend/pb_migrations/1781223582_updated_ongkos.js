/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2422936795")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2422936795")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_mrb2eueenj` ON `ongkos` (`ref_baru`)"
    ]
  }, collection)

  return app.save(collection)
})

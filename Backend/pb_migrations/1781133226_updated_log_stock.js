/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_258169765")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_x2p29xhwy7` ON `log_stock` (`item_baru`)"
    ]
  }, collection)

  // remove field
  collection.fields.removeById("relation1653163849")

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_258169765")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_ufbgk2pnxw` ON `log_stock` (`ref_baru`)",
      "CREATE INDEX `idx_x2p29xhwy7` ON `log_stock` (`item_baru`)"
    ]
  }, collection)

  // add field
  collection.fields.addAt(3, new Field({
    "cascadeDelete": true,
    "collectionId": "pbc_1510497571",
    "help": "",
    "hidden": false,
    "id": "relation1653163849",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "ref_baru",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
})

/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_258169765")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_ufbgk2pnxw` ON `log_stock` (`ref_baru`)",
      "CREATE INDEX `idx_x2p29xhwy7` ON `log_stock` (`item_baru`)"
    ]
  }, collection)

  // update field
  collection.fields.addAt(3, new Field({
    "cascadeDelete": false,
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
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_258169765")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  // update field
  collection.fields.addAt(12, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_1510497571",
    "help": "",
    "hidden": false,
    "id": "relation1653163849",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "relation",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
})

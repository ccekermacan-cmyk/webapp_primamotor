/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_28913142")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_kx4bzie8wo` ON `cashflow` (`ref_baru`)",
      "CREATE INDEX `idx_tq8ol7aygd` ON `cashflow` (`account_1_baru`)",
      "CREATE INDEX `idx_zw5it3mg7g` ON `cashflow` (`account_2_baru`)"
    ]
  }, collection)

  // add field
  collection.fields.addAt(13, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_938605140",
    "help": "",
    "hidden": false,
    "id": "relation114287514",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "account_1_baru",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(14, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_938605140",
    "help": "",
    "hidden": false,
    "id": "relation2153484596",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "account_2_baru",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_28913142")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  // remove field
  collection.fields.removeById("relation114287514")

  // remove field
  collection.fields.removeById("relation2153484596")

  return app.save(collection)
})

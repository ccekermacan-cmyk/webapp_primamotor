/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_28913142")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_tq8ol7aygd` ON `cashflow` (`account_1`)",
      "CREATE INDEX `idx_zw5it3mg7g` ON `cashflow` (`account_2`)"
    ]
  }, collection)

  // remove field
  collection.fields.removeById("relation1653163849")

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_28913142")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_kx4bzie8wo` ON `cashflow` (`ref_baru`)",
      "CREATE INDEX `idx_tq8ol7aygd` ON `cashflow` (`account_1`)",
      "CREATE INDEX `idx_zw5it3mg7g` ON `cashflow` (`account_2`)"
    ]
  }, collection)

  // add field
  collection.fields.addAt(8, new Field({
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

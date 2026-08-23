/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_28913142")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_tq8ol7aygd` ON `cashflow` (`account_1`)",
      "CREATE INDEX `idx_zw5it3mg7g` ON `cashflow` (`account_2`)",
      "CREATE INDEX `idx_0eqd2i5era` ON `cashflow` (`ref_baru`)"
    ]
  }, collection)

  // add field
  collection.fields.addAt(18, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_1510497571",
    "help": "",
    "hidden": false,
    "id": "relation3547045571",
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
  const collection = app.findCollectionByNameOrId("pbc_28913142")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_tq8ol7aygd` ON `cashflow` (`account_1`)",
      "CREATE INDEX `idx_zw5it3mg7g` ON `cashflow` (`account_2`)"
    ]
  }, collection)

  // remove field
  collection.fields.removeById("relation3547045571")

  return app.save(collection)
})

/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_28913142")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_kx4bzie8wo` ON `cashflow` (`ref_baru`)",
      "CREATE INDEX `idx_tq8ol7aygd` ON `cashflow` (`account_1`)",
      "CREATE INDEX `idx_zw5it3mg7g` ON `cashflow` (`account_2`)"
    ]
  }, collection)

  // remove field
  collection.fields.removeById("text1699193668")

  // remove field
  collection.fields.removeById("text4233032446")

  // update field
  collection.fields.addAt(11, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_938605140",
    "help": "",
    "hidden": false,
    "id": "relation114287514",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "account_1",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // update field
  collection.fields.addAt(12, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_938605140",
    "help": "",
    "hidden": false,
    "id": "relation2153484596",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "account_2",
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
      "CREATE INDEX `idx_kx4bzie8wo` ON `cashflow` (`ref_baru`)",
      "CREATE INDEX `idx_tq8ol7aygd` ON `cashflow` (`account_1_baru`)",
      "CREATE INDEX `idx_zw5it3mg7g` ON `cashflow` (`account_2_baru`)"
    ]
  }, collection)

  // add field
  collection.fields.addAt(7, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text1699193668",
    "max": 0,
    "min": 0,
    "name": "account_1",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text4233032446",
    "max": 0,
    "min": 0,
    "name": "account_2",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // update field
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

  // update field
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
})

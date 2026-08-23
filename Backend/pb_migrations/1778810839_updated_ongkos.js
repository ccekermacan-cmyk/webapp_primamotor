/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2422936795")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_68wga29jv8` ON `ongkos` (`ref_baru`)"
    ]
  }, collection)

  // update field
  collection.fields.addAt(7, new Field({
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
  const collection = app.findCollectionByNameOrId("pbc_2422936795")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  // update field
  collection.fields.addAt(7, new Field({
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

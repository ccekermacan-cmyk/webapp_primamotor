/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_258169765")

  // update field
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

  // update field
  collection.fields.addAt(5, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_1108966215",
    "help": "",
    "hidden": false,
    "id": "relation203987903",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "item_baru",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_258169765")

  // update field
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
    "required": true,
    "system": false,
    "type": "relation"
  }))

  // update field
  collection.fields.addAt(5, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_1108966215",
    "help": "",
    "hidden": false,
    "id": "relation203987903",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "item_baru",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
})

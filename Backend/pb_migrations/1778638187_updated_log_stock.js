/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_258169765")

  // add field
  collection.fields.addAt(13, new Field({
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

  // remove field
  collection.fields.removeById("relation203987903")

  return app.save(collection)
})

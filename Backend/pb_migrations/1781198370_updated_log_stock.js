/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_258169765")

  // add field
  collection.fields.addAt(11, new Field({
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
  const collection = app.findCollectionByNameOrId("pbc_258169765")

  // remove field
  collection.fields.removeById("relation3547045571")

  return app.save(collection)
})

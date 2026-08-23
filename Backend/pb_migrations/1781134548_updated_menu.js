/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1510497571")

  // remove field
  collection.fields.removeById("relation1325292399")

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1510497571")

  // add field
  collection.fields.addAt(13, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_938605140",
    "help": "",
    "hidden": false,
    "id": "relation1325292399",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "person_baru",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
})

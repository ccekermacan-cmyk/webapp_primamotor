/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4082886426")

  // update field
  collection.fields.addAt(6, new Field({
    "cascadeDelete": true,
    "collectionId": "pbc_1510497571",
    "help": "",
    "hidden": false,
    "id": "relation1786149652",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "ref_menu",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4082886426")

  // update field
  collection.fields.addAt(6, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_1510497571",
    "help": "",
    "hidden": false,
    "id": "relation1786149652",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "ref_menu",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
})

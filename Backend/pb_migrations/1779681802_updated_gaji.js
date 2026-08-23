/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1121029328")

  // add field
  collection.fields.addAt(20, new Field({
    "cascadeDelete": false,
    "collectionId": "_pb_users_auth_",
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
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1121029328")

  // remove field
  collection.fields.removeById("relation1653163849")

  return app.save(collection)
})

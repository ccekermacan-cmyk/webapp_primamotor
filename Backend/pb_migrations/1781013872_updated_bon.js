/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4082886426")

  // add field
  collection.fields.addAt(2, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_938605140",
    "help": "",
    "hidden": false,
    "id": "relation4222797282",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "akun_asal",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4082886426")

  // remove field
  collection.fields.removeById("relation4222797282")

  return app.save(collection)
})

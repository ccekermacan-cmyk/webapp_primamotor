/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1510497571")

  // add field
  collection.fields.addAt(17, new Field({
    "help": "",
    "hidden": false,
    "id": "select2063623452",
    "maxSelect": 0,
    "name": "status",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "lunas",
      "belum"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1510497571")

  // remove field
  collection.fields.removeById("select2063623452")

  return app.save(collection)
})

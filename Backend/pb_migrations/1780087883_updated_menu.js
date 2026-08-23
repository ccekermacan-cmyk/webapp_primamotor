/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1510497571")

  // add field
  collection.fields.addAt(17, new Field({
    "help": "",
    "hidden": false,
    "id": "date2337425721",
    "max": "",
    "min": "",
    "name": "date_lunas",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1510497571")

  // remove field
  collection.fields.removeById("date2337425721")

  return app.save(collection)
})

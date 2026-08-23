/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1510497571")

  // remove field
  collection.fields.removeById("text4109980413")

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1510497571")

  // add field
  collection.fields.addAt(12, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text4109980413",
    "max": 0,
    "min": 0,
    "name": "file_menu",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
})

/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1510497571")

  // add field
  collection.fields.addAt(18, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text2994196393",
    "max": 0,
    "min": 0,
    "name": "file_text",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1510497571")

  // remove field
  collection.fields.removeById("text2994196393")

  return app.save(collection)
})

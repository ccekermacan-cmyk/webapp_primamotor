/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_28913142")

  // remove field
  collection.fields.removeById("text2846799757")

  // add field
  collection.fields.addAt(13, new Field({
    "help": "",
    "hidden": false,
    "id": "select2846799757",
    "maxSelect": 0,
    "name": "mutasi",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "in",
      "out"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_28913142")

  // add field
  collection.fields.addAt(6, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text2846799757",
    "max": 0,
    "min": 0,
    "name": "mutasi",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // remove field
  collection.fields.removeById("select2846799757")

  return app.save(collection)
})

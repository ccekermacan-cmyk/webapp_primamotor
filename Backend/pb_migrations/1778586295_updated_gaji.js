/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1121029328")

  // remove field
  collection.fields.removeById("date2341372968")

  // add field
  collection.fields.addAt(19, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text2341372968",
    "max": 0,
    "min": 0,
    "name": "created_at",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1121029328")

  // add field
  collection.fields.addAt(3, new Field({
    "help": "",
    "hidden": false,
    "id": "date2341372968",
    "max": "",
    "min": "",
    "name": "created_at",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  // remove field
  collection.fields.removeById("text2341372968")

  return app.save(collection)
})

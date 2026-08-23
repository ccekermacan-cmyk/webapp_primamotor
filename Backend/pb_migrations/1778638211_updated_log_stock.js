/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_258169765")

  // remove field
  collection.fields.removeById("text2020044438")

  // remove field
  collection.fields.removeById("text342834851")

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_258169765")

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text2020044438",
    "max": 0,
    "min": 0,
    "name": "id_lama",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(2, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text342834851",
    "max": 0,
    "min": 0,
    "name": "ref",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
})

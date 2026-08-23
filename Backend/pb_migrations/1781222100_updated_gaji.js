/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1121029328")

  // add field
  collection.fields.addAt(20, new Field({
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
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1121029328")

  // remove field
  collection.fields.removeById("text342834851")

  return app.save(collection)
})

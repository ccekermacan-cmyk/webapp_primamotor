/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1108966215")

  // add field
  collection.fields.addAt(25, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text3669478755",
    "max": 0,
    "min": 0,
    "name": "list_pic",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1108966215")

  // remove field
  collection.fields.removeById("text3669478755")

  return app.save(collection)
})

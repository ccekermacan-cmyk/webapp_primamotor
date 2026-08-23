/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1108966215")

  // add field
  collection.fields.addAt(23, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text3277268710",
    "max": 0,
    "min": 0,
    "name": "thumbnail",
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
  collection.fields.removeById("text3277268710")

  return app.save(collection)
})

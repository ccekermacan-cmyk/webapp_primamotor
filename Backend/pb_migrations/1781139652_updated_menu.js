/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1510497571")

  // remove field
  collection.fields.removeById("text3371740703")

  // add field
  collection.fields.addAt(17, new Field({
    "help": "",
    "hidden": false,
    "id": "number3371740703",
    "max": null,
    "min": null,
    "name": "qty",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1510497571")

  // add field
  collection.fields.addAt(12, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text3371740703",
    "max": 0,
    "min": 0,
    "name": "qty",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // remove field
  collection.fields.removeById("number3371740703")

  return app.save(collection)
})

/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_938605140")

  // add field
  collection.fields.addAt(30, new Field({
    "help": "",
    "hidden": false,
    "id": "number2039911538",
    "max": null,
    "min": null,
    "name": "number_5",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_938605140")

  // remove field
  collection.fields.removeById("number2039911538")

  return app.save(collection)
})

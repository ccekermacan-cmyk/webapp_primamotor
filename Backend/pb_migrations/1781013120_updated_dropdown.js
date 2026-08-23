/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_938605140")

  // add field
  collection.fields.addAt(29, new Field({
    "help": "",
    "hidden": false,
    "id": "number244425956",
    "max": null,
    "min": null,
    "name": "number_4",
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
  collection.fields.removeById("number244425956")

  return app.save(collection)
})

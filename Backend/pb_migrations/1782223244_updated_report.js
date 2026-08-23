/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4080798410")

  // add field
  collection.fields.addAt(6, new Field({
    "help": "",
    "hidden": false,
    "id": "number4232161825",
    "max": null,
    "min": null,
    "name": "laba_minuman",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(7, new Field({
    "help": "",
    "hidden": false,
    "id": "number2838121330",
    "max": null,
    "min": null,
    "name": "laba_service",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4080798410")

  // remove field
  collection.fields.removeById("number4232161825")

  // remove field
  collection.fields.removeById("number2838121330")

  return app.save(collection)
})

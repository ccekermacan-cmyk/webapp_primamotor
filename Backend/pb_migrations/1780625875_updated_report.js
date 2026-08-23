/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4080798410")

  // add field
  collection.fields.addAt(10, new Field({
    "help": "",
    "hidden": false,
    "id": "number3786893093",
    "max": null,
    "min": null,
    "name": "hutang",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(11, new Field({
    "help": "",
    "hidden": false,
    "id": "number3928824438",
    "max": null,
    "min": null,
    "name": "piutang",
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
  collection.fields.removeById("number3786893093")

  // remove field
  collection.fields.removeById("number3928824438")

  return app.save(collection)
})

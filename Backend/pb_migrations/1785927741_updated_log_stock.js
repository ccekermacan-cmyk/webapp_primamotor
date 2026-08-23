/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_258169765")

  // add field
  collection.fields.addAt(50, new Field({
    "hidden": false,
    "id": "number3874029181",
    "max": null,
    "min": null,
    "name": "qty_awal",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(51, new Field({
    "hidden": false,
    "id": "number3874029182",
    "max": null,
    "min": null,
    "name": "qty_akhir",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_258169765")

  // remove field
  collection.fields.removeById("number3874029181")

  // remove field
  collection.fields.removeById("number3874029182")

  return app.save(collection)
})

/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_28913142")

  // add field
  collection.fields.addAt(50, new Field({
    "hidden": false,
    "id": "number3874029191",
    "max": null,
    "min": null,
    "name": "saldo_awal",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(51, new Field({
    "hidden": false,
    "id": "number3874029192",
    "max": null,
    "min": null,
    "name": "saldo_akhir",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_28913142")

  // remove field
  collection.fields.removeById("number3874029191")

  // remove field
  collection.fields.removeById("number3874029192")

  return app.save(collection)
})

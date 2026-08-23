/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_258169765")

  // add stok_awal (replace qty_awal)
  collection.fields.addAt(52, new Field({
    "hidden": false,
    "id": "number9876543210",
    "max": null,
    "min": null,
    "name": "stok_awal",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add stok_akhir (replace qty_akhir)
  collection.fields.addAt(53, new Field({
    "hidden": false,
    "id": "number9876543211",
    "max": null,
    "min": null,
    "name": "stok_akhir",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_258169765")

  collection.fields.removeById("number9876543210")
  collection.fields.removeById("number9876543211")

  return app.save(collection)
})

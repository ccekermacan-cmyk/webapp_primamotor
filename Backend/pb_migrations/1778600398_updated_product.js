/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1108966215")

  // update field
  collection.fields.addAt(8, new Field({
    "help": "",
    "hidden": false,
    "id": "select3703245907",
    "maxSelect": 0,
    "name": "unit",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "pcs",
      "cm",
      "m"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1108966215")

  // update field
  collection.fields.addAt(8, new Field({
    "help": "",
    "hidden": false,
    "id": "select3703245907",
    "maxSelect": 0,
    "name": "unit",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "pcs",
      "cm"
    ]
  }))

  return app.save(collection)
})

/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4198167069")

  // update field
  collection.fields.addAt(7, new Field({
    "help": "",
    "hidden": false,
    "id": "select1831371789",
    "maxSelect": 0,
    "name": "payment",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "Cash",
      "Tempo",
      "cash",
      "tempo"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4198167069")

  // update field
  collection.fields.addAt(7, new Field({
    "help": "",
    "hidden": false,
    "id": "select1831371789",
    "maxSelect": 0,
    "name": "payment",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "cash",
      "tempo"
    ]
  }))

  return app.save(collection)
})

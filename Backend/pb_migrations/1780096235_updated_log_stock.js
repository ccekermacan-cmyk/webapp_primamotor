/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_258169765")

  // remove field
  collection.fields.removeById("number2130399339")

  // remove field
  collection.fields.removeById("number3891397073")

  // remove field
  collection.fields.removeById("text2324007016")

  // add field
  collection.fields.addAt(10, new Field({
    "help": "",
    "hidden": false,
    "id": "select2324007016",
    "maxSelect": 0,
    "name": "boolean",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "in",
      "out"
    ]
  }))

  // add field
  collection.fields.addAt(11, new Field({
    "help": "",
    "hidden": false,
    "id": "number562391268",
    "max": null,
    "min": null,
    "name": "normal",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_258169765")

  // add field
  collection.fields.addAt(8, new Field({
    "help": "",
    "hidden": false,
    "id": "number2130399339",
    "max": null,
    "min": null,
    "name": "number_1",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(9, new Field({
    "help": "",
    "hidden": false,
    "id": "number3891397073",
    "max": null,
    "min": null,
    "name": "number_2",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(10, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text2324007016",
    "max": 0,
    "min": 0,
    "name": "boolean",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // remove field
  collection.fields.removeById("select2324007016")

  // remove field
  collection.fields.removeById("number562391268")

  return app.save(collection)
})

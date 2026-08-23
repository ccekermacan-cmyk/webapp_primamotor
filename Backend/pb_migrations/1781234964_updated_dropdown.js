/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_938605140")

  // update field
  collection.fields.addAt(14, new Field({
    "help": "",
    "hidden": false,
    "id": "number2130399339",
    "max": null,
    "min": null,
    "name": "number_2",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // update field
  collection.fields.addAt(15, new Field({
    "help": "",
    "hidden": false,
    "id": "number3891397073",
    "max": null,
    "min": null,
    "name": "number_3",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // update field
  collection.fields.addAt(16, new Field({
    "help": "",
    "hidden": false,
    "id": "number2431988039",
    "max": null,
    "min": null,
    "name": "number_4",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // update field
  collection.fields.addAt(29, new Field({
    "help": "",
    "hidden": false,
    "id": "number244425956",
    "max": null,
    "min": null,
    "name": "number_1",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_938605140")

  // update field
  collection.fields.addAt(14, new Field({
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

  // update field
  collection.fields.addAt(15, new Field({
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

  // update field
  collection.fields.addAt(16, new Field({
    "help": "",
    "hidden": false,
    "id": "number2431988039",
    "max": null,
    "min": null,
    "name": "number_3",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // update field
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
})

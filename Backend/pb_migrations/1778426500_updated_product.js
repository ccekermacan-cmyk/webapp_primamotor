/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1108966215")

  // add field
  collection.fields.addAt(10, new Field({
    "help": "",
    "hidden": false,
    "id": "number828775855",
    "max": null,
    "min": null,
    "name": "sell_1",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(11, new Field({
    "help": "",
    "hidden": false,
    "id": "number2825866261",
    "max": null,
    "min": null,
    "name": "sell_2",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(12, new Field({
    "help": "",
    "hidden": false,
    "id": "number3748166787",
    "max": null,
    "min": null,
    "name": "sell_3",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(13, new Field({
    "help": "",
    "hidden": false,
    "id": "number1091365152",
    "max": null,
    "min": null,
    "name": "sell_4",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(14, new Field({
    "help": "",
    "hidden": false,
    "id": "number906746294",
    "max": null,
    "min": null,
    "name": "sell_5",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(15, new Field({
    "help": "",
    "hidden": false,
    "id": "number2936178700",
    "max": null,
    "min": null,
    "name": "sell_6",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(16, new Field({
    "help": "",
    "hidden": false,
    "id": "number3474611171",
    "max": null,
    "min": null,
    "name": "min_1",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(17, new Field({
    "help": "",
    "hidden": false,
    "id": "number1444088409",
    "max": null,
    "min": null,
    "name": "min_2",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(18, new Field({
    "help": "",
    "hidden": false,
    "id": "number554973903",
    "max": null,
    "min": null,
    "name": "min_3",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(20, new Field({
    "help": "",
    "hidden": false,
    "id": "number3793046348",
    "max": null,
    "min": null,
    "name": "stok_2",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(21, new Field({
    "help": "",
    "hidden": false,
    "id": "number2501016538",
    "max": null,
    "min": null,
    "name": "stok_3",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(22, new Field({
    "help": "",
    "hidden": false,
    "id": "date2862495610",
    "max": "",
    "min": "",
    "name": "date",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  // update field
  collection.fields.addAt(9, new Field({
    "help": "",
    "hidden": false,
    "id": "number55645192",
    "max": null,
    "min": null,
    "name": "beli",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // update field
  collection.fields.addAt(19, new Field({
    "help": "",
    "hidden": false,
    "id": "number2065439478",
    "max": null,
    "min": null,
    "name": "stok_1",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1108966215")

  // remove field
  collection.fields.removeById("number828775855")

  // remove field
  collection.fields.removeById("number2825866261")

  // remove field
  collection.fields.removeById("number3748166787")

  // remove field
  collection.fields.removeById("number1091365152")

  // remove field
  collection.fields.removeById("number906746294")

  // remove field
  collection.fields.removeById("number2936178700")

  // remove field
  collection.fields.removeById("number3474611171")

  // remove field
  collection.fields.removeById("number1444088409")

  // remove field
  collection.fields.removeById("number554973903")

  // remove field
  collection.fields.removeById("number3793046348")

  // remove field
  collection.fields.removeById("number2501016538")

  // remove field
  collection.fields.removeById("date2862495610")

  // update field
  collection.fields.addAt(9, new Field({
    "help": "",
    "hidden": false,
    "id": "number55645192",
    "max": null,
    "min": null,
    "name": "beli",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // update field
  collection.fields.addAt(10, new Field({
    "help": "",
    "hidden": false,
    "id": "number2065439478",
    "max": null,
    "min": null,
    "name": "stok_1",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
})

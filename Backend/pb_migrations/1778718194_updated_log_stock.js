/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_258169765")

  // remove field
  collection.fields.removeById("text342834851")

  // remove field
  collection.fields.removeById("relation3547045571")

  // add field
  collection.fields.addAt(11, new Field({
    "convertURLs": false,
    "help": "",
    "hidden": false,
    "id": "editor342834851",
    "maxSize": 0,
    "name": "ref",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "editor"
  }))

  // add field
  collection.fields.addAt(12, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_1510497571",
    "help": "",
    "hidden": false,
    "id": "relation1653163849",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "relation",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_258169765")

  // add field
  collection.fields.addAt(11, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text342834851",
    "max": 0,
    "min": 0,
    "name": "ref",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(12, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_1510497571",
    "help": "",
    "hidden": false,
    "id": "relation3547045571",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "ref_baru",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // remove field
  collection.fields.removeById("editor342834851")

  // remove field
  collection.fields.removeById("relation1653163849")

  return app.save(collection)
})

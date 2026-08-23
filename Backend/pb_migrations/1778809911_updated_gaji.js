/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1121029328")

  // remove field
  collection.fields.removeById("text342834851")

  // update field
  collection.fields.addAt(19, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_1510497571",
    "help": "",
    "hidden": false,
    "id": "relation3547045571",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "ref",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1121029328")

  // add field
  collection.fields.addAt(2, new Field({
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

  // update field
  collection.fields.addAt(20, new Field({
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

  return app.save(collection)
})

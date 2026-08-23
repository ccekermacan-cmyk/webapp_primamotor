/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4082886426")

  // add field
  collection.fields.addAt(4, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_1121029328",
    "help": "",
    "hidden": false,
    "id": "relation1924115175",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "ref_gaji",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_1510497571",
    "help": "",
    "hidden": false,
    "id": "relation1786149652",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "ref_menu",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // update field
  collection.fields.addAt(5, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_28913142",
    "help": "",
    "hidden": false,
    "id": "relation342834851",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "ref_cashflow",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4082886426")

  // remove field
  collection.fields.removeById("relation1924115175")

  // remove field
  collection.fields.removeById("relation1786149652")

  // update field
  collection.fields.addAt(4, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_28913142",
    "help": "",
    "hidden": false,
    "id": "relation342834851",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "ref",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
})

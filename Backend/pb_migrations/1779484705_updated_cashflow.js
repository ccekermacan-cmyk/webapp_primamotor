/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_28913142")

  // remove field
  collection.fields.removeById("text886886774")

  // add field
  collection.fields.addAt(12, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_938605140",
    "help": "",
    "hidden": false,
    "id": "relation360655678",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "person_customer",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_28913142")

  // add field
  collection.fields.addAt(7, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text886886774",
    "max": 0,
    "min": 0,
    "name": "person",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // remove field
  collection.fields.removeById("relation360655678")

  return app.save(collection)
})

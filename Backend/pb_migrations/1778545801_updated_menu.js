/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4198167069")

  // remove field
  collection.fields.removeById("date1958079343")

  // add field
  collection.fields.addAt(13, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text1958079343",
    "max": 0,
    "min": 0,
    "name": "tempo",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4198167069")

  // add field
  collection.fields.addAt(13, new Field({
    "help": "",
    "hidden": false,
    "id": "date1958079343",
    "max": "",
    "min": "",
    "name": "tempo",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  // remove field
  collection.fields.removeById("text1958079343")

  return app.save(collection)
})

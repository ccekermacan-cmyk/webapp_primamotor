/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4082886426")

  // add field
  collection.fields.addAt(3, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text4121786662",
    "max": 0,
    "min": 0,
    "name": "persontext",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4082886426")

  // remove field
  collection.fields.removeById("text4121786662")

  return app.save(collection)
})

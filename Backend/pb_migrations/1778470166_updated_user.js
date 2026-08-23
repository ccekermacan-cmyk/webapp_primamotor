/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // add field
  collection.fields.addAt(8, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text4166911607",
    "max": 0,
    "min": 0,
    "name": "username",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(9, new Field({
    "help": "",
    "hidden": false,
    "id": "select2063623452",
    "maxSelect": 0,
    "name": "status",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "active",
      "inactive"
    ]
  }))

  // add field
  collection.fields.addAt(10, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text1787189377",
    "max": 0,
    "min": 0,
    "name": "link_image",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // remove field
  collection.fields.removeById("text4166911607")

  // remove field
  collection.fields.removeById("select2063623452")

  // remove field
  collection.fields.removeById("text1787189377")

  return app.save(collection)
})

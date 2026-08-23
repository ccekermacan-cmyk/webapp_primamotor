/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_28913142")

  // add field
  collection.fields.addAt(17, new Field({
    "help": "",
    "hidden": false,
    "id": "file2359244304",
    "maxSelect": 0,
    "maxSize": 0,
    "mimeTypes": null,
    "name": "file",
    "presentable": false,
    "protected": false,
    "required": false,
    "system": false,
    "thumbs": null,
    "type": "file"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_28913142")

  // remove field
  collection.fields.removeById("file2359244304")

  return app.save(collection)
})

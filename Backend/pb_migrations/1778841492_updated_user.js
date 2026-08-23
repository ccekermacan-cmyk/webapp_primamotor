/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_tokenKey__pb_users_auth_` ON `user` (`tokenKey`)",
      "CREATE UNIQUE INDEX `idx_email__pb_users_auth_` ON `user` (`email`) WHERE `email` != ''",
      "CREATE UNIQUE INDEX `idx_y8zvck5ei7` ON `user` (`username`)"
    ]
  }, collection)

  // add field
  collection.fields.addAt(11, new Field({
    "help": "",
    "hidden": false,
    "id": "select2599078931",
    "maxSelect": 0,
    "name": "level",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "1",
      "2",
      "3",
      "5",
      "6",
      "7",
      "10"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_tokenKey__pb_users_auth_` ON `user` (`tokenKey`)",
      "CREATE UNIQUE INDEX `idx_email__pb_users_auth_` ON `user` (`email`) WHERE `email` != ''"
    ]
  }, collection)

  // remove field
  collection.fields.removeById("select2599078931")

  return app.save(collection)
})

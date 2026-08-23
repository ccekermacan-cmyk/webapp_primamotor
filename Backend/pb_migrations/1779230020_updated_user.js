/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_tokenKey__pb_users_auth_` ON `user` (`tokenKey`)",
      "CREATE UNIQUE INDEX `idx_email__pb_users_auth_` ON `user` (`email`) WHERE `email` != ''",
      "CREATE UNIQUE INDEX `idx_84kozpay4b` ON `user` (`username`)"
    ]
  }, collection)

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

  return app.save(collection)
})

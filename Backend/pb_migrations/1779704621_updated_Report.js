/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4103081980")

  // update collection data
  unmarshal({
    "name": "report"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4103081980")

  // update collection data
  unmarshal({
    "name": "Report"
  }, collection)

  return app.save(collection)
})

/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const dropdown = app.findCollectionByNameOrId("dropdown");
  const user = app.findCollectionByNameOrId("user");
  const menu = app.findCollectionByNameOrId("menu");
  const bon = app.findCollectionByNameOrId("bon");
  const addRelation = (collection, name, target) => {
    if (!collection.fields.getByName(name)) {
      collection.fields.add(new Field({ type: "relation", name, collectionId: target.id,
        maxSelect: 1, minSelect: 0, required: false, cascadeDelete: false }));
    }
  };
  addRelation(menu, "person_baru", dropdown);
  addRelation(bon, "user", user);
  addRelation(bon, "ref_menu", menu);
  app.save(menu);
  app.save(bon);
}, (app) => {
  // Retain additive relation fields and historical references during rollback.
});

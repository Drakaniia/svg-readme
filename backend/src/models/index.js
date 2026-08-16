const User = require("./User");
const Project = require("./Project");
const Layer = require("./Layer");
const Element = require("./Element");

// Serialize documents with a stable JSON contract:
//   { id, ... } — no _id, no __v, no mongoose internals.
for (const Model of [User, Project, Layer, Element]) {
  Model.schema.set("toJSON", {
    versionKey: false,
    transform(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      return ret;
    },
  });
  Model.schema.set("toObject", {
    versionKey: false,
    transform(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      return ret;
    },
  });
}

module.exports = { User, Project, Layer, Element };

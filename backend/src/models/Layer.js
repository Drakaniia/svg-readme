const { Schema, model } = require("mongoose");
const { randomUUID } = require("node:crypto");

const layerSchema = new Schema(
  {
    _id: { type: String, default: randomUUID },
    projectId: { type: String, required: true, index: true },
    name: { type: String, default: "New Layer" },
    type: { type: String, default: "shape" },
    orderIndex: { type: Number, default: 0 },
    isLocked: { type: Boolean, default: false },
    isVisible: { type: Boolean, default: true },
    parentId: { type: String, default: null },
  },
  { timestamps: true },
);

module.exports = model("Layer", layerSchema);

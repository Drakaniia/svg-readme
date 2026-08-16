const { Schema, model } = require("mongoose");
const { randomUUID } = require("node:crypto");

const elementSchema = new Schema(
  {
    _id: { type: String, default: randomUUID },
    layerId: { type: String, required: true, index: true },
    type: { type: String, default: "shape" },
    orderIndex: { type: Number, default: 0 },
    properties: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

module.exports = model("Element", elementSchema);

const { Schema, model } = require("mongoose");
const { randomUUID } = require("node:crypto");

const projectSchema = new Schema(
  {
    _id: { type: String, default: randomUUID },
    userId: { type: String, required: true, index: true },
    name: { type: String, default: "Untitled" },
    canvasWidth: { type: Number, default: 800 },
    canvasHeight: { type: Number, default: 200 },
  },
  { timestamps: true },
);

module.exports = model("Project", projectSchema);

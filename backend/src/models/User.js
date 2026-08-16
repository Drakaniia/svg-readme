const { Schema, model } = require("mongoose");
const { randomUUID } = require("node:crypto");

const userSchema = new Schema(
  {
    _id: { type: String, default: randomUUID },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

module.exports = model("User", userSchema);

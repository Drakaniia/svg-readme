const mongoose = require("mongoose");

let cached = null;

// Lazy singleton connection: safe for serverless cold starts (each warm
// function reuses the cached connection instead of opening a new pool).
async function connectDB() {
  if (cached) return cached;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  cached = await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  return cached;
}

module.exports = { connectDB, mongoose };

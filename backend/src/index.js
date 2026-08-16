require("dotenv").config();
const app = require("./app");
const { connectDB } = require("./config/db");
const { User, Project } = require("./models");

// Seed default User/Project for development lookup
async function seedDefaultData() {
  try {
    const defaultUserId = "00000000-0000-0000-0000-000000000000";
    const defaultProjectId = "00000000-0000-0000-0000-000000000001";

    await User.findOneAndUpdate(
      { _id: defaultUserId },
      { $setOnInsert: { email: "default@example.com", passwordHash: "" } },
      { upsert: true },
    );

    await Project.findOneAndUpdate(
      { _id: defaultProjectId },
      {
        $setOnInsert: {
          userId: defaultUserId,
          name: "Default Project",
        },
      },
      { upsert: true },
    );
    console.log("✓ Seeding complete: Default User and Project are verified.");
  } catch (error) {
    console.error("Failed to seed default database records:", error);
  }
}

async function start() {
  await connectDB();
  await seedDefaultData();
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = { app, start };
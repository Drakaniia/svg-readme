require("dotenv").config();
const app = require("./app");
const prisma = require("./config/db");

// Seed default User/Project for development lookup
async function seedDefaultData() {
  try {
    const defaultUserId = "00000000-0000-0000-0000-000000000000";
    const defaultProjectId = "00000000-0000-0000-0000-000000000001";

    await prisma.user.upsert({
      where: { id: defaultUserId },
      update: {},
      create: {
        id: defaultUserId,
        email: "default@example.com",
        passwordHash: "",
      },
    });

    await prisma.project.upsert({
      where: { id: defaultProjectId },
      update: {},
      create: {
        id: defaultProjectId,
        userId: defaultUserId,
        name: "Default Project",
      },
    });
    console.log("✓ Seeding complete: Default User and Project are verified.");
  } catch (error) {
    console.error("Failed to seed default database records:", error);
  }
}

seedDefaultData();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

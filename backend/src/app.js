const express = require("express");
const cors = require("cors");
const projectRoutes = require("./routes/projectRoutes");
const layerRoutes = require("./routes/layerRoutes");
const elementRoutes = require("./routes/elementRoutes");
const authRoutes = require("./routes/authRoutes");
const { protect, requireProjectOwner } = require("./middleware/authMiddleware");
const { errorHandler } = require("./middleware/errorMiddleware");
const layerController = require("./controllers/layerController");
const { connectDB } = require("./config/db");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Ensure a shared Mongo connection before handling requests. Safe for
// serverless cold starts: connectDB caches the connection promise.
app.use(async (req, res, next) => {
  try {
    if (process.env.MONGODB_URI) await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

// ─── Auth ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);

// ─── Legacy routes (backward compatible, default project) ──────────────────
app.get("/api/layers", async (req, res, next) => {
  try {
    req.params = { projectId: "00000000-0000-0000-0000-000000000001" };
    return layerController.getLayers(req, res, next);
  } catch (e) {
    next(e);
  }
});

app.post("/api/layers", async (req, res, next) => {
  try {
    req.params = { projectId: "00000000-0000-0000-0000-000000000001" };
    return layerController.createLayer(req, res, next);
  } catch (e) {
    next(e);
  }
});

// Basic health check route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ─── Mount Routes (authenticated + project-scoped) ──────────────────────────
// Nested routes are mounted BEFORE /api/projects so they match first and
// protect runs exactly once per request (otherwise the /api/projects mount
// would also catch /api/projects/:id/layers… paths).
app.use(
  "/api/projects/:projectId/layers",
  protect,
  requireProjectOwner,
  layerRoutes,
);
// Elements are nested under a project: /api/projects/:projectId/elements
app.use(
  "/api/projects/:projectId/elements",
  protect,
  requireProjectOwner,
  elementRoutes,
);
app.use("/api/projects", protect, projectRoutes);

// Error Middleware
app.use(errorHandler);

module.exports = app;

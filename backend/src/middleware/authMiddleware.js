const prisma = require("../config/db");
const { verifyToken } = require("../lib/jwt");

/**
 * Protect a route with a Bearer JWT. Attaches req.user = { id, email }.
 * 401 when the token is missing, invalid, or the user no longer exists.
 */
const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

    if (!token) {
      return res.status(401).json({ error: "Not authorized, no token provided" });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      return res.status(401).json({ error: "Not authorized, invalid token" });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true },
    });
    if (!user) {
      return res.status(401).json({ error: "Not authorized, user not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Require the authenticated user to own the project referenced in the URL
 * (:projectId or :id). Attaches req.project and 404/403 on failure.
 */
const requireProjectOwner = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.params.id;
    if (!projectId) {
      return res.status(400).json({ error: "Project id missing" });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, userId: true },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    if (project.userId !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Not authorized to access this project" });
    }

    req.project = project;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { protect, requireProjectOwner };

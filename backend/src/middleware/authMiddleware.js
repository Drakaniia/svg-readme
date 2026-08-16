const { User, Project } = require("../models");
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

    const user = await User.findById(decoded.id, { email: 1 });
    if (!user) {
      return res.status(401).json({ error: "Not authorized, user not found" });
    }

    req.user = { id: user._id.toString(), email: user.email };
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

    const project = await Project.findById(projectId, { userId: 1 });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    if (project.userId !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Not authorized to access this project" });
    }

    req.project = { id: project._id.toString(), userId: project.userId };
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { protect, requireProjectOwner };
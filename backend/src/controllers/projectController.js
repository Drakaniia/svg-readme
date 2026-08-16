const { Project, Layer } = require("../models");

async function layerCount(projectId) {
  return Layer.countDocuments({ projectId });
}

async function toJson(doc) {
  if (!doc) return null;
  const json = doc.toObject();
  json._count = { layers: await layerCount(json.id) };
  return json;
}

// @desc    Get all projects owned by the current user
// @route   GET /api/projects
const getProjects = async (req, res, next) => {
  try {
    const projects = await Project.find(
      { userId: req.user.id },
      null,
      { sort: { updatedAt: -1 } },
    );
    const out = await Promise.all(projects.map(toJson));
    res.json(out);
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single project by ID (must be owned)
// @route   GET /api/projects/:id
const getProject = async (req, res, next) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(await toJson(project));
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new project for the current user
// @route   POST /api/projects
const createProject = async (req, res, next) => {
  try {
    const { id, name, canvasWidth, canvasHeight } = req.body;
    const project = await Project.create({
      _id: id || undefined,
      userId: req.user.id,
      name: name ?? "Untitled",
      canvasWidth: canvasWidth ?? 800,
      canvasHeight: canvasHeight ?? 200,
    });
    res.status(201).json(await toJson(project));
  } catch (error) {
    next(error);
  }
};

// @desc    Update a project (must be owned)
// @route   PUT /api/projects/:id
const updateProject = async (req, res, next) => {
  try {
    const { name, canvasWidth, canvasHeight } = req.body;

    const owned = await Project.findOne(
      { _id: req.params.id, userId: req.user.id },
      { _id: 1 },
    );
    if (!owned) return res.status(404).json({ error: "Project not found" });

    const data = {};
    if (name !== undefined) data.name = name;
    if (canvasWidth !== undefined) data.canvasWidth = canvasWidth;
    if (canvasHeight !== undefined) data.canvasHeight = canvasHeight;

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { $set: data },
      { new: true },
    );
    res.json(await toJson(project));
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a project (must be owned)
// @route   DELETE /api/projects/:id
const deleteProject = async (req, res, next) => {
  try {
    const owned = await Project.findOne(
      { _id: req.params.id, userId: req.user.id },
      { _id: 1 },
    );
    if (!owned) return res.status(404).json({ error: "Project not found" });

    await Project.deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
};

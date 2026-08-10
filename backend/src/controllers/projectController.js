const prisma = require("../config/db");

// @desc    Get all projects owned by the current user
// @route   GET /api/projects
const getProjects = async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { layers: true } } },
    });
    res.json(projects);
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single project by ID (must be owned)
// @route   GET /api/projects/:id
const getProject = async (req, res, next) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { _count: { select: { layers: true } } },
    });
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new project for the current user
// @route   POST /api/projects
const createProject = async (req, res, next) => {
  try {
    const { id, name, canvasWidth, canvasHeight } = req.body;
    const project = await prisma.project.create({
      data: {
        ...(id ? { id } : {}),
        userId: req.user.id,
        name: name ?? "Untitled",
        canvasWidth: canvasWidth ?? 800,
        canvasHeight: canvasHeight ?? 200,
      },
    });
    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
};

// @desc    Update a project (must be owned)
// @route   PUT /api/projects/:id
const updateProject = async (req, res, next) => {
  try {
    const { name, canvasWidth, canvasHeight } = req.body;

    const owned = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      select: { id: true },
    });
    if (!owned) return res.status(404).json({ error: "Project not found" });

    const data = {};
    if (name !== undefined) data.name = name;
    if (canvasWidth !== undefined) data.canvasWidth = canvasWidth;
    if (canvasHeight !== undefined) data.canvasHeight = canvasHeight;

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data,
    });
    res.json(project);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a project (must be owned)
// @route   DELETE /api/projects/:id
const deleteProject = async (req, res, next) => {
  try {
    const owned = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      select: { id: true },
    });
    if (!owned) return res.status(404).json({ error: "Project not found" });

    await prisma.project.delete({ where: { id: req.params.id } });
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

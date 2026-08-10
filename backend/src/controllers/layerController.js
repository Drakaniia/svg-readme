const prisma = require("../config/db");

// @desc    Get all layers for a project
// @route   GET /api/projects/:projectId/layers
const getLayers = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const layers = await prisma.layer.findMany({
      where: { projectId },
      orderBy: { orderIndex: "asc" },
    });
    res.json(layers);
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new layer in a project
// @route   POST /api/projects/:projectId/layers
const createLayer = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { id, name, orderIndex } = req.body;

    // Shift existing layers down to make room at top
    await prisma.layer.updateMany({
      where: { projectId },
      data: { orderIndex: { increment: 1 } },
    });

    const layer = await prisma.layer.create({
      data: {
        ...(id ? { id } : {}),
        name: name || "New Layer",
        orderIndex: orderIndex ?? 0,
        projectId,
      },
    });
    res.status(201).json(layer);
  } catch (error) {
    next(error);
  }
};

// @desc    Update a layer (name, isLocked, isVisible, orderIndex)
// @route   PUT /api/projects/:projectId/layers/:id
const updateLayer = async (req, res, next) => {
  try {
    const { id, projectId } = req.params;
    const { name, isLocked, isVisible, orderIndex } = req.body;

    // The layer must belong to the (already ownership-checked) project
    const owned = await prisma.layer.findFirst({
      where: { id, projectId },
      select: { id: true },
    });
    if (!owned) return res.status(404).json({ error: "Layer not found" });

    const data = {};
    if (name !== undefined) data.name = name;
    if (isLocked !== undefined) data.isLocked = isLocked;
    if (isVisible !== undefined) data.isVisible = isVisible;
    if (orderIndex !== undefined) data.orderIndex = orderIndex;

    const layer = await prisma.layer.update({
      where: { id },
      data,
    });
    res.json(layer);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a layer
// @route   DELETE /api/projects/:projectId/layers/:id
const deleteLayer = async (req, res, next) => {
  try {
    const { id, projectId } = req.params;

    const owned = await prisma.layer.findFirst({
      where: { id, projectId },
      select: { id: true },
    });
    if (!owned) return res.status(404).json({ error: "Layer not found" });

    await prisma.layer.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// @desc    Reorder all layers in a project (bulk update)
// @route   PUT /api/projects/:projectId/layers/reorder
const reorderLayers = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { layers } = req.body; // Array of { id, orderIndex }

    const updates = layers.map(({ id, orderIndex }) =>
      prisma.layer.updateMany({
        where: { id, projectId },
        data: { orderIndex },
      }),
    );

    await prisma.$transaction(updates);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLayers,
  createLayer,
  updateLayer,
  deleteLayer,
  reorderLayers,
};

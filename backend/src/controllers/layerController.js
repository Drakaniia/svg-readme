const { Layer } = require("../models");

// @desc    Get all layers for a project
// @route   GET /api/projects/:projectId/layers
const getLayers = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const layers = await Layer.find({ projectId }, null, {
      sort: { orderIndex: 1 },
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
    await Layer.updateMany({ projectId }, { $inc: { orderIndex: 1 } });

    const layer = await Layer.create({
      _id: id || undefined,
      name: name || "New Layer",
      orderIndex: orderIndex ?? 0,
      projectId,
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

    const owned = await Layer.findOne({ _id: id, projectId }, { _id: 1 });
    if (!owned) return res.status(404).json({ error: "Layer not found" });

    const data = {};
    if (name !== undefined) data.name = name;
    if (isLocked !== undefined) data.isLocked = isLocked;
    if (isVisible !== undefined) data.isVisible = isVisible;
    if (orderIndex !== undefined) data.orderIndex = orderIndex;

    const layer = await Layer.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true },
    );
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

    const owned = await Layer.findOne({ _id: id, projectId }, { _id: 1 });
    if (!owned) return res.status(404).json({ error: "Layer not found" });

    await Layer.deleteOne({ _id: id });
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

    await Promise.all(
      layers.map(({ id, orderIndex }) =>
        Layer.updateOne({ _id: id, projectId }, { $set: { orderIndex } }),
      ),
    );
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

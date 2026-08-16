const { Layer, Element } = require("../models");

// @desc    Get all elements for a project's layers
// @route   GET /api/projects/:projectId/elements
const getElements = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const layers = await Layer.find({ projectId }, { _id: 1 });
    const layerIds = layers.map((l) => l._id);

    const elements = await Element.find(
      { layerId: { $in: layerIds } },
      null,
      { sort: { orderIndex: 1 } },
    );
    res.json(elements);
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk save elements for a project (delete + re-insert)
// @route   PUT /api/projects/:projectId/elements
const saveElements = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { elements } = req.body; // Array of { layerId, type, properties, orderIndex }

    // Get all layer IDs for this project
    const projectLayers = await Layer.find({ projectId }, { _id: 1 });
    const layerIds = projectLayers.map((l) => l._id);

    // Delete existing elements for this project's layers, then bulk insert
    await Element.deleteMany({ layerId: { $in: layerIds } });

    if (elements && elements.length > 0) {
      await Element.insertMany(
        elements.map((el, i) => ({
          ...(el.id ? { _id: el.id } : {}),
          layerId: el.layerId,
          type: el.type ?? "shape",
          orderIndex: el.orderIndex ?? i,
          properties: el.properties ?? {},
        })),
      );
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = { getElements, saveElements };
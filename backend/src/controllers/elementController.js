const prisma = require("../config/db");

// @desc    Get all elements for a project's layers
// @route   GET /api/projects/:projectId/elements
const getElements = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const elements = await prisma.element.findMany({
      where: { layer: { projectId } },
      orderBy: { orderIndex: "asc" },
    });
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
    const projectLayers = await prisma.layer.findMany({
      where: { projectId },
      select: { id: true },
    });
    const layerIds = projectLayers.map((l) => l.id);

    // Delete existing elements for this project's layers, then bulk insert
    const ops = [
      prisma.element.deleteMany({ where: { layerId: { in: layerIds } } }),
    ];

    if (elements && elements.length > 0) {
      elements.forEach((el, i) => {
        ops.push(
          prisma.element.create({
            data: {
              id: el.id ?? undefined,
              layerId: el.layerId,
              type: el.type ?? "shape",
              orderIndex: el.orderIndex ?? i,
              properties: el.properties ?? {},
            },
          }),
        );
      });
    }

    await prisma.$transaction(ops);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = { getElements, saveElements };

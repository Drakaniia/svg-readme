import type { EditorTool, ShapeSubTool } from "../../context/EditorContext";
import type { ToolHandler } from "./types";
import { MoveTool } from "./MoveTool";
import { TextTool } from "./TextTool";
import { createShapeTool } from "./ShapeTool";
import { PanTool } from "./PanTool";
import { PenTool } from "./PenTool";
import { HandTool } from "./HandTool";
import { PaintTool } from "./PaintTool";

/**
 * Map every EditorTool to its ToolHandler.
 *
 * The "shape" tool is parameterized by `ShapeSubTool` — created dynamically via
 * `getToolHandler("shape", selectedShapeKind)`. Non-shape tools are singletons.
 */
const registry: Record<Exclude<EditorTool, "shape">, ToolHandler> = {
  move: MoveTool,
  hand: HandTool,
  text: TextTool,
  frame: PanTool,
  pen: PenTool,
  image: PanTool,
  paint: PaintTool,
};

const LEGACY_SHAPES = new Set<string>(["rect", "circle", "triangle", "star", "hexagon", "line"]);

/**
 * Return the ToolHandler for a given EditorTool.
 * For the "shape" tool, pass `shapeKind` to create the correct shape handler.
 * Legacy shape strings (e.g. "rect") are supported for backwards compat with
 * existing tests that still use the pre-phase2 tool names.
 */
export function getToolHandler(tool: EditorTool | ShapeSubTool | string, shapeKind?: ShapeSubTool): ToolHandler {
  if (tool === "shape") {
    return createShapeTool(shapeKind ?? "rect");
  }
  if (LEGACY_SHAPES.has(tool as string)) {
    return createShapeTool(tool as ShapeSubTool);
  }
  return registry[tool as Exclude<EditorTool, "shape">];
}

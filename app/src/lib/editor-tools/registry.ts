import type { EditorTool } from "../../context/EditorContext";
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
 * Shape tools share a factory (`createShapeTool`) because their interaction
 * is identical — only the ShapeKind parameter differs.
 */
const registry: Record<EditorTool, ToolHandler> = {
  move: MoveTool,
  hand: HandTool,
  text: TextTool,
  frame: PanTool,
  pen: PenTool,
  image: PanTool,
  paint: PaintTool,
  rect: createShapeTool("rect"),
  circle: createShapeTool("circle"),
  triangle: createShapeTool("triangle"),
  star: createShapeTool("star"),
  hexagon: createShapeTool("hexagon"),
  line: createShapeTool("line"),
};

/**
 * Return the ToolHandler for a given EditorTool.
 * Never returns undefined because every tool has a registered handler.
 */
export function getToolHandler(tool: EditorTool): ToolHandler {
  return registry[tool];
}

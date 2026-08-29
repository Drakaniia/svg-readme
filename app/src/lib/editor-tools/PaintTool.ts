import type { ToolInteractionState, ToolHandler } from "./types";

/**
 * Paint bucket tool. Painting is an instant action (not a drag), so the
 * handler only provides a cursor — the actual paint mutation is performed by
 * Canvas via the onPaintLayer callback (see Canvas.handleElementMouseDown).
 * Clicking the empty canvas returns nothing so the canvas itself is never
 * painted.
 */
export const PaintTool: ToolHandler = {
  getCursor(_state: ToolInteractionState): string {
    return "copy";
  },
};
import type { ShapeKind } from "../../components/editor-canvas/ElementsRenderer";

import type { ToolEventContext, ToolInteractionState, ToolHandler } from "./types";

export function createShapeTool(kind: ShapeKind): ToolHandler {
  return {
    getCursor(_state: ToolInteractionState): string {
      return "crosshair";
    },

    onCanvasMouseDown(ctx: ToolEventContext): Partial<ToolInteractionState> | void {
      return {
        shapeDragState: {
          kind,
          startX: ctx.worldPoint.x,
          startY: ctx.worldPoint.y,
          currentX: ctx.worldPoint.x,
          currentY: ctx.worldPoint.y,
          shiftKey: ctx.shiftKey,
        },
      };
    },

    onMouseMove(ctx: ToolEventContext, state: ToolInteractionState): Partial<ToolInteractionState> | void {
      if (state.shapeDragState) {
        return {
          shapeDragState: {
            ...state.shapeDragState,
            currentX: ctx.worldPoint.x,
            currentY: ctx.worldPoint.y,
            shiftKey: ctx.shiftKey,
          },
        };
      }
      return undefined;
    },

    onMouseUp(_ctx: ToolEventContext, _state: ToolInteractionState): Partial<ToolInteractionState> | void {
      return { shapeDragState: null };
    },
  };
}

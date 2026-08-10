import type { ToolEventContext, ToolInteractionState, ToolHandler } from "./types";

export const TextTool: ToolHandler = {
  getCursor(_state: ToolInteractionState): string {
    return "text";
  },

  onCanvasMouseDown(ctx: ToolEventContext): Partial<ToolInteractionState> | void {
    return {
      textDragState: {
        startX: ctx.worldPoint.x,
        startY: ctx.worldPoint.y,
        currentX: ctx.worldPoint.x,
        currentY: ctx.worldPoint.y,
      },
    };
  },

  onMouseMove(ctx: ToolEventContext, state: ToolInteractionState): Partial<ToolInteractionState> | void {
    if (state.textDragState) {
      return {
        textDragState: {
          ...state.textDragState,
          currentX: ctx.worldPoint.x,
          currentY: ctx.worldPoint.y,
        },
      };
    }
    return undefined;
  },

  onMouseUp(_ctx: ToolEventContext, _state: ToolInteractionState): Partial<ToolInteractionState> | void {
    return { textDragState: null };
  },
};

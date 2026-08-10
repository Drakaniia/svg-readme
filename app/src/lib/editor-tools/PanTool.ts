import type { ToolEventContext, ToolInteractionState, ToolHandler } from "./types";

export const PanTool: ToolHandler = {
  getCursor(state: ToolInteractionState): string {
    return state.panState ? "grabbing" : "default";
  },

  onCanvasMouseDown(ctx: ToolEventContext): Partial<ToolInteractionState> | void {
    if (ctx.event.button === 1) {
      return {
        panState: {
          startX: ctx.event.clientX,
          startY: ctx.event.clientY,
          initialPanX: ctx.viewport.panX,
          initialPanY: ctx.viewport.panY,
        },
      };
    }
    return undefined;
  },

  onMouseMove(_ctx: ToolEventContext, state: ToolInteractionState): Partial<ToolInteractionState> | void {
    if (state.panState) {
      return {
        panState: state.panState,
      };
    }
    return undefined;
  },

  onMouseUp(_ctx: ToolEventContext, _state: ToolInteractionState): Partial<ToolInteractionState> | void {
    return { panState: null };
  },
};

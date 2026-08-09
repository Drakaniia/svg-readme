import type { ToolEventContext, ToolInteractionState, ToolHandler } from "./types";

/**
 * Hand tool (B6): left-drag pans the canvas — unlike the move tool, which
 * selects/drags elements. Mirrors Figma's hand tool (H). Middle-click and
 * spacebar panning from the canvas shell still work for every tool.
 */
export const HandTool: ToolHandler = {
  getCursor(state: ToolInteractionState): string {
    return state.panState ? "grabbing" : "grab";
  },

  onCanvasMouseDown(ctx: ToolEventContext): Partial<ToolInteractionState> | void {
    return {
      panState: {
        startX: ctx.event.clientX,
        startY: ctx.event.clientY,
        initialPanX: ctx.viewport.panX,
        initialPanY: ctx.viewport.panY,
      },
    };
  },

  onElementMouseDown(ctx: ToolEventContext): Partial<ToolInteractionState> | void {
    // Clicking an element with the hand tool still pans (Figma behavior).
    return {
      panState: {
        startX: ctx.event.clientX,
        startY: ctx.event.clientY,
        initialPanX: ctx.viewport.panX,
        initialPanY: ctx.viewport.panY,
      },
    };
  },

  onMouseMove(_ctx: ToolEventContext, state: ToolInteractionState): Partial<ToolInteractionState> | void {
    if (state.panState) {
      return { panState: state.panState };
    }
    return undefined;
  },

  onMouseUp(_ctx: ToolEventContext, _state: ToolInteractionState): Partial<ToolInteractionState> | void {
    return { panState: null };
  },
};

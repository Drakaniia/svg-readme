import type { ToolEventContext, ToolInteractionState, ToolHandler } from "./types";
import { mirrorPoint } from "../editor/pathUtils";
import type { PathVertexHandle } from "../editor/pathUtils";

const CLOSE_THRESHOLD = 8; // px — distance within which clicking near start closes the path
/** Drag distance (px) beyond which a click-drag places a smooth bezier handle instead of a corner. */
const HANDLE_DRAG_THRESHOLD = 4;

/**
 * PenTool: click-to-place vector path drawing (Figma-style).
 *
 * Click to place anchor points; each click adds a vertex and connects it to the
 * previous one. Click-DRAG to pull out a bezier handle: the drag becomes the
 * incoming tangent of the new anchor (mirrored outgoing for a smooth point).
 * The first anchor's drag sets the outgoing tangent of the start.
 *
 * Close path: click near the start point, double-click the canvas, or press C.
 * Cancel path: press Escape.
 * Finalize open path: press Enter or switch tools.
 */
export const PenTool: ToolHandler = {
  getCursor(_state: ToolInteractionState): string {
    return "crosshair";
  },

  onCanvasMouseDown(_ctx: ToolEventContext): Partial<ToolInteractionState> | void {
    // Actual click-to-place logic is handled in Canvas.tsx handleMouseDown
    // because it needs access to the current pathDragState.
    return undefined;
  },

  onMouseMove(ctx: ToolEventContext, state: ToolInteractionState): Partial<ToolInteractionState> | void {
    // If building a path, update the preview point (and the pending handle pull)
    if (state.pathDragState?.isBuilding) {
      const point: [number, number] = [ctx.worldPoint.x, ctx.worldPoint.y];
      const next = updatePendingHandle(state, point);
      return next.pathDragState
        ? next
        : { pathDragState: { ...state.pathDragState, previewPoint: point } };
    }
    return undefined;
  },

  onMouseUp(_ctx: ToolEventContext, _state: ToolInteractionState): Partial<ToolInteractionState> | void {
    // In click-to-place mode, mouseup does NOT finalize — keep building.
    // The path is finalized by closing (click near start), Enter, or Escape.
    return undefined;
  },
};

/**
 * Start a new path with the first anchor point.
 * Called from Canvas when pen tool is active and canvas is clicked while
 * no path is being built.
 */
export function startPathFromPoint(x: number, y: number): Partial<ToolInteractionState> {
  return {
    pathDragState: {
      points: [[x, y]],
      previewPoint: [x, y],
      isBuilding: true,
      closed: false,
    },
  };
}

/**
 * Begin a bezier-handle pull on the vertex just placed (click-drag placement).
 * Called from Canvas on pen mousedown after a vertex was added.
 */
export function beginPendingHandle(
  state: Pick<ToolInteractionState, "pathDragState">,
  vertexIndex: number,
  point: [number, number],
): Partial<ToolInteractionState> {
  const ps = state.pathDragState;
  if (!ps || !ps.isBuilding) return {};
  return {
    pathDragState: {
      ...ps,
      pendingHandleVertex: vertexIndex,
      pendingHandlePoint: point,
      pendingHandleMoved: false,
    },
  };
}

/**
 * Track the handle pull while the mouse button is held.
 * Marks the pull as a curve once it exceeds the drag threshold.
 */
export function updatePendingHandle(
  state: Pick<ToolInteractionState, "pathDragState">,
  point: [number, number],
): Partial<ToolInteractionState> {
  const ps = state.pathDragState;
  if (!ps || !ps.isBuilding) return {};
  if (ps.pendingHandleVertex == null) {
    // No pending pull — just move the rubber-band preview.
    return { pathDragState: { ...ps, previewPoint: point } };
  }
  const anchor = ps.points[ps.pendingHandleVertex];
  const moved =
    Math.hypot(point[0] - anchor[0], point[1] - anchor[1]) >= HANDLE_DRAG_THRESHOLD;
  return {
    pathDragState: {
      ...ps,
      previewPoint: point,
      pendingHandlePoint: point,
      pendingHandleMoved: ps.pendingHandleMoved || moved,
    },
  };
}

/**
 * Build the effective handles that should be used for preview rendering while a
 * handle drag is in progress. When the pending pull has moved past the threshold,
 * it is merged as if it were committed, so the curve A→B is visible LIVE while
 * dragging the handle of B (Figment/Illustrator behavior). Returns a new array
 * or the original handles if no pending handle should be shown.
 */
export function getEffectiveHandles(
  ps: NonNullable<ToolInteractionState["pathDragState"]>,
): PathVertexHandle[] | undefined {
  if (ps.pendingHandleVertex == null || !ps.pendingHandleMoved || !ps.pendingHandlePoint) {
    return ps.handles as PathVertexHandle[] | undefined;
  }
  const index = ps.pendingHandleVertex;
  const anchor = ps.points[index];
  const point = ps.pendingHandlePoint;
  const handles: (PathVertexHandle | undefined)[] = ps.handles
    ? ps.handles.map((h) => (h ? { ...h } : undefined))
    : (new Array(ps.points.length).fill(undefined) as PathVertexHandle[]);
  const current = handles[index] ?? {};
  if (index === 0) {
    handles[index] = { ...current, out: point, smooth: false };
  } else {
    const inn = point;
    handles[index] = { ...current, in: inn, out: mirrorPoint(inn, anchor), smooth: true };
  }
  return handles as PathVertexHandle[];
}

/** Alias kept for test compatibility — returns effective handles for a path state. */
export function getEffectiveHandlesForPreview(
  ps: NonNullable<ToolInteractionState["pathDragState"]>,
): PathVertexHandle[] | undefined {
  return getEffectiveHandles(ps);
}

/**
 * Finalize the pending handle pull on mouseup.
 *
 * First anchor (index 0): the pull becomes the outgoing tangent (curves the
 * segment into the next anchor). Later anchors: the pull becomes the incoming
 * tangent and, when dragged past the threshold, a mirrored outgoing handle
 * makes the vertex smooth (Figma-style). A click without drag leaves a corner.
 */
export function commitPendingHandle(
  state: Pick<ToolInteractionState, "pathDragState">,
): Partial<ToolInteractionState> {
  const ps = state.pathDragState;
  if (!ps || ps.pendingHandleVertex == null) return {};

  let handles = ps.handles;
  if (ps.pendingHandleMoved && ps.pendingHandlePoint) {
    const index = ps.pendingHandleVertex;
    const anchor = ps.points[index];
    const point = ps.pendingHandlePoint;
    handles = ps.handles
      ? ps.handles.map((h) => (h ? { ...h } : undefined))
      : (new Array(ps.points.length).fill(undefined) as PathVertexHandle[]);

    const current = handles[index] ?? {};
    if (index === 0) {
      // First anchor: pull defines the outgoing tangent only.
      handles[index] = { ...current, out: point, smooth: false };
    } else {
      const inn = point;
      handles[index] = { ...current, in: inn, out: mirrorPoint(inn, anchor), smooth: true };
    }
  }

  // After committing, the rubber-band preview should start from the anchor
  // itself, not from the handle tip, otherwise the dashed line appears as an
  // extension of the handle until the next mousemove.
  const committedIndex = ps.pendingHandleVertex;
  const anchor = ps.points[committedIndex];
  return {
    pathDragState: {
      ...ps,
      handles,
      previewPoint: anchor ? ([anchor[0], anchor[1]] as [number, number]) : ps.previewPoint,
      pendingHandleVertex: undefined,
      pendingHandlePoint: undefined,
      pendingHandleMoved: false,
    },
  };
}

/**
 * Close the current path from a double-click (or the C key) — closes from
 * anywhere on the canvas, not just near the start point.
 */
export function closePathFromDoubleClick(
  state: ToolInteractionState,
): Partial<ToolInteractionState> {
  const ps = state.pathDragState;
  if (!ps || !ps.isBuilding || ps.points.length < 3) return {};
  return {
    pathDragState: {
      ...ps,
      closed: true,
      isBuilding: false, // signal finalization
      previewPoint: null,
      pendingHandleVertex: undefined,
      pendingHandlePoint: undefined,
      pendingHandleMoved: false,
    },
  };
}

/**
 * Add a vertex to the current path.
 * Returns the updated state. If the click is near the start point (within
 * CLOSE_THRESHOLD px) and we have at least 3 points, the path is closed
 * and finalized.
 */
export function addOrCloseVertex(
  state: ToolInteractionState,
  x: number,
  y: number,
): Partial<ToolInteractionState> {
  const ps = state.pathDragState;
  if (!ps || !ps.isBuilding) return {};

  const start = ps.points[0];
  const distToStart = Math.hypot(x - start[0], y - start[1]);

  // Close path: click near start with >= 2 points
  if (ps.points.length >= 2 && distToStart <= CLOSE_THRESHOLD) {
    return {
      pathDragState: {
        ...ps,
        closed: true,
        isBuilding: false, // signal finalization
        previewPoint: null,
        pendingHandleVertex: undefined,
        pendingHandlePoint: undefined,
        pendingHandleMoved: false,
      },
    };
  }

  // Add another vertex
  return {
    pathDragState: {
      ...ps,
      points: [...ps.points, [x, y]],
      previewPoint: [x, y],
    },
  };
}

/**
 * Finalize the current path as an open (non-closed) polyline.
 */
export function finalizePathOpen(
  state: ToolInteractionState,
): Partial<ToolInteractionState> {
  const ps = state.pathDragState;
  if (!ps || !ps.isBuilding) return {};
  return {
    pathDragState: {
      ...ps,
      isBuilding: false,
      previewPoint: null,
      pendingHandleVertex: undefined,
      pendingHandlePoint: undefined,
      pendingHandleMoved: false,
    },
  };
}

/**
 * Cancel the current path build (discard points).
 */
export function cancelPath(
  _state: ToolInteractionState,
): Partial<ToolInteractionState> {
  return {
    pathDragState: null,
  };
}

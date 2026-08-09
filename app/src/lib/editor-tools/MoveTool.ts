import { getElementBoundingBox } from "../../components/editor-canvas/ElementsRenderer";
import { snapPosition } from "../editor/geometry";
import type { ToolEventContext, ToolInteractionState, ToolHandler } from "./types";

export const MoveTool: ToolHandler = {
  getCursor(state: ToolInteractionState): string {
    if (state.dragState) return "grabbing";
    return "default";
  },

  showResizeOverlay: true,

  // ── Canvas mousedown (empty area) → start rubber-band ──────────────────
  onCanvasMouseDown(ctx: ToolEventContext): Partial<ToolInteractionState> | void {
    return {
      rubberBandState: {
        startX: ctx.worldPoint.x,
        startY: ctx.worldPoint.y,
        currentX: ctx.worldPoint.x,
        currentY: ctx.worldPoint.y,
        addToExisting: ctx.shiftKey,
      },
      rubberBandHighlightedIds: [],
    };
  },

  // ── Element mousedown → select + start drag ────────────────────────────
  onElementMouseDown(ctx: ToolEventContext, layerId: string): Partial<ToolInteractionState> | void {
    const props = ctx.elementProperties[layerId];
    if (!props) return undefined;

    const allSelectedIds: string[] = [];
    if (
      ctx.selectedLayerIds &&
      ctx.selectedLayerIds.length > 1 &&
      ctx.selectedLayerIds.includes(layerId)
    ) {
      allSelectedIds.push(...ctx.selectedLayerIds);
    }

    const multiStartPositions: Record<string, { x: number; y: number }> | undefined =
      allSelectedIds.length > 1
        ? Object.fromEntries(
            allSelectedIds
              .filter((id) => ctx.elementProperties[id])
              .map((id) => [
                id,
                {
                  x: ctx.elementProperties[id].x,
                  y: ctx.elementProperties[id].y,
                },
              ]),
          )
        : undefined;

    return {
      dragState: {
        elementId: layerId,
        startX: ctx.worldPoint.x,
        startY: ctx.worldPoint.y,
        offsetX: ctx.worldPoint.x - props.x,
        offsetY: ctx.worldPoint.y - props.y,
        multiStartPositions,
      },
    };
  },

  // ── Mouse move ─────────────────────────────────────────────────────────
  onMouseMove(ctx: ToolEventContext, state: ToolInteractionState): Partial<ToolInteractionState> | void {
    // Rubber-band update
    if (state.rubberBandState) {
      return {
        rubberBandState: {
          ...state.rubberBandState,
          currentX: ctx.worldPoint.x,
          currentY: ctx.worldPoint.y,
        },
      };
    }

    // Element drag
    if (state.dragState) {
      if (state.dragState.multiStartPositions) {
        // Multi-drag handled externally by Canvas via onMoveElement; no state change here
        return undefined;
      }
      // Single drag: let Canvas compute position from offsetX/offsetY
      return undefined;
    }

    return undefined;
  },

  // ── Mouse up ───────────────────────────────────────────────────────────
  onMouseUp(_ctx: ToolEventContext, state: ToolInteractionState): Partial<ToolInteractionState> | void {
    // End rubber-band
    if (state.rubberBandState) {
      return {
        rubberBandState: null,
        rubberBandHighlightedIds: [],
      };
    }

    // End element drag
    if (state.dragState) {
      return {
        dragState: null,
      };
    }

    return undefined;
  },
};

/**
 * Compute the set of layer IDs that intersect the rubber-band rectangle.
 * Pure utility used by Canvas to update highlighted IDs during rubber-band drag.
 */
export function computeRubberBandIntersections(
  rubberBandState: NonNullable<ToolInteractionState["rubberBandState"]>,
  elementProperties: Record<string, import("../../components/editor-canvas/ElementsRenderer").ElementProperties>,
  visibleLayerIds: string[],
): string[] {
  const rx = Math.min(rubberBandState.startX, rubberBandState.currentX);
  const ry = Math.min(rubberBandState.startY, rubberBandState.currentY);
  const rw = Math.abs(rubberBandState.currentX - rubberBandState.startX);
  const rh = Math.abs(rubberBandState.currentY - rubberBandState.startY);

  if (rw < 3 && rh < 3) return [];

  const intersecting: string[] = [];
  for (const id of visibleLayerIds) {
    const props = elementProperties[id];
    if (!props) continue;

    const bb = getElementBoundingBox(props);
    if (
      bb.x < rx + rw &&
      bb.x + bb.width > rx &&
      bb.y < ry + rh &&
      bb.y + bb.height > ry
    ) {
      intersecting.push(id);
    }
  }
  return intersecting;
}

/**
 * Compute the next position for a single element being dragged.
 */
export function computeDragPosition(
  dragState: NonNullable<ToolInteractionState["dragState"]>,
  worldPoint: { x: number; y: number },
  snapEnabled: boolean,
  gridSize: number,
): { x: number; y: number } {
  const nextPosition = snapEnabled
    ? snapPosition(
        { x: worldPoint.x - dragState.offsetX, y: worldPoint.y - dragState.offsetY },
        { gridSize },
      )
    : { x: worldPoint.x - dragState.offsetX, y: worldPoint.y - dragState.offsetY };
  return nextPosition;
}

/**
 * Compute the deltas for a multi-element drag with snapping.
 */
export function computeMultiDragDeltas(
  dragState: NonNullable<ToolInteractionState["dragState"]>,
  worldPoint: { x: number; y: number },
  snapEnabled: boolean,
  gridSize: number,
): { dx: number; dy: number; snapDelta: { x: number; y: number } } {
  const dx = worldPoint.x - dragState.startX;
  const dy = worldPoint.y - dragState.startY;

  const entries = Object.entries(dragState.multiStartPositions!);
  if (entries.length === 0) return { dx, dy, snapDelta: { x: 0, y: 0 } };

  const [, anchorPosition] = entries[0];
  const anchorTarget = { x: anchorPosition.x + dx, y: anchorPosition.y + dy };
  const snappedAnchor = snapEnabled
    ? snapPosition(anchorTarget, { gridSize })
    : anchorTarget;

  return {
    dx,
    dy,
    snapDelta: {
      x: snappedAnchor.x - anchorTarget.x,
      y: snappedAnchor.y - anchorTarget.y,
    },
  };
}

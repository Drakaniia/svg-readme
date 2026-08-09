import { MIN_SHAPE_SIZE } from "../../components/editor-canvas/types";
import type { ElementProperties } from "../../components/editor-canvas/ElementsRenderer";
import type { ResizeState } from "../../components/editor-canvas/types";
import type { ToolEventContext, ToolInteractionState } from "./types";

export type ResizeHandle = ResizeState["handle"];

/**
 * Whether a given element supports resize interactions.
 */
export function canResize(props: ElementProperties | null): boolean {
  if (!props) return false;
  return props.type === "shape" || props.type === "image" || props.type === "path";
}

/**
 * Start a resize interaction.
 */
export function startResize(
  ctx: ToolEventContext,
  elementId: string,
  handle: ResizeHandle,
): Partial<ToolInteractionState> {
  const props = ctx.selectedProps;
  if (!props || !canResize(props)) return {};

  return {
    resizeState: {
      elementId,
      handle,
      startX: ctx.worldPoint.x,
      startY: ctx.worldPoint.y,
      initialX: props.x,
      initialY: props.y,
      initialWidth: typeof props.width === "number" ? props.width : 0,
      initialHeight: typeof props.height === "number" ? props.height : 0,
    },
  };
}

/**
 * Compute new position and dimensions during resize drag.
 * When shiftKey is true, the aspect ratio is constrained proportionally
 * based on the dominant axis of the resize handle.
 * When altKey is true, the resize happens from the element's center — the
 * opposite edge is fixed and the box is re-centered on its original center
 * (B3). Shift+Alt keeps the aspect ratio while re-centering.
 */
export function updateResize(
  state: NonNullable<ToolInteractionState["resizeState"]>,
  dx: number,
  dy: number,
  shiftKey = false,
  altKey = false,
): { x: number; y: number; width: number; height: number } {
  const {
    handle,
    initialX,
    initialY,
    initialWidth,
    initialHeight,
  } = state;

  const minW = MIN_SHAPE_SIZE;
  const minH = MIN_SHAPE_SIZE;
  const aspectRatio = initialWidth / initialHeight;

  let newX = initialX;
  let newY = initialY;
  let newWidth = initialWidth;
  let newHeight = initialHeight;

  switch (handle) {
    case "br":
      newWidth = Math.max(initialWidth + dx, minW);
      newHeight = Math.max(initialHeight + dy, minH);
      break;
    case "mr":
      newWidth = Math.max(initialWidth + dx, minW);
      if (shiftKey) newHeight = Math.max(newWidth / aspectRatio, minH);
      break;
    case "bc":
      newHeight = Math.max(initialHeight + dy, minH);
      if (shiftKey) newWidth = Math.max(newHeight * aspectRatio, minW);
      break;
    case "tl":
      newWidth = Math.max(initialWidth - dx, minW);
      newHeight = Math.max(initialHeight - dy, minH);
      newX = initialX + (initialWidth - newWidth);
      newY = initialY + (initialHeight - newHeight);
      break;
    case "ml":
      newWidth = Math.max(initialWidth - dx, minW);
      newX = initialX + (initialWidth - newWidth);
      if (shiftKey) newHeight = Math.max(newWidth / aspectRatio, minH);
      break;
    case "tc":
      newHeight = Math.max(initialHeight - dy, minH);
      newY = initialY + (initialHeight - newHeight);
      if (shiftKey) newWidth = Math.max(newHeight * aspectRatio, minW);
      break;
    case "tr":
      newWidth = Math.max(initialWidth + dx, minW);
      newHeight = Math.max(initialHeight - dy, minH);
      newY = initialY + (initialHeight - newHeight);
      break;
    case "bl":
      newWidth = Math.max(initialWidth - dx, minW);
      newHeight = Math.max(initialHeight + dy, minH);
      newX = initialX + (initialWidth - newWidth);
      break;
  }

  // Apply shift constraint for corner handles: lock aspect ratio
  if (shiftKey && (handle === "br" || handle === "tl" || handle === "tr" || handle === "bl")) {
    // Use the larger dimension change to determine the constrained size
    const widthChange = Math.abs(newWidth - initialWidth);
    const heightChange = Math.abs(newHeight - initialHeight);

    if (widthChange >= heightChange) {
      newHeight = newWidth / aspectRatio;
    } else {
      newWidth = newHeight * aspectRatio;
    }

    // Recompute position for left/top handles after aspect-ratio fix
    if (handle === "tl" || handle === "tr" || handle === "bl") {
      if (handle === "tl") {
        newX = initialX + initialWidth - newWidth;
        newY = initialY + initialHeight - newHeight;
      } else if (handle === "tr") {
        newY = initialY + initialHeight - newHeight;
      } else if (handle === "bl") {
        newX = initialX + initialWidth - newWidth;
      }
    }

    // Enforce minimums
    newWidth = Math.max(newWidth, minW);
    newHeight = Math.max(newHeight, minH);
  }

  // Alt: resize from the center — keep the box's center fixed by re-centering
  // the computed box on the original center point.
  if (altKey) {
    const centerX = initialX + initialWidth / 2;
    const centerY = initialY + initialHeight / 2;
    newX = centerX - newWidth / 2;
    newY = centerY - newHeight / 2;
  }

  return { x: newX, y: newY, width: newWidth, height: newHeight };
}

export function getResizeCursor(state: ToolInteractionState): string {
  if (!state.resizeState) return "default";
  const { handle } = state.resizeState;
  if (handle === "tl" || handle === "br") return "nwse-resize";
  if (handle === "tr" || handle === "bl") return "nesw-resize";
  if (handle === "tc" || handle === "bc") return "ns-resize";
  if (handle === "ml" || handle === "mr") return "ew-resize";
  return "default";
}

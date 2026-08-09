import type { ToolEventContext, ToolInteractionState } from "./types";
import { canResize } from "./ResizeHandler";

/**
 * Start a rotate interaction. Returns the rotateState and initial angle.
 */
export function startRotate(
  ctx: ToolEventContext,
  elementId: string,
): Partial<ToolInteractionState> {
  const props = ctx.selectedProps;
  if (!props || !canResize(props)) return {};

  const w = typeof props.width === "number" ? props.width : 0;
  const h = typeof props.height === "number" ? props.height : 0;
  const centerX = props.x + w / 2;
  const centerY = props.y + h / 2;
  const dx = ctx.worldPoint.x - centerX;
  const dy = ctx.worldPoint.y - centerY;
  const startAngle = Math.atan2(dy, dx) * (180 / Math.PI);

  return {
    rotateState: {
      elementId,
      centerX,
      centerY,
      startAngle,
      initialRotation: (props as { rotation?: number }).rotation ?? 0,
    },
  };
}

/**
 * Compute the new rotation angle during a rotate drag.
 * When shiftKey is true, snaps to nearest 15° increment.
 */
export function updateRotation(
  state: NonNullable<ToolInteractionState["rotateState"]>,
  worldX: number,
  worldY: number,
  shiftKey = false,
): number {
  const dx = worldX - state.centerX;
  const dy = worldY - state.centerY;
  const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);
  const angleDelta = currentAngle - state.startAngle;
  let newRotation = (state.initialRotation + angleDelta) % 360;
  if (newRotation < 0) newRotation += 360;

  // Shift: snap to nearest 15° increment
  if (shiftKey) {
    newRotation = Math.round(newRotation / 15) * 15;
  }

  return newRotation;
}

/**
 * Angle delta (degrees) between the drag start and the current pointer,
 * used to apply the same rotation increment to every element of a
 * multi-selection (B3).
 */
export function computeRotationDelta(
  state: NonNullable<ToolInteractionState["rotateState"]>,
  worldX: number,
  worldY: number,
): number {
  const dx = worldX - state.centerX;
  const dy = worldY - state.centerY;
  const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);
  return currentAngle - state.startAngle;
}

export function getRotateCursor(state: ToolInteractionState): string {
  return state.rotateState ? "grabbing" : "grab";
}

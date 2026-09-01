import { useCallback } from "react";
import { canResize, startResize } from "../../../lib/editor-tools/ResizeHandler";
import { startRotate } from "../../../lib/editor-tools/RotateHandler";
import { getSelectionBounds } from "../../../lib/editor/geometry";
import { getElementBoundingBox } from "../ElementsRenderer";
import type { ElementProperties } from "../ElementsRenderer";
import { mergeState } from "./helpers";

// ─── Types ────────────────────────────────────────────────────────────────────

type ToolInteractionState = ReturnType<typeof import("../../../lib/editor-tools/types").defaultToolState>;

interface UseCanvasResizeRotateParams {
  activeTool: string;
  selectedId: string | null;
  selectedProps: ElementProperties | null;
  selectedLayerIds: string[];
  elementProperties: Record<string, ElementProperties>;
  isEditingText: boolean;
  onCommitText?: () => void;
  onResizeStart?: () => void;
  onRotateStart?: () => void;
  buildContext: (e: React.MouseEvent) => unknown;
  setState: React.Dispatch<React.SetStateAction<ToolInteractionState>>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Provides resize and rotate mouse-down handlers for the Canvas overlay.
 * Handles both single-element and multi-selection (B3) resize/rotate.
 */
export function useCanvasResizeRotate({
  selectedId,
  selectedProps,
  selectedLayerIds,
  elementProperties,
  isEditingText,
  onCommitText,
  onResizeStart,
  onRotateStart,
  buildContext,
  setState,
}: UseCanvasResizeRotateParams) {
  // Multi-select resize: the whole selection is resized as a unit when
  // every selected element is resizable (shapes / images / paths).
  const multiResizable =
    selectedLayerIds.length > 1 &&
    selectedLayerIds.every((id) => canResize(elementProperties[id] ?? null));
  const multiBounds = multiResizable
    ? getSelectionBounds(
        selectedLayerIds
          .map((id) => {
            const props = elementProperties[id];
            return props
              ? { id, x: props.x, y: props.y, bounds: getElementBoundingBox(props) }
              : null;
          })
          .filter((item): item is NonNullable<typeof item> => item !== null),
      )
    : null;

  const handleResizeMouseDown = useCallback(
    (
      e: React.MouseEvent,
      handle: "tl" | "tc" | "tr" | "ml" | "mr" | "bl" | "bc" | "br",
    ) => {
      e.stopPropagation();
      if (isEditingText) onCommitText?.();
      onResizeStart?.();
      const ctx = buildContext(e) as { worldPoint: { x: number; y: number } };

      if (multiResizable && multiBounds) {
        const initialBoxes: Record<string, { x: number; y: number; width: number; height: number }> = {};
        for (const id of selectedLayerIds) {
          const props = elementProperties[id];
          if (!props) continue;
          initialBoxes[id] = { x: props.x, y: props.y, width: typeof props.width === "number" ? props.width : 0, height: props.height };
        }
        setState((prev) => ({
          ...prev,
          ...mergeState({
            resizeState: {
              elementId: "__selection__",
              handle,
              startX: ctx.worldPoint.x,
              startY: ctx.worldPoint.y,
              initialX: multiBounds.x,
              initialY: multiBounds.y,
              initialWidth: multiBounds.width,
              initialHeight: multiBounds.height,
              selectionIds: selectedLayerIds,
              initialBoxes,
              initialSelectionBounds: multiBounds,
            },
          }),
        }));
        return;
      }

      if (!(selectedId && canResize(selectedProps))) return;
      setState((prev) => ({ ...prev, ...mergeState(startResize(ctx as never, selectedId, handle)) }));
    },
    [selectedId, selectedProps, selectedLayerIds, multiResizable, multiBounds, elementProperties, isEditingText, onCommitText, onResizeStart, buildContext, setState],
  );

  const handleRotateMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isEditingText) onCommitText?.();
      onRotateStart?.();
      const ctx = buildContext(e) as { worldPoint: { x: number; y: number } };

      if (multiResizable && multiBounds) {
        const initialRotations: Record<string, number> = {};
        for (const id of selectedLayerIds) {
          const props = elementProperties[id];
          initialRotations[id] =
            (props && "rotation" in props && typeof props.rotation === "number" ? props.rotation : 0) ?? 0;
        }
        const cx = multiBounds.x + multiBounds.width / 2;
        const cy = multiBounds.y + multiBounds.height / 2;
        const dx = ctx.worldPoint.x - cx;
        const dy = ctx.worldPoint.y - cy;
        const startAngle = Math.atan2(dy, dx) * (180 / Math.PI);
        setState((prev) => ({
          ...prev,
          ...mergeState({
            rotateState: {
              elementId: "__selection__",
              centerX: cx,
              centerY: cy,
              startAngle,
              initialRotation: 0,
              selectionIds: selectedLayerIds,
              initialRotations,
            },
          }),
        }));
        return;
      }

      if (!(selectedId && canResize(selectedProps))) return;
      setState((prev) => ({ ...prev, ...mergeState(startRotate(ctx as never, selectedId)) }));
    },
    [selectedId, selectedProps, selectedLayerIds, multiResizable, multiBounds, elementProperties, isEditingText, onCommitText, onRotateStart, buildContext, setState],
  );

  return {
    handleResizeMouseDown,
    handleRotateMouseDown,
    multiBounds,
  };
}

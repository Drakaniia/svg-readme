import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  MIN_TEXTBOX_SIZE,
  MIN_SHAPE_SIZE,
  DEFAULT_TEXT_HEIGHT,
  type CanvasProps,
} from "./types";
import {
  getElementBoundingBox,
} from "./ElementsRenderer";
import {
  getToolHandler,
} from "../../lib/editor-tools/registry";
import {
  startPathFromPoint,
  addOrCloseVertex,
  beginPendingHandle,
  updatePendingHandle,
  commitPendingHandle,
  closePathFromDoubleClick,
} from "../../lib/editor-tools/PenTool";
import {
  type ToolEventContext,
  type ToolInteractionState,
} from "../../lib/editor-tools/types";
import {
  computeRubberBandIntersections,
  computeDragPosition,
  computeMultiDragDeltas,
} from "../../lib/editor-tools/MoveTool";
import {
  updateResize,
} from "../../lib/editor-tools/ResizeHandler";
import {
  updateRotation,
  computeRotationDelta,
} from "../../lib/editor-tools/RotateHandler";
import {
  startPan,
  updatePan,
  handleZoom,
} from "../../lib/editor-tools/PanZoomHandler";
import { screenToWorld, computeSnapGuides, computeResizeSnapGuides, remapBoxesThroughBounds, type SnapGuideLine } from "../../lib/editor/geometry";
import { mergeState } from "./Canvas/helpers";
import type { ElementProperties, ShapeKind } from "./ElementsRenderer";
import type { LayerType } from "../../context/EditorContext";

// ─── Hook params ──────────────────────────────────────────────────────────────

export interface UseCanvasInteractionParams {
  // Component props
  activeTool: CanvasProps["activeTool"];
  selectedShapeKind?: CanvasProps["selectedShapeKind"];
  layers: LayerType[];
  selectedLayerId: string | null;
  selectedLayerIds: string[];
  isEditingText: boolean;
  elementProperties: Record<string, ElementProperties>;
  viewport: NonNullable<CanvasProps["viewport"]>;
  snapEnabled: boolean;
  gridSize: number;

  // Callbacks
  onCommitText?: () => void;
  onViewportChange?: (viewport: NonNullable<CanvasProps["viewport"]>) => void;
  onSelectLayer: (id: string | null) => void;
  onShiftSelectLayer?: (id: string) => void;
  onClearSelection?: () => void;
  onRubberBandSelect?: (ids: string[], addToExisting: boolean) => void;
  onMoveStart?: () => void;
  onMoveElement: (id: string, x: number, y: number) => void;
  onResizeElement?: (id: string, x: number, y: number, width: number, height: number) => void;
  onRotateElement?: (id: string, rotation: number) => void;
  onCreateText: (x: number, y: number, width: number | "auto", height: number) => void;
  onCreateShape: (kind: ShapeKind, x: number, y: number, width: number, height: number) => void;
  onPaintLayer: (layerId: string, color: string) => void;
  paintColor?: string;
  onEditText: (layerId: string) => void;

  // Refs & state
  svgRef: React.RefObject<SVGSVGElement | null>;
  setState: Dispatch<SetStateAction<ToolInteractionState>>;
  /** Current pathDragState from Canvas state — used to keep keyboard/tool-switch handlers fresh. */
  pathDragState?: ToolInteractionState["pathDragState"];

  // Path finalization
  finalizePath: (ps: NonNullable<ToolInteractionState["pathDragState"]>) => void;
  /** Callback for creating a path (kept in ref for keyboard handler). */
  onCreatePath?: CanvasProps["onCreatePath"];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCanvasInteraction({
  activeTool,
  selectedShapeKind,
  layers,
  selectedLayerId,
  selectedLayerIds,
  isEditingText,
  elementProperties,
  viewport,
  snapEnabled,
  gridSize,
  onCommitText,
  onViewportChange,
  onSelectLayer,
  onShiftSelectLayer,
  onClearSelection,
  onRubberBandSelect,
  onMoveStart,
  onMoveElement,
  onResizeElement,
  onRotateElement,
  onCreateText,
  onCreateShape,
  onPaintLayer,
  paintColor,
  onEditText,
  svgRef,
  setState,
  pathDragState,
  finalizePath,
  onCreatePath,
}: UseCanvasInteractionParams) {
  const spacePressedRef = useRef(false);
  const moveHistorySavedRef = useRef(false);
  const lastPenClickRef = useRef<{ t: number; x: number; y: number } | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  // Path state refs for pen tool keyboard shortcuts — kept in sync from props (fixes stale-ref bug
  // where Esc/Enter/C and tool-switch finalize never fired, leaving dashed line following cursor).
  const pathBuildingRef = useRef(false);
  const pathStateRef = useRef<ToolInteractionState["pathDragState"]>(null);
  const onCreatePathRef = useRef<CanvasProps["onCreatePath"]>(() => {});
  useEffect(() => {
    pathBuildingRef.current = pathDragState?.isBuilding ?? false;
  }, [pathDragState?.isBuilding]);
  useEffect(() => {
    pathStateRef.current = pathDragState ?? null;
  }, [pathDragState]);
  useEffect(() => {
    if (onCreatePath) onCreatePathRef.current = onCreatePath;
  }, [onCreatePath]);

  // ── Spacebar detection ────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) spacePressedRef.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") spacePressedRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // ── Pen tool: Enter/Escape to finalize/cancel path ──────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (activeTool !== "pen" || !pathBuildingRef.current) return;
      if (e.key === "Enter") {
        e.preventDefault();
        let ps = pathStateRef.current;
        if (!ps?.isBuilding || ps.points.length < 2) return;
        if (ps.pendingHandleVertex != null) {
          const committed = commitPendingHandle({ pathDragState: ps });
          if (committed.pathDragState) ps = committed.pathDragState;
        }
        finalizePath(ps);
      } else if (e.key === "Escape") {
        e.preventDefault();
        // Exit should KEEP what's been drawn (finalize open path if >=2 points),
        // not discard everything. Single-point exit just cancels.
        let ps = pathStateRef.current;
        if (!ps?.isBuilding) {
          setState((prev) => ({ ...prev, pathDragState: null }));
          return;
        }
        if (ps.pendingHandleVertex != null) {
          const committed = commitPendingHandle({ pathDragState: ps });
          if (committed.pathDragState) ps = committed.pathDragState;
        }
        if (ps.points.length >= 2) {
          finalizePath(ps);
        } else {
          setState((prev) => ({ ...prev, pathDragState: null }));
        }
      } else if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        const ps = pathStateRef.current;
        if (ps?.isBuilding && ps.points.length >= 3) {
          const next = closePathFromDoubleClick({ pathDragState: ps } as ToolInteractionState);
          if (next.pathDragState) {
            finalizePath(next.pathDragState);
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTool, finalizePath, setState]);

  // ── Tab cycles overlapping layers at the pointer (B4) ───────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || activeTool !== "move") return;
      const point = lastPointerRef.current;
      if (!point) return;
      const candidates = layers
        .filter((l) => l.visible && elementProperties[l.id])
        .filter((l) => {
          const bb = getElementBoundingBox(elementProperties[l.id]);
          return (
            point.x >= bb.x &&
            point.x <= bb.x + bb.width &&
            point.y >= bb.y &&
            point.y <= bb.y + bb.height
          );
        })
        .reverse()
        .map((l) => l.id);
      if (candidates.length === 0) return;
      e.preventDefault();
      const currentIdx =
        selectedLayerIds.length === 1
          ? candidates.indexOf(selectedLayerIds[0])
          : -1;
      const next = candidates[(currentIdx + 1) % candidates.length];
      onSelectLayer(next);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTool, layers, elementProperties, selectedLayerIds, onSelectLayer]);

  // ── Derived selection ────────────────────────────────────────────────────
  const selectedId =
    selectedLayerIds && selectedLayerIds.length > 0
      ? selectedLayerIds.length === 1
        ? selectedLayerIds[0]
        : null
      : selectedLayerId || null;
  const selectedProps = selectedId ? elementProperties[selectedId] : null;

  const visibleLayerIds = layers
    .filter((layer) => layer.visible && elementProperties[layer.id])
    .map((layer) => layer.id);

  // ── Get SVG coords ───────────────────────────────────────────────────────
  const getSVGCoords = useCallback(
    (e: React.MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return { x: e.clientX, y: e.clientY };
      const rect = svg.getBoundingClientRect();
      return screenToWorld(
        { x: e.clientX - rect.left, y: e.clientY - rect.top },
        { ...viewport, panX: 0, panY: 0 },
      );
    },
    [viewport, svgRef],
  );

  // ── Build tool event context ─────────────────────────────────────────────
  const buildContext = useCallback(
    (e: React.MouseEvent): ToolEventContext => ({
      event: e,
      worldPoint: getSVGCoords(e),
      screenPoint: { x: e.clientX, y: e.clientY },
      selectedId,
      selectedLayerIds,
      selectedProps,
      elementProperties,
      isEditingText,
      viewport,
      snapEnabled,
      gridSize,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
    }),
    [
      getSVGCoords,
      selectedId,
      selectedLayerIds,
      selectedProps,
      elementProperties,
      isEditingText,
      viewport,
      snapEnabled,
      gridSize,
    ],
  );

  // ── Canvas mouse down ────────────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, _state: ToolInteractionState) => {
      e.preventDefault();

      if (e.button === 1 || spacePressedRef.current) {
        setState((prev) => ({ ...prev, ...startPan(e, viewport) }));
        return;
      }

      if (isEditingText) onCommitText?.();

      if (activeTool === "pen") {
        const ctx = buildContext(e);
        const { x, y } = ctx.worldPoint;
        const now = Date.now();
        const last = lastPenClickRef.current;
        const isDoubleClick =
          !!last &&
          now - last.t < 350 &&
          Math.hypot(x - last.x, y - last.y) < 10;
        lastPenClickRef.current = { t: now, x, y };

        setState((prev) => {
          if (!prev.pathDragState?.isBuilding) {
            const started = { ...prev, ...mergeState(startPathFromPoint(x, y)) };
            return {
              ...started,
              ...mergeState(beginPendingHandle(started, 0, [x, y])),
            };
          }
          if (isDoubleClick) return prev;
          const nextState = { ...prev, ...mergeState(addOrCloseVertex(prev, x, y)) };
          if (nextState.pathDragState?.isBuilding) {
            const index = nextState.pathDragState.points.length - 1;
            return {
              ...nextState,
              ...mergeState(beginPendingHandle(nextState, index, [x, y])),
            };
          }
          return nextState;
        });
        return;
      }

      const ctx = buildContext(e);
      const tool = getToolHandler(activeTool, selectedShapeKind);
      const next = tool.onCanvasMouseDown?.(ctx);
      if (next) setState((prev) => ({ ...prev, ...mergeState(next) }));
    },
    [activeTool, selectedShapeKind, isEditingText, buildContext, onCommitText, viewport, setState],
  );

  // ── Element mouse down ───────────────────────────────────────────────────
  const handleElementMouseDown = useCallback(
    (e: React.MouseEvent, layerId: string, _state: ToolInteractionState) => {
      e.stopPropagation();
      if (isEditingText) onCommitText?.();

      if (activeTool === "move") {
        if (e.altKey) {
          const layer = layers.find((l) => l.id === layerId);
          if (layer?.parentId) {
            onSelectLayer(layer.parentId);
            return;
          }
        }
        if (e.shiftKey) {
          onShiftSelectLayer?.(layerId);
          return;
        } else {
          onSelectLayer(layerId);
        }
      } else if (activeTool === "text") {
        const props = elementProperties[layerId];
        if (props && props.type === "text") {
          onEditText(layerId);
          return;
        }
      } else if (activeTool === "paint") {
        const props = elementProperties[layerId];
        if (props) {
          onSelectLayer(layerId);
          onPaintLayer(layerId, paintColor ?? "#3b82f6");
        }
        return;
      }

      const ctx = buildContext(e);
      const tool = getToolHandler(activeTool, selectedShapeKind);
      const next = tool.onElementMouseDown?.(ctx, layerId);
      if (next) setState((prev) => ({ ...prev, ...mergeState(next) }));
    },
    [
      activeTool,
      selectedShapeKind,
      isEditingText,
      layers,
      elementProperties,
      onSelectLayer,
      onShiftSelectLayer,
      onEditText,
      onPaintLayer,
      paintColor,
      onCommitText,
      buildContext,
      setState,
    ],
  );

  // ── Element double click ─────────────────────────────────────────────────
  const handleElementDoubleClick = useCallback(
    (_e: React.MouseEvent, layerId: string) => {
      if (activeTool !== "move") return;
      const props = elementProperties[layerId];
      if (props && props.type === "text") {
        onEditText(layerId);
        return;
      }
      const layer = layers.find((l) => l.id === layerId);
      if (!layer) return;
      const targetId =
        layer.type === "group" ? layer.id : (layer.parentId ?? null);
      if (targetId) onSelectLayer(targetId);
    },
    [activeTool, layers, elementProperties, onEditText, onSelectLayer],
  );

  // ── Mouse move ───────────────────────────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: React.MouseEvent, state: ToolInteractionState) => {
      const ctx = buildContext(e);
      lastPointerRef.current = ctx.worldPoint;

      if (state.panState) {
        onViewportChange?.(updatePan(state.panState, e.clientX, e.clientY, viewport));
        return;
      }

      if (state.rotateState) {
        if (state.rotateState.selectionIds && state.rotateState.initialRotations) {
          const delta = computeRotationDelta(
            state.rotateState,
            ctx.worldPoint.x,
            ctx.worldPoint.y,
          );
          for (const id of state.rotateState.selectionIds) {
            const initial = state.rotateState.initialRotations[id] ?? 0;
            let next = (initial + delta) % 360;
            if (next < 0) next += 360;
            onRotateElement?.(id, next);
          }
          return;
        }
        const rotation = updateRotation(state.rotateState, ctx.worldPoint.x, ctx.worldPoint.y, ctx.shiftKey);
        onRotateElement?.(state.rotateState.elementId, rotation);
        return;
      }

      if (state.resizeState) {
        const dx = ctx.worldPoint.x - state.resizeState.startX;
        const dy = ctx.worldPoint.y - state.resizeState.startY;
        const { x, y, width, height } = updateResize(state.resizeState, dx, dy, ctx.shiftKey, ctx.altKey);
        let finalX = x, finalY = y, finalW = width, finalH = height;
        let snapGuideLines: SnapGuideLine[] = [];

        if (snapEnabled) {
          const resizedBounds = { x, y, width, height };
          const resizedId = state.resizeState.elementId;
          const siblingBounds = visibleLayerIds
            .filter((id) => id !== resizedId)
            .map((id) => {
              const props = elementProperties[id];
              return props ? getElementBoundingBox(props) : null;
            })
            .filter((bb): bb is ReturnType<typeof getElementBoundingBox> => bb !== null);
          const snap = computeResizeSnapGuides(resizedBounds, siblingBounds);
          if (snap.guides.length > 0) {
            finalX = snap.position.x;
            finalY = snap.position.y;
            finalW = Math.max(width + (snap.position.x - x), 10);
            finalH = Math.max(height + (snap.position.y - y), 10);
            snapGuideLines = snap.guides;
          }
        }

        if (state.resizeState.selectionIds && state.resizeState.initialBoxes && state.resizeState.initialSelectionBounds) {
          const mapped = remapBoxesThroughBounds(
            state.resizeState.initialBoxes,
            state.resizeState.initialSelectionBounds,
            { x: finalX, y: finalY, width: finalW, height: finalH },
          );
          for (const id of state.resizeState.selectionIds) {
            const box = mapped[id];
            if (!box) continue;
            onResizeElement?.(
              id,
              box.x,
              box.y,
              Math.max(box.width, MIN_SHAPE_SIZE),
              Math.max(box.height, MIN_SHAPE_SIZE),
            );
          }
        } else {
          onResizeElement?.(state.resizeState.elementId, finalX, finalY, finalW, finalH);
        }
        if (snapGuideLines.length !== state.snapGuideLines.length) {
          setState((prev) => ({ ...prev, snapGuideLines }));
        }
        return;
      }

      if (state.dragState) {
        if (!moveHistorySavedRef.current) {
          moveHistorySavedRef.current = true;
          onMoveStart?.();
        }
        if (state.dragState.multiStartPositions) {
          const { dx, dy, snapDelta } = computeMultiDragDeltas(
            state.dragState,
            ctx.worldPoint,
            snapEnabled,
            gridSize,
          );
          for (const [id, pos] of Object.entries(state.dragState.multiStartPositions)) {
            onMoveElement(id, pos.x + dx + snapDelta.x, pos.y + dy + snapDelta.y);
          }
        } else {
          const draggedId = state.dragState.elementId;
          const draggedProps = elementProperties[draggedId];
          const rawPos = computeDragPosition(state.dragState, ctx.worldPoint, snapEnabled, gridSize);
          let finalPos = rawPos;
          let snapGuideLines: SnapGuideLine[] = [];

          if (snapEnabled && draggedProps) {
            const draggedBounds = getElementBoundingBox({ ...draggedProps, x: rawPos.x, y: rawPos.y });
            const siblingBounds = visibleLayerIds
              .filter((id) => id !== draggedId)
              .map((id) => {
                const props = elementProperties[id];
                return props ? getElementBoundingBox(props) : null;
              })
              .filter((bb): bb is ReturnType<typeof getElementBoundingBox> => bb !== null);
            const snap = computeSnapGuides(draggedBounds, siblingBounds);
            if ((snap.position.x !== draggedBounds.x || snap.position.y !== draggedBounds.y) && snap.guides.length > 0) {
              finalPos = { x: snap.position.x, y: snap.position.y };
              snapGuideLines = snap.guides;
            }
          }

          onMoveElement(draggedId, finalPos.x, finalPos.y);
          if (snapGuideLines.length !== state.snapGuideLines.length) {
            setState((prev) => ({ ...prev, snapGuideLines }));
          }
        }
        return;
      }

      if (state.rubberBandState) {
        const newBand = {
          ...state.rubberBandState,
          currentX: ctx.worldPoint.x,
          currentY: ctx.worldPoint.y,
        };
        setState((prev) => ({
          ...prev,
          rubberBandState: newBand,
          rubberBandHighlightedIds: computeRubberBandIntersections(newBand, elementProperties, visibleLayerIds),
        }));
        return;
      }

      if (state.pathDragState?.isBuilding) {
        const point: [number, number] = [ctx.worldPoint.x, ctx.worldPoint.y];
        const next = updatePendingHandle(state, point);
        if (next.pathDragState) {
          setState((prev) => ({ ...prev, ...mergeState(next) }));
        }
        return;
      }

      const tool = getToolHandler(activeTool, selectedShapeKind);
      const next = tool.onMouseMove?.(ctx, state);
      if (next) setState((prev) => ({ ...prev, ...mergeState(next) }));
    },
    [
      activeTool,
      selectedShapeKind,
      viewport,
      buildContext,
      onViewportChange,
      onRotateElement,
      onResizeElement,
      onMoveStart,
      onMoveElement,
      elementProperties,
      visibleLayerIds,
      snapEnabled,
      gridSize,
      setState,
    ],
  );

  // ── Mouse up ─────────────────────────────────────────────────────────────
  const handleMouseUp = useCallback(
    (state: ToolInteractionState) => {
      if (state.panState) {
        setState((prev) => ({ ...prev, panState: null }));
        return;
      }
      if (state.rotateState) {
        setState((prev) => ({ ...prev, rotateState: null }));
        return;
      }
      if (state.resizeState) {
        setState((prev) => ({ ...prev, resizeState: null, snapGuideLines: [] }));
        return;
      }
      if (state.dragState) {
        moveHistorySavedRef.current = false;
        setState((prev) => ({
          ...prev,
          dragState: null,
          snapGuideLines: [],
        }));
        return;
      }
      if (state.rubberBandState) {
        const dx = state.rubberBandState.currentX - state.rubberBandState.startX;
        const dy = state.rubberBandState.currentY - state.rubberBandState.startY;

        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
          if (!state.rubberBandState.addToExisting) {
            if (onClearSelection) onClearSelection();
            else onSelectLayer(null);
          }
        } else {
          const intersecting = computeRubberBandIntersections(
            state.rubberBandState,
            elementProperties,
            visibleLayerIds,
          );
          onRubberBandSelect?.(intersecting, state.rubberBandState.addToExisting);
        }

        setState((prev) => ({
          ...prev,
          rubberBandState: null,
          rubberBandHighlightedIds: [],
        }));
        return;
      }
      if (state.textDragState) {
        const { startX, startY, currentX, currentY } = state.textDragState;
        const dx = currentX - startX;
        const dy = currentY - startY;

        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
          onCreateText(startX, startY, "auto", DEFAULT_TEXT_HEIGHT);
        } else {
          const fw = Math.max(Math.abs(dx), MIN_TEXTBOX_SIZE);
          const fh = Math.max(Math.abs(dy), MIN_TEXTBOX_SIZE);
          onCreateText(Math.min(startX, currentX), Math.min(startY, currentY), fw, fh);
        }
        setState((prev) => ({ ...prev, textDragState: null }));
        return;
      }
      if (state.shapeDragState) {
        const { kind, startX, startY, currentX, currentY, shiftKey } = state.shapeDragState;
        const dx = currentX - startX;
        const dy = currentY - startY;
        const isClick = Math.abs(dx) < 3 && Math.abs(dy) < 3;
        const DS = 80;
        let fw = isClick ? DS : Math.max(Math.abs(dx), MIN_SHAPE_SIZE);
        let fh = isClick ? DS : Math.max(Math.abs(dy), MIN_SHAPE_SIZE);
        let fx = isClick ? startX - DS / 2 : Math.min(startX, currentX);
        let fy = isClick ? startY - DS / 2 : Math.min(startY, currentY);

        // Shift constraint: force 1:1 aspect ratio (perfect square / circle)
        if (!isClick && shiftKey && kind !== "line") {
          const side = Math.max(Math.abs(dx), Math.abs(dy));
          fw = side;
          fh = side;
          // Re-anchor position so the shape grows from the start point
          fx = dx >= 0 ? startX : startX - side;
          fy = dy >= 0 ? startY : startY - side;
        }

        onCreateShape(kind, fx, fy, fw, fh);
        setState((prev) => ({ ...prev, shapeDragState: null }));
        return;
      }
      if (state.pathDragState) {
        if (state.pathDragState.isBuilding) {
          if (state.pathDragState.pendingHandleVertex != null) {
            const next = commitPendingHandle(state);
            if (next.pathDragState) {
              setState((prev) => ({ ...prev, ...mergeState(next) }));
            }
          }
          return;
        }
        finalizePath(state.pathDragState);
        return;
      }
    },
    [
      onClearSelection,
      onSelectLayer,
      onRubberBandSelect,
      onCreateText,
      onCreateShape,
      finalizePath,
      elementProperties,
      visibleLayerIds,
      setState,
    ],
  );

  // ── Wheel zoom ───────────────────────────────────────────────────────────
  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      if (!onViewportChange) return;
      const svg = svgRef.current;
      if (!svg) return;
      const next = handleZoom(e, viewport, svg);
      if (next) onViewportChange(next);
    },
    [onViewportChange, viewport, svgRef],
  );

  // ── Pen tool: double-click closes path ──────────────────────────────────
  const handleDoubleClick = useCallback(
    (state: ToolInteractionState) => {
      if (activeTool === "pen" && state.pathDragState?.isBuilding) {
        const next = closePathFromDoubleClick(state);
        if (next.pathDragState) {
          finalizePath(next.pathDragState);
        }
      }
    },
    [activeTool, finalizePath],
  );

  // ── Finalize in-progress path when tool changes ──────────────────────────
  const prevActiveToolRef = useRef(activeTool);
  useEffect(() => {
    const prev = prevActiveToolRef.current;
    prevActiveToolRef.current = activeTool;
    if (prev === "pen" && activeTool !== "pen" && pathStateRef.current?.isBuilding) {
      let ps = pathStateRef.current;
      if (ps.pendingHandleVertex != null) {
        const committed = commitPendingHandle({ pathDragState: ps });
        if (committed.pathDragState) ps = committed.pathDragState;
      }
      // Only finalize if we have at least 2 points; otherwise just cancel
      if (ps.points.length >= 2) {
        finalizePath(ps);
      } else {
        setState((prev) => ({ ...prev, pathDragState: null }));
      }
    }
  }, [activeTool, finalizePath, setState]);

  // ── Window mouseup for drags that leave the SVG ──────────────────────────
  // Note: The window mouseup listener is managed by Canvas itself since it
  // needs access to the current state.

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleElementMouseDown,
    handleElementDoubleClick,
    handleDoubleClick,
    handleWheel,
    getSVGCoords,
    buildContext,
    selectedId,
    selectedProps,
    visibleLayerIds,
    spacePressedRef,
    moveHistorySavedRef,
    lastPointerRef,
    pathBuildingRef,
    pathStateRef,
    onCreatePathRef,
  };
}

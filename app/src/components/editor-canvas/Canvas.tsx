import { useState, useRef, useCallback, useEffect } from "react";
import ElementsRenderer from "./ElementsRenderer";
import TextOverlay from "./TextOverlay";
import DragPreviews from "./DragPreviews";
import {
  MIN_TEXTBOX_SIZE,
  MIN_SHAPE_SIZE,
  DEFAULT_TEXT_HEIGHT,
  type CanvasProps,
} from "./types";
import {
  computePathBounds,
} from "./ElementsRenderer";
import { simplifyPath } from "../../lib/editor/pathSimplify";
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
  defaultToolState,
  type ToolEventContext,
  type ToolInteractionState,
} from "../../lib/editor-tools/types";
import {
  computeRubberBandIntersections,
  computeDragPosition,
  computeMultiDragDeltas,
} from "../../lib/editor-tools/MoveTool";
import {
  canResize,
  startResize,
  updateResize,
  getResizeCursor,
} from "../../lib/editor-tools/ResizeHandler";
import {
  startRotate,
  updateRotation,
  computeRotationDelta,
  getRotateCursor,
} from "../../lib/editor-tools/RotateHandler";
import {
  startPan,
  updatePan,
  handleZoom,
} from "../../lib/editor-tools/PanZoomHandler";
import { screenToWorld, computeSnapGuides, computeResizeSnapGuides, getSelectionBounds, remapBoxesThroughBounds, type SnapGuideLine } from "../../lib/editor/geometry";
import { getElementBoundingBox } from "./ElementsRenderer";
import { mergeState, getHandleCursor } from "./Canvas/helpers";

// ─── Component ────────────────────────────────────────────────────────────────

export default function Canvas({
  frameSize,
  activeTool,
  layers,
  selectedLayerId,
  selectedLayerIds,
  isEditingText,
  elementProperties,
  onCreateText,
  onCreateShape,
  onCreatePath,
  onSelectLayer,
  onShiftSelectLayer,
  onClearSelection,
  onRubberBandSelect,
  onMoveStart,
  onMoveElement,
  onEditText,
  editingContent,
  editingLayerId,
  onEditingContentChange,
  onCommitText,
  onResizeStart,
  onResizeElement,
  onRotateStart,
  onRotateElement,
  children,
  viewport = { zoom: 1, panX: 0, panY: 0 },
  onViewportChange,
  gridEnabled = false,
  snapEnabled = false,
  gridSize = 10,
  previewAnimation = false,
  scrubTime = null,
  selectedVertex = null,
}: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [state, setState] = useState(defaultToolState);
  const spacePressedRef = useRef(false);
  const [hoveredLayerId, setHoveredLayerId] = useState<string | null>(null);
  // Whether the current drag has already recorded a history entry (moved out
  // of tool state so we don't mutate refs stored inside state).
  const moveHistorySavedRef = useRef(false);

  // Last pen click (time + position) — used to suppress the second mousedown of
  // a double-click so it closes the path instead of placing an extra vertex.
  const lastPenClickRef = useRef<{ t: number; x: number; y: number } | null>(null);

  // Spacebar detection for pan mode
  const pathBuildingRef = useRef(false);
  useEffect(() => {
    pathBuildingRef.current = state.pathDragState?.isBuilding ?? false;
  }, [state.pathDragState?.isBuilding]);

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
  const pathStateRef = useRef(state.pathDragState);
  useEffect(() => { pathStateRef.current = state.pathDragState; }, [state.pathDragState]);
  const onCreatePathRef = useRef(onCreatePath);
  useEffect(() => { onCreatePathRef.current = onCreatePath; }, [onCreatePath]);

  // ── Finalize an in-progress path into a real layer ───────────────────────
  // Shared by every finalization route (Enter, tool switch, mouseup after
  // closing, and double-click) so a path can never be left dangling.
  const finalizePath = useCallback(
    (ps: NonNullable<ToolInteractionState["pathDragState"]>) => {
      if (ps.points.length >= 2) {
        const hasHandles = ps.handles?.some((h) => h?.in || h?.out);
        const finalPoints = hasHandles ? ps.points : simplifyPath(ps.points, 1.5);
        const bounds = computePathBounds(finalPoints);
        onCreatePathRef.current({
          ...bounds,
          points: finalPoints,
          handles: hasHandles ? ps.handles : undefined,
          stroke: "#3b82f6",
          strokeWidth: 2,
          fill: "rgba(59,130,246,0.15)",
          opacity: 1,
          closed: ps.closed,
        });
      }
      setState((prev) => ({ ...prev, pathDragState: null }));
    },
    [],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (activeTool !== "pen" || !pathBuildingRef.current) return;
      if (e.key === "Enter") {
        e.preventDefault();
        let ps = pathStateRef.current;
        if (!ps?.isBuilding || ps.points.length < 2) return;
        // Commit any in-flight bezier handle pull before finalizing.
        if (ps.pendingHandleVertex != null) {
          const committed = commitPendingHandle({ pathDragState: ps });
          if (committed.pathDragState) ps = committed.pathDragState;
        }
        // Create the path immediately
        finalizePath(ps);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setState((prev) => ({ ...prev, pathDragState: null }));
      } else if (e.key === "c" || e.key === "C") {
        // C: close the path (Figma-style) when enough anchors are placed.
        e.preventDefault();
        const ps = pathStateRef.current;
        if (ps?.isBuilding && ps.points.length >= 3) {
          const next = closePathFromDoubleClick({ pathDragState: ps } as ToolInteractionState);
          if (next.pathDragState) {
            // Like the dblclick case, no mouseup follows — finalize now.
            finalizePath(next.pathDragState);
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTool, finalizePath]);

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
    [viewport],
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

  // ── Cursor ───────────────────────────────────────────────────────────────
  const getCursor = (): string => {
    if (state.panState) return "grabbing";
    if (state.rotateState) return getRotateCursor(state);
    if (state.resizeState) return getResizeCursor(state);
    const tool = getToolHandler(activeTool);
    return tool.getCursor?.(state) ?? "default";
  };

  // ── Canvas mouse down ────────────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      // Middle-click or spacebar = pan
      if (e.button === 1 || spacePressedRef.current) {
        setState((prev) => ({ ...prev, ...startPan(e, viewport) }));
        return;
      }

      if (isEditingText) onCommitText?.();

      // ── Pen tool: click-to-place path building ───────────────────────
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
            // Start a new path with its first anchor; arm the bezier-handle pull.
            const started = { ...prev, ...mergeState(startPathFromPoint(x, y)) };
            return {
              ...started,
              ...mergeState(beginPendingHandle(started, 0, [x, y])),
            };
          }
          // Double-click (rapid second click): don't place another vertex — the
          // canvas onDoubleClick handler closes the path instead.
          if (isDoubleClick) return prev;
          // Add vertex or close path; when still building, arm the handle pull
          // on the vertex that was just placed.
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
      const tool = getToolHandler(activeTool);
      const next = tool.onCanvasMouseDown?.(ctx);
      if (next) setState((prev) => ({ ...prev, ...mergeState(next) }));
    },
    [activeTool, isEditingText, buildContext, onCommitText, viewport],
  );

  // Multi-select resize (B3): the whole selection is resized as a unit when
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
              ? {
                  id,
                  x: props.x,
                  y: props.y,
                  bounds: getElementBoundingBox(props),
                }
              : null;
          })
          .filter((item): item is NonNullable<typeof item> => item !== null),
      )
    : null;

  // ── Resize handle mousedown ──────────────────────────────────────────────
  const handleResizeMouseDown = useCallback(
    (
      e: React.MouseEvent,
      handle: "tl" | "tc" | "tr" | "ml" | "mr" | "bl" | "bc" | "br",
    ) => {
      e.stopPropagation();
      if (isEditingText) onCommitText?.();

      onResizeStart?.();
      const ctx = buildContext(e);

      // Multi-select: resize the whole selection as a unit (B3) — every
      // selected element is proportionally remapped through the bounds change.
      if (multiResizable && multiBounds) {
        const initialBoxes: Record<string, { x: number; y: number; width: number; height: number }> = {};
        for (const id of selectedLayerIds) {
          const props = elementProperties[id];
          if (!props) continue;
          initialBoxes[id] = {
            x: props.x,
            y: props.y,
            width: typeof props.width === "number" ? props.width : 0,
            height: props.height,
          };
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
      setState((prev) => ({ ...prev, ...mergeState(startResize(ctx, selectedId, handle)) }));
    },
    [selectedId, selectedProps, selectedLayerIds, multiResizable, multiBounds, elementProperties, isEditingText, onCommitText, onResizeStart, buildContext],
  );

  // ── Rotate handle mousedown ──────────────────────────────────────────────
  const handleRotateMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isEditingText) onCommitText?.();

      onRotateStart?.();
      const ctx = buildContext(e);

      // Multi-select: rotate every selected element by the same delta around
      // the selection center (B3).
      if (multiResizable && multiBounds) {
        const initialRotations: Record<string, number> = {};
        for (const id of selectedLayerIds) {
          const props = elementProperties[id];
          initialRotations[id] =
            (props && "rotation" in props && typeof props.rotation === "number"
              ? props.rotation
              : 0) ?? 0;
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
      setState((prev) => ({ ...prev, ...mergeState(startRotate(ctx, selectedId)) }));
    },
    [selectedId, selectedProps, selectedLayerIds, multiResizable, multiBounds, elementProperties, isEditingText, onCommitText, onRotateStart, buildContext],
  );

  // ── Path vertex editing listener (move tool: drag individual vertices) ──
  const vertexDragRef = useRef<{
    elementId: string;
    vertexIndex: number;
    startX: number;
    startY: number;
    historySaved: boolean;
  } | null>(null);
  const onMoveElementRef = useRef(onMoveElement);
  useEffect(() => { onMoveElementRef.current = onMoveElement; }, [onMoveElement]);
  const elementPropertiesRef = useRef(elementProperties);
  useEffect(() => { elementPropertiesRef.current = elementProperties; }, [elementProperties]);

  useEffect(() => {
    const handler = (e: Event) => {
      if (activeTool !== "move") return;
      const detail = (e as CustomEvent).detail as { layerId: string; vertexIndex: number };
      const props = elementPropertiesRef.current[detail.layerId];
      if (!props || props.type !== "path") return;
      if (detail.vertexIndex < 0 || detail.vertexIndex >= props.points.length) return;
      const [vx, vy] = props.points[detail.vertexIndex];
      vertexDragRef.current = {
        elementId: detail.layerId,
        vertexIndex: detail.vertexIndex,
        startX: vx,
        startY: vy,
        historySaved: false,
      };
      // Select the node. History is recorded once the drag actually moves.
      window.dispatchEvent(
        new CustomEvent("path-vertex-select", {
          detail: { layerId: detail.layerId, vertexIndex: detail.vertexIndex },
        }),
      );
    };
    window.addEventListener("path-vertex-mousedown", handler);
    return () => window.removeEventListener("path-vertex-mousedown", handler);
  }, [activeTool]);

  // ── Path bezier-handle drag listener (move tool: drag control points) ────
  const handleDragRef = useRef<{
    elementId: string;
    vertexIndex: number;
    side: "in" | "out";
    historySaved: boolean;
  } | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      if (activeTool !== "move") return;
      const detail = (e as CustomEvent).detail as {
        layerId: string;
        vertexIndex: number;
        side: "in" | "out";
      };
      const props = elementPropertiesRef.current[detail.layerId];
      if (!props || props.type !== "path") return;
      handleDragRef.current = {
        elementId: detail.layerId,
        vertexIndex: detail.vertexIndex,
        side: detail.side,
        historySaved: false,
      };
      // Selecting the vertex shows its handles. History records the drag once
      // the handle actually moves.
      window.dispatchEvent(
        new CustomEvent("path-vertex-select", {
          detail: { layerId: detail.layerId, vertexIndex: detail.vertexIndex },
        }),
      );
    };
    window.addEventListener("path-handle-mousedown", handler);
    return () => window.removeEventListener("path-handle-mousedown", handler);
  }, [activeTool]);

  // ── Global mousemove for vertex + bezier-handle drags (fires even outside SVG) ─
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const world = screenToWorld(
        { x: e.clientX - rect.left, y: e.clientY - rect.top },
        { ...viewport, panX: 0, panY: 0 },
      );
      if (vertexDragRef.current) {
        const vd = vertexDragRef.current;
        const props = elementPropertiesRef.current[vd.elementId];
        if (!props || props.type !== "path") return;
        // Record one history entry per drag, on the first real movement.
        if (!vd.historySaved) {
          vd.historySaved = true;
          window.dispatchEvent(
            new CustomEvent("path-vertex-drag-start", {
              detail: { elementId: vd.elementId },
            }),
          );
        }
        // EditorInner recomputes bounds and updates state.
        window.dispatchEvent(new CustomEvent("path-vertex-move", {
          detail: { elementId: vd.elementId, vertexIndex: vd.vertexIndex, x: world.x, y: world.y },
        }));
      }
      if (handleDragRef.current) {
        const hd = handleDragRef.current;
        const props = elementPropertiesRef.current[hd.elementId];
        if (!props || props.type !== "path") return;
        if (!hd.historySaved) {
          hd.historySaved = true;
          window.dispatchEvent(
            new CustomEvent("path-vertex-drag-start", {
              detail: { elementId: hd.elementId },
            }),
          );
        }
        window.dispatchEvent(new CustomEvent("path-handle-move", {
          detail: {
            elementId: hd.elementId,
            vertexIndex: hd.vertexIndex,
            side: hd.side,
            x: world.x,
            y: world.y,
          },
        }));
      }
    };
    const upHandler = () => {
      vertexDragRef.current = null;
      handleDragRef.current = null;
    };
    window.addEventListener("mousemove", handler);
    window.addEventListener("mouseup", upHandler);
    return () => {
      window.removeEventListener("mousemove", handler);
      window.removeEventListener("mouseup", upHandler);
    };
  }, [viewport]);

  // ── Element mouse down ───────────────────────────────────────────────────
  const handleElementMouseDown = useCallback(
    (e: React.MouseEvent, layerId: string) => {
      e.stopPropagation();
      if (isEditingText) onCommitText?.();

      if (activeTool === "move") {
        if (e.altKey) {
          // Alt+click drills up: selecting a child selects its parent group (B4).
          const layer = layers.find((l) => l.id === layerId);
          if (layer?.parentId) {
            onSelectLayer(layer.parentId);
            return;
          }
        }
        if (e.shiftKey) {
          onShiftSelectLayer?.(layerId);
          return; // Shift+click only toggles selection, don't start drag
        } else {
          onSelectLayer(layerId);
        }
      } else if (activeTool === "text") {
        const props = elementProperties[layerId];
        if (props && props.type === "text") {
          onEditText(layerId);
          return;
        }
      }

      const ctx = buildContext(e);
      const tool = getToolHandler(activeTool);
      const next = tool.onElementMouseDown?.(ctx, layerId);
      if (next) setState((prev) => ({ ...prev, ...mergeState(next) }));
    },
    [
      activeTool,
      isEditingText,
      layers,
      elementProperties,
      onSelectLayer,
      onShiftSelectLayer,
      onEditText,
      onCommitText,
      buildContext,
    ],
  );

  // ── Element double click ─────────────────────────────────────────────────
  // Move tool: double-click a text layer to edit it; double-click a group (or
  // any element nested in a group) to "drill" — select the group so its
  // children can be worked on (B4).
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
      // Double-click a group → select it (drill into). Double-click a child
      // inside a group → select its parent group (drill up to the group).
      const targetId =
        layer.type === "group" ? layer.id : (layer.parentId ?? null);
      if (targetId) onSelectLayer(targetId);
    },
    [activeTool, layers, elementProperties, onEditText, onSelectLayer],
  );

  // ── Tab cycles overlapping layers at the pointer (B4) ───────────────────
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || activeTool !== "move") return;
      const point = lastPointerRef.current;
      if (!point) return;
      // Leaf layers under the pointer, topmost first (later in layers array).
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

  // ── Mouse move ───────────────────────────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const ctx = buildContext(e);
      lastPointerRef.current = ctx.worldPoint;
      // Pan has priority
      if (state.panState) {
        onViewportChange?.(updatePan(state.panState, e.clientX, e.clientY, viewport));
        return;
      }

      // Rotate
      if (state.rotateState) {
        if (state.rotateState.selectionIds && state.rotateState.initialRotations) {
          // Multi-select: apply the same delta to every selected element (B3).
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

      // Resize
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
          // Multi-select: remap every element's box through the bounds change (B3).
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

      // Element drag (move tool)
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

      // Rubber-band
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

      // Pen tool: update preview line + pending handle pull while building
      if (state.pathDragState?.isBuilding) {
        const point: [number, number] = [ctx.worldPoint.x, ctx.worldPoint.y];
        const next = updatePendingHandle(state, point);
        if (next.pathDragState) {
          setState((prev) => ({ ...prev, ...mergeState(next) }));
        }
        return;
      }

      // Text / shape drag previews
      const tool = getToolHandler(activeTool);
      const next = tool.onMouseMove?.(ctx, state);
      if (next) setState((prev) => ({ ...prev, ...mergeState(next) }));
    },
    [
      activeTool,
      state,
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
    ],
  );

  // ── Mouse up ─────────────────────────────────────────────────────────────
  const handleMouseUp = useCallback(() => {
    // Pan
    if (state.panState) {
      setState((prev) => ({ ...prev, panState: null }));
      return;
    }

    // Rotate
    if (state.rotateState) {
      setState((prev) => ({ ...prev, rotateState: null }));
      return;
    }

    // Resize
    if (state.resizeState) {
      setState((prev) => ({ ...prev, resizeState: null, snapGuideLines: [] }));
      return;
    }

    // Drag
    if (state.dragState) {
      moveHistorySavedRef.current = false;
      setState((prev) => ({
        ...prev,
        dragState: null,
        snapGuideLines: [],
      }));
      return;
    }

    // Rubber-band
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

    // Text drag
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

    // Shape drag
    if (state.shapeDragState) {
      const { kind, startX, startY, currentX, currentY } = state.shapeDragState;
      const dx = currentX - startX;
      const dy = currentY - startY;
      const isClick = Math.abs(dx) < 3 && Math.abs(dy) < 3;
      const DS = 80;
      const fw = isClick ? DS : Math.max(Math.abs(dx), MIN_SHAPE_SIZE);
      const fh = isClick ? DS : Math.max(Math.abs(dy), MIN_SHAPE_SIZE);
      const fx = isClick ? startX - DS / 2 : Math.min(startX, currentX);
      const fy = isClick ? startY - DS / 2 : Math.min(startY, currentY);
      onCreateShape(kind, fx, fy, fw, fh);
      setState((prev) => ({ ...prev, shapeDragState: null }));
      return;
    }

    // Path drag (pen tool)
    if (state.pathDragState) {
      // Still building: commit any in-progress bezier handle pull, keep going.
      if (state.pathDragState.isBuilding) {
        if (state.pathDragState.pendingHandleVertex != null) {
          const next = commitPendingHandle(state);
          if (next.pathDragState) {
            setState((prev) => ({ ...prev, ...mergeState(next) }));
          }
        }
        return;
      }
      // Path is finalized (closed or Enter-pressed)
      finalizePath(state.pathDragState);
      return;
    }
  }, [
    state,
    onClearSelection,
    onSelectLayer,
    onRubberBandSelect,
    onCreateText,
    onCreateShape,
    finalizePath,
    elementProperties,
    visibleLayerIds,
  ]);

  // ── Finalize in-progress path when tool changes ──────────────────────────
  const prevActiveToolRef = useRef(activeTool);
  useEffect(() => {
    const prev = prevActiveToolRef.current;
    prevActiveToolRef.current = activeTool;
    if (prev === "pen" && activeTool !== "pen" && pathStateRef.current?.isBuilding) {
      // Finalize the open path when switching away from pen tool
      finalizePath(pathStateRef.current);
    }
  }, [activeTool, finalizePath]);

  // ── Window mouseup for drags that leave the SVG ──────────────────────────
  useEffect(() => {
    const active =
      state.panState ||
      state.rotateState ||
      state.resizeState ||
      state.dragState ||
      state.rubberBandState ||
      state.textDragState ||
      state.shapeDragState ||
      state.pathDragState?.pendingHandleVertex != null;
    if (!active) return;

    const handler = (event: MouseEvent) => {
      const svg = svgRef.current;
      if (svg && event.target instanceof Node && svg.contains(event.target)) return;
      handleMouseUp();
    };
    window.addEventListener("mouseup", handler);
    return () => window.removeEventListener("mouseup", handler);
  }, [state, handleMouseUp]);

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
    [onViewportChange, viewport],
  );

  // ── Pen tool: double-click the canvas closes the path (Figma-style) ──────
  const handleDoubleClick = useCallback(
    () => {
      if (activeTool === "pen" && state.pathDragState?.isBuilding) {
        const next = closePathFromDoubleClick(state);
        if (next.pathDragState) {
          // No mouseup follows a dblclick, so finalize the closed path right
          // here — otherwise the drawing would be left as a dangling ghost.
          finalizePath(next.pathDragState);
        }
      }
    },
    [activeTool, state, finalizePath],
  );

  // ── Overlay visibility ───────────────────────────────────────────────────
  const tool = getToolHandler(activeTool);
  const showResizeOverlay =
    (tool.showResizeOverlay ?? false) &&
    (!!selectedId && canResize(selectedProps)
      ? true
      : multiBounds !== null);

  // ── Editing overlay ──────────────────────────────────────────────────────
  const editingProps = editingLayerId ? elementProperties[editingLayerId] : undefined;
  const editingTextProps = editingProps?.type === "text" ? editingProps : null;

  const editingOverlay =
    isEditingText && editingLayerId && editingTextProps ? (
      <TextOverlay
        layerId={editingLayerId}
        content={editingContent ?? ""}
        x={editingTextProps.x * viewport.zoom}
        y={editingTextProps.y * viewport.zoom}
        width={typeof editingTextProps.width === "number" ? editingTextProps.width * viewport.zoom : "auto"}
        height={editingTextProps.height * viewport.zoom}
        fontFamily={editingTextProps.fontFamily}
        fontSize={editingTextProps.fontSize * viewport.zoom}
        fontWeight={editingTextProps.fontWeight}
        color={editingTextProps.color}
        backgroundColor={editingTextProps.backgroundColor}
        textAlign={editingTextProps.textAlign}
        textAlignVertical={editingTextProps.textAlignVertical}
        textAutoResize={editingTextProps.textAutoResize}
        lineHeight={editingTextProps.lineHeight}
        letterSpacing={editingTextProps.letterSpacing}
        italic={editingTextProps.italic}
        textDecoration={editingTextProps.textDecoration}
        textCase={editingTextProps.textCase}
        onChange={onEditingContentChange ?? (() => {})}
        onCommit={onCommitText ?? (() => {})}
      />
    ) : null;

  // ── Rotate transform for selected element overlay ────────────────────────
  // Single selection: the element's own props (with its rotation). Multi
  // selection: a synthetic axis-aligned box around the selection (each element
  // keeps its own rotation — the overlay box is the selection's AABB).
  const overlayProps = (
    showResizeOverlay && selectedProps && (selectedProps.type === "shape" || selectedProps.type === "image" || selectedProps.type === "path")
      ? selectedProps
      : showResizeOverlay && multiBounds
        ? {
            type: "shape",
            kind: "rect",
            x: multiBounds.x,
            y: multiBounds.y,
            width: multiBounds.width,
            height: multiBounds.height,
            fill: "none",
            stroke: "#3b82f6",
            strokeWidth: 1,
            opacity: 1,
          }
        : null);
  const rotateTransform =
    overlayProps && "rotation" in overlayProps && overlayProps.rotation
      ? `rotate(${overlayProps.rotation}, ${overlayProps.x + overlayProps.width / 2}, ${overlayProps.y + overlayProps.height / 2})`
      : undefined;

  // ── Render resize handle ─────────────────────────────────────────────────
  const renderHandle = (
    hx: number,
    hy: number,
    handleName: "tl" | "tc" | "tr" | "ml" | "mr" | "bl" | "bc" | "br",
  ) => {
    const visualSize = 6;
    const hitSize = 14;
    const cursor = getHandleCursor(handleName);
    return (
      <g key={handleName} className="resize-handle-group">
        <rect x={hx - visualSize / 2} y={hy - visualSize / 2} width={visualSize} height={visualSize} fill="white" stroke="#3b82f6" strokeWidth={1.5} className="pointer-events-none" />
        <rect x={hx - hitSize / 2} y={hy - hitSize / 2} width={hitSize} height={hitSize} fill="transparent" style={{ cursor }} onMouseDown={(e) => handleResizeMouseDown(e, handleName)} />
      </g>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="relative"
      style={{
        transform: `translate(${viewport.panX}px, ${viewport.panY}px)`,
        transformOrigin: "top left",
      }}
    >
      <svg
        ref={svgRef}
        width={frameSize.width * viewport.zoom}
        height={frameSize.height * viewport.zoom}
        viewBox={`0 0 ${frameSize.width} ${frameSize.height}`}
        className="bg-zinc-900 rounded-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] border border-white/10 overflow-hidden"
        style={{
          touchAction: "none",
          cursor: getCursor(),
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setHoveredLayerId(null)}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      >
        {gridEnabled && (
          <defs>
            <pattern id="editor-grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
              <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />
            </pattern>
          </defs>
        )}
        {gridEnabled && (
          <rect width={frameSize.width} height={frameSize.height} fill="url(#editor-grid)" className="pointer-events-none" />
        )}
        {children}

        <ElementsRenderer
          layers={layers}
          elementProperties={elementProperties}
          selectedLayerId={selectedLayerId}
          selectedLayerIds={selectedLayerIds}
          editingLayerId={editingLayerId}
          rubberBandHighlightedIds={state.rubberBandHighlightedIds}
          hoveredLayerId={activeTool === "move" ? hoveredLayerId : null}
          hideSelectionOutlineForId={showResizeOverlay ? selectedId : null}
          showEditPoints={activeTool === "move" && selectedProps?.type === "path"}
          selectedVertex={activeTool === "move" ? selectedVertex : null}
          previewAnimation={previewAnimation}
          scrubTime={scrubTime}
          frameSize={frameSize}
          onElementMouseDown={handleElementMouseDown}
          onElementDoubleClick={handleElementDoubleClick}
          onElementHover={setHoveredLayerId}
        />

        {/* Resize / Rotate Overlay */}
        {overlayProps && (
          <g className="resize-overlay" transform={rotateTransform}>
            <rect
              x={overlayProps.x}
              y={overlayProps.y}
              width={overlayProps.width}
              height={overlayProps.height}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={1}
              className="pointer-events-none"
            />
            <line
              x1={overlayProps.x + overlayProps.width / 2}
              y1={overlayProps.y}
              x2={overlayProps.x + overlayProps.width / 2}
              y2={overlayProps.y - 24}
              stroke="#3b82f6"
              strokeWidth={1}
              className="pointer-events-none"
            />
            <circle cx={overlayProps.x + overlayProps.width / 2} cy={overlayProps.y - 24} r={4} fill="white" stroke="#3b82f6" strokeWidth={1.5} className="pointer-events-none" />
            <circle
              cx={overlayProps.x + overlayProps.width / 2}
              cy={overlayProps.y - 24}
              r={10}
              fill="transparent"
              style={{ cursor: state.rotateState ? "grabbing" : "grab" }}
              onMouseDown={handleRotateMouseDown}
            />
            {renderHandle(overlayProps.x, overlayProps.y, "tl")}
            {renderHandle(overlayProps.x + overlayProps.width / 2, overlayProps.y, "tc")}
            {renderHandle(overlayProps.x + overlayProps.width, overlayProps.y, "tr")}
            {renderHandle(overlayProps.x, overlayProps.y + overlayProps.height / 2, "ml")}
            {renderHandle(overlayProps.x + overlayProps.width, overlayProps.y + overlayProps.height / 2, "mr")}
            {renderHandle(overlayProps.x, overlayProps.y + overlayProps.height, "bl")}
            {renderHandle(overlayProps.x + overlayProps.width / 2, overlayProps.y + overlayProps.height, "bc")}
            {renderHandle(overlayProps.x + overlayProps.width, overlayProps.y + overlayProps.height, "br")}
          </g>
        )}

        <DragPreviews rubberBandState={state.rubberBandState} textDragState={state.textDragState} shapeDragState={state.shapeDragState} pathDragState={state.pathDragState} />

        {/* Smart alignment guides */}
        {state.snapGuideLines.length > 0 && (
          <g className="snap-guides pointer-events-none">
            {state.snapGuideLines.map((guide, i) =>
              guide.orientation === "vertical" ? (
                <line
                  key={`sg-${i}`}
                  x1={guide.value}
                  y1={guide.from}
                  x2={guide.value}
                  y2={guide.to}
                  stroke="#ec4899"
                  strokeWidth={0.5}
                  strokeDasharray="4 3"
                  opacity={0.9}
                />
              ) : (
                <line
                  key={`sg-${i}`}
                  x1={guide.from}
                  y1={guide.value}
                  x2={guide.to}
                  y2={guide.value}
                  stroke="#ec4899"
                  strokeWidth={0.5}
                  strokeDasharray="4 3"
                  opacity={0.9}
                />
              ),
            )}
          </g>
        )}
      </svg>

      {editingOverlay}
    </div>
  );
}


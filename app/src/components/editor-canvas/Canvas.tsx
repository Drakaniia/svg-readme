import { useState, useRef, useCallback, useEffect } from "react";
import CanvasOverlay from "./CanvasOverlay";
import {
  type CanvasProps,
} from "./types";
import {
  computePathBounds,
} from "./ElementsRenderer";
import { simplifyPath } from "../../lib/editor/pathSimplify";
import {
  defaultToolState,
  type ToolInteractionState,
} from "../../lib/editor-tools/types";

import { useCanvasVertexEditing } from "./Canvas/useCanvasVertexEditing";
import { useCanvasResizeRotate } from "./Canvas/useCanvasResizeRotate";
import { useCanvasInteraction } from "./useCanvasInteraction";
import { getToolHandler } from "../../lib/editor-tools/registry";
import { getRotateCursor } from "../../lib/editor-tools/RotateHandler";
import { getResizeCursor } from "../../lib/editor-tools/ResizeHandler";
import type { CanvasOverlayProps } from "./CanvasOverlay";

// ─── Component ────────────────────────────────────────────────────────────────

export default function Canvas({
  frameSize,
  activeTool,
  selectedShapeKind,
  layers,
  selectedLayerId,
  selectedLayerIds,
  isEditingText,
  elementProperties,
  onCreateText,
  onCreateShape,
  onCreatePath,
  onPaintLayer,
  paintColor,
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
  const [hoveredLayerId, setHoveredLayerId] = useState<string | null>(null);

  // ── Path finalization ─────────────────────────────────────────────────
  const pathBuildingRef = useRef(false);
  useEffect(() => {
    pathBuildingRef.current = state.pathDragState?.isBuilding ?? false;
  }, [state.pathDragState?.isBuilding]);

  const pathStateRef = useRef(state.pathDragState);
  useEffect(() => { pathStateRef.current = state.pathDragState; }, [state.pathDragState]);
  const onCreatePathRef = useRef(onCreatePath);
  useEffect(() => { onCreatePathRef.current = onCreatePath; }, [onCreatePath]);

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

  // ── Extracted interaction hook ─────────────────────────────────────────
  const {
    handleMouseDown: rawMouseDown,
    handleMouseMove: rawMouseMove,
    handleMouseUp: rawMouseUp,
    handleElementMouseDown: rawElementMouseDown,
    handleElementDoubleClick,
    handleDoubleClick: hookHandleDoubleClick,
    handleWheel,
    buildContext,
    selectedId,
    selectedProps,
  } = useCanvasInteraction({
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
    pathDragState: state.pathDragState,
    finalizePath,
    onCreatePath,
  });

  // ── Resize/rotate handlers (extracted hook) ──────────────────────────
  const { handleResizeMouseDown, handleRotateMouseDown, multiBounds } =
    useCanvasResizeRotate({
      activeTool,
      selectedId, selectedProps, selectedLayerIds, elementProperties,
      isEditingText, onCommitText, onResizeStart, onRotateStart,
      buildContext,
      setState,
    });

  // ── Vertex editing listeners (extracted hook) ─────────────────────────
  useCanvasVertexEditing({ activeTool, viewport, svgRef, elementProperties });

  // ── Wrapper handlers that pass state ──────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => rawMouseDown(e, state),
    [rawMouseDown, state],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => rawMouseMove(e, state),
    [rawMouseMove, state],
  );

  const handleMouseUp = useCallback(() => rawMouseUp(state), [rawMouseUp, state]);

  const handleElementMouseDown = useCallback(
    (e: React.MouseEvent, layerId: string) => rawElementMouseDown(e, layerId, state),
    [rawElementMouseDown, state],
  );

  const handleDoubleClickRef = useRef(hookHandleDoubleClick);
  useEffect(() => { handleDoubleClickRef.current = hookHandleDoubleClick; }, [hookHandleDoubleClick]);
  const handleDoubleClick = useCallback(
    (_e: React.MouseEvent) => { handleDoubleClickRef.current?.(state); },
    [state],
  );

  // ── Overlay visibility ───────────────────────────────────────────────────
  const tool = getToolHandler(activeTool, selectedShapeKind);
  const showResizeOverlay =
    (tool.showResizeOverlay ?? false) &&
    (!!selectedId && selectedProps && (selectedProps.type === "shape" || selectedProps.type === "image" || selectedProps.type === "path")
      ? true
      : multiBounds !== null);

  // ── Rotate transform for selected element overlay ────────────────────────
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

  // ── Cursor ───────────────────────────────────────────────────────────────
  const getCursor = (): string => {
    if (state.panState) return "grabbing";
    if (state.rotateState) return getRotateCursor(state);
    if (state.resizeState) return getResizeCursor(state);
    return tool.getCursor?.(state) ?? "default";
  };

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
        <CanvasOverlay
          frameSize={frameSize}
          viewport={viewport}
          gridEnabled={gridEnabled}
          snapEnabled={snapEnabled}
          gridSize={gridSize}
          layers={layers}
          selectedLayerId={selectedLayerId}
          selectedLayerIds={selectedLayerIds}
          elementProperties={elementProperties}
          selectedVertex={selectedVertex}
          activeTool={activeTool}
          hoveredLayerId={hoveredLayerId}
          editingLayerId={editingLayerId}
          editingContent={editingContent}
          isEditingText={isEditingText}
          selectedProps={selectedProps}
          selectedId={selectedId}
          multiBounds={multiBounds}
          showResizeOverlay={showResizeOverlay}
          overlayProps={overlayProps as CanvasOverlayProps["overlayProps"]}
          rotateTransform={rotateTransform}
          rotateState={!!state.rotateState}
          snapGuideLines={state.snapGuideLines}
          rubberBandState={state.rubberBandState}
          textDragState={state.textDragState}
          shapeDragState={state.shapeDragState}
          pathDragState={state.pathDragState}
          rubberBandHighlightedIds={state.rubberBandHighlightedIds}
          previewAnimation={previewAnimation}
          scrubTime={scrubTime}
          onElementMouseDown={handleElementMouseDown}
          onElementDoubleClick={handleElementDoubleClick}
          onElementHover={setHoveredLayerId}
          handleResizeMouseDown={handleResizeMouseDown}
          handleRotateMouseDown={handleRotateMouseDown}
          onEditingContentChange={onEditingContentChange}
          onCommitText={onCommitText}
        >
          {children}
        </CanvasOverlay>
      </svg>
    </div>
  );
}

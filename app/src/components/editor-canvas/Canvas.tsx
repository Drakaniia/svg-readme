import { useState, useRef, useCallback } from "react";
import ElementsRenderer, {
  getElementBoundingBox,
} from "./ElementsRenderer";
import TextOverlay from "./TextOverlay";
import {
  MIN_TEXTBOX_SIZE,
  MIN_SHAPE_SIZE,
  SHAPE_TOOLS,
  toolToShapeKind,
  type DragState,
  type TextDragState,
  type ShapeDragState,
  type RubberBandState,
  type CanvasProps,
  type ResizeState,
  type RotateState,
} from "./types";

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
  onSelectLayer,
  onShiftSelectLayer,
  onClearSelection,
  onRubberBandSelect,
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
}: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [textDragState, setTextDragState] = useState<TextDragState | null>(
    null,
  );
  const [shapeDragState, setShapeDragState] = useState<ShapeDragState | null>(
    null,
  );
  const [rubberBandState, setRubberBandState] =
    useState<RubberBandState | null>(null);
  const [rubberBandHighlightedIds, setRubberBandHighlightedIds] = useState<
    string[]
  >([]);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [rotateState, setRotateState] = useState<RotateState | null>(null);

  const selectedId =
    selectedLayerIds && selectedLayerIds.length > 0
      ? (selectedLayerIds.length === 1 ? selectedLayerIds[0] : null)
      : (selectedLayerId || null);
  const selectedProps = selectedId ? elementProperties[selectedId] : null;

  // ── Cursor ──────────────────────────────────────────────────────────────────
  const getCursor = () => {
    if (activeTool === "text") return "text";
    if (SHAPE_TOOLS.has(activeTool)) return "crosshair";
    if (dragState) return "grabbing";
    if (resizeState) return getHandleCursor(resizeState.handle);
    if (rotateState) return "grabbing";
    return "default";
  };

  // ── Get SVG coordinates from mouse event ────────────────────────────────────
  const getSVGCoords = useCallback(
    (e: React.MouseEvent): { x: number; y: number } => {
      const svg = svgRef.current;
      if (!svg) return { x: e.clientX, y: e.clientY };
      const rect = svg.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    [],
  );

  // ── Mouse down handler ─────────────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // If currently editing text, commit before proceeding with the click.
      // This matches Figma behavior: clicking outside while editing commits
      // the text AND lets the canvas action (select, create, etc.) proceed
      // on the same click without requiring a second click.
      if (isEditingText) {
        onCommitText?.();
      }

      const coords = getSVGCoords(e);

      if (activeTool === "move") {
        // Start rubber-band selection on empty canvas drag
        setRubberBandState({
          startX: coords.x,
          startY: coords.y,
          currentX: coords.x,
          currentY: coords.y,
          addToExisting: e.shiftKey,
        });
        setRubberBandHighlightedIds([]);
      } else if (activeTool === "text") {
        // Start text creation drag
        setTextDragState({
          startX: coords.x,
          startY: coords.y,
          currentX: coords.x,
          currentY: coords.y,
        });
      } else if (SHAPE_TOOLS.has(activeTool)) {
        // Start shape placement drag
        const kind = toolToShapeKind(activeTool);
        if (kind) {
          setShapeDragState({
            kind,
            startX: coords.x,
            startY: coords.y,
            currentX: coords.x,
            currentY: coords.y,
          });
        }
      }
    },
    [activeTool, isEditingText, getSVGCoords, onCommitText],
  );

  // ── Handle resize handle mousedown ─────────────────────────────────────────
  const handleResizeMouseDown = useCallback(
    (
      e: React.MouseEvent,
      handle: "tl" | "tc" | "tr" | "ml" | "mr" | "bl" | "bc" | "br",
    ) => {
      e.stopPropagation();
      if (isEditingText) {
        onCommitText?.();
      }

      if (selectedId && selectedProps && (selectedProps.type === "shape" || selectedProps.type === "image")) {
        onResizeStart?.();
        const coords = getSVGCoords(e);
        setResizeState({
          elementId: selectedId,
          handle,
          startX: coords.x,
          startY: coords.y,
          initialX: selectedProps.x,
          initialY: selectedProps.y,
          initialWidth: selectedProps.width,
          initialHeight: selectedProps.height,
        });
      }
    },
    [
      selectedId,
      selectedProps,
      isEditingText,
      onCommitText,
      onResizeStart,
      getSVGCoords,
    ],
  );

  // ── Handle rotate handle mousedown ─────────────────────────────────────────
  const handleRotateMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isEditingText) {
        onCommitText?.();
      }

      if (selectedId && selectedProps && (selectedProps.type === "shape" || selectedProps.type === "image")) {
        onRotateStart?.();
        const coords = getSVGCoords(e);
        const centerX = selectedProps.x + selectedProps.width / 2;
        const centerY = selectedProps.y + selectedProps.height / 2;
        const dx = coords.x - centerX;
        const dy = coords.y - centerY;
        const startAngle = Math.atan2(dy, dx) * (180 / Math.PI);
        setRotateState({
          elementId: selectedId,
          centerX,
          centerY,
          startAngle,
          initialRotation: selectedProps.rotation ?? 0,
        });
      }
    },
    [selectedId, selectedProps, isEditingText, onCommitText, getSVGCoords, onRotateStart],
  );

  // ── Element mouse down (for move tool selection/drag) ──────────────────────
  const handleElementMouseDown = useCallback(
    (e: React.MouseEvent, layerId: string) => {
      // Always stop propagation for element clicks so the canvas-level
      // handleMouseDown doesn't interfere (e.g., deselecting all).
      e.stopPropagation();

      // If currently editing text, commit before proceeding with the element
      // action. This matches Figma: clicking on another element while editing
      // commits the text AND selects/edits the clicked element in one click.
      if (isEditingText) {
        onCommitText?.();
      }

      if (activeTool === "move") {
        // Figma: Shift+click toggles multi-selection of layers
        if (e.shiftKey) {
          onShiftSelectLayer?.(layerId);
        } else {
          onSelectLayer(layerId);
        }

        const props = elementProperties[layerId];
        if (props) {
          // If this layer is part of a multi-selection, capture initial
          // positions of ALL selected layers for multi-drag.
          const allSelectedIds: string[] = [];
          if (
            selectedLayerIds &&
            selectedLayerIds.length > 1 &&
            selectedLayerIds.includes(layerId)
          ) {
            allSelectedIds.push(...selectedLayerIds);
          }

          const multiStartPositions:
            | Record<string, { x: number; y: number }>
            | undefined =
            allSelectedIds.length > 1
              ? Object.fromEntries(
                  allSelectedIds
                    .filter((id) => elementProperties[id])
                    .map((id) => [
                      id,
                      {
                        x: elementProperties[id].x,
                        y: elementProperties[id].y,
                      },
                    ]),
                )
              : undefined;

          setDragState({
            elementId: layerId,
            startX: e.clientX,
            startY: e.clientY,
            offsetX: e.clientX - props.x,
            offsetY: e.clientY - props.y,
            multiStartPositions,
          });
        }
      } else if (activeTool === "text") {
        // Click on existing text with text tool → edit it
        const props = elementProperties[layerId];
        if (props && props.type === "text") {
          onEditText(layerId);
        }
      }
      // Shape tools: clicking on an existing element while a shape tool is
      // active doesn't do anything special — the canvas drag still creates a
      // new shape on mousedown/mouseup.
    },
    [
      activeTool,
      isEditingText,
      elementProperties,
      selectedLayerIds,
      onSelectLayer,
      onShiftSelectLayer,
      onEditText,
      onCommitText,
    ],
  );

  // ── Element double click (move tool → edit text) ──────────────────────────
  const handleElementDoubleClick = useCallback(
    (_e: React.MouseEvent, layerId: string) => {
      if (activeTool === "move") {
        const props = elementProperties[layerId];
        if (props && props.type === "text") {
          onEditText(layerId);
        }
      }
    },
    [activeTool, elementProperties, onEditText],
  );

  // ── Compute which layers intersect with the rubber-band rect ───────────────
  const computeRubberBandElements = useCallback(
    (rState: RubberBandState) => {
      const rx = Math.min(rState.startX, rState.currentX);
      const ry = Math.min(rState.startY, rState.currentY);
      const rw = Math.abs(rState.currentX - rState.startX);
      const rh = Math.abs(rState.currentY - rState.startY);

      // If rubber band is too small, don't highlight anything
      if (rw < 3 && rh < 3) return [];

      const intersecting: string[] = [];
      for (const layer of layers) {
        if (!layer.visible) continue;
        const props = elementProperties[layer.id];
        if (!props) continue;

        const bb = getElementBoundingBox(props);
        // AABB intersection check
        if (
          bb.x < rx + rw &&
          bb.x + bb.width > rx &&
          bb.y < ry + rh &&
          bb.y + bb.height > ry
        ) {
          intersecting.push(layer.id);
        }
      }
      return intersecting;
    },
    [layers, elementProperties],
  );

  // ── Mouse move handler ─────────────────────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (rotateState) {
        const coords = getSVGCoords(e);
        const dx = coords.x - rotateState.centerX;
        const dy = coords.y - rotateState.centerY;
        const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);
        const angleDelta = currentAngle - rotateState.startAngle;
        let newRotation = (rotateState.initialRotation + angleDelta) % 360;
        if (newRotation < 0) newRotation += 360;
        onRotateElement?.(rotateState.elementId, newRotation);
      } else if (resizeState) {
        const coords = getSVGCoords(e);
        const dx = coords.x - resizeState.startX;
        const dy = coords.y - resizeState.startY;

        const {
          handle,
          initialX,
          initialY,
          initialWidth,
          initialHeight,
          elementId,
        } = resizeState;

        let newX = initialX;
        let newY = initialY;
        let newWidth = initialWidth;
        let newHeight = initialHeight;

        const minW = MIN_SHAPE_SIZE;
        const minH = MIN_SHAPE_SIZE;

        switch (handle) {
          case "br":
            newWidth = Math.max(initialWidth + dx, minW);
            newHeight = Math.max(initialHeight + dy, minH);
            break;
          case "mr":
            newWidth = Math.max(initialWidth + dx, minW);
            break;
          case "bc":
            newHeight = Math.max(initialHeight + dy, minH);
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
            break;
          case "tc":
            newHeight = Math.max(initialHeight - dy, minH);
            newY = initialY + (initialHeight - newHeight);
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

        onResizeElement?.(elementId, newX, newY, newWidth, newHeight);
      } else if (dragState) {
        if (dragState.multiStartPositions) {
          // Multi-drag: move all selected layers by the same delta
          const dx = e.clientX - dragState.startX;
          const dy = e.clientY - dragState.startY;
          for (const [id, pos] of Object.entries(
            dragState.multiStartPositions,
          )) {
            onMoveElement(id, pos.x + dx, pos.y + dy);
          }
        } else {
          // Single drag: move the clicked element to absolute position
          const newX = e.clientX - dragState.offsetX;
          const newY = e.clientY - dragState.offsetY;
          onMoveElement(dragState.elementId, newX, newY);
        }
      } else if (rubberBandState) {
        const coords = getSVGCoords(e);
        const newState: RubberBandState = {
          ...rubberBandState,
          currentX: coords.x,
          currentY: coords.y,
        };
        setRubberBandState(newState);
        setRubberBandHighlightedIds(computeRubberBandElements(newState));
      } else if (textDragState) {
        // Text tool drag preview
        const coords = getSVGCoords(e);
        setTextDragState((prev) =>
          prev ? { ...prev, currentX: coords.x, currentY: coords.y } : null,
        );
      } else if (shapeDragState) {
        // Shape placement drag preview
        const coords = getSVGCoords(e);
        setShapeDragState((prev) =>
          prev ? { ...prev, currentX: coords.x, currentY: coords.y } : null,
        );
      }
    },
    [
      rotateState,
      resizeState,
      dragState,
      rubberBandState,
      textDragState,
      shapeDragState,
      getSVGCoords,
      onMoveElement,
      onResizeElement,
      onRotateElement,
      computeRubberBandElements,
    ],
  );

  // ── Mouse up handler ───────────────────────────────────────────────────────
  const handleMouseUp = useCallback(() => {
    if (rotateState) {
      setRotateState(null);
    } else if (resizeState) {
      setResizeState(null);
    } else if (dragState) {
      setDragState(null);
    } else if (rubberBandState) {
      const dx = rubberBandState.currentX - rubberBandState.startX;
      const dy = rubberBandState.currentY - rubberBandState.startY;

      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
        // Tiny drag — treat as click on empty canvas → clear selection
        if (rubberBandState.addToExisting) {
          // Shift+click on empty canvas: no change, keep existing selection
        } else if (onClearSelection) {
          onClearSelection();
        } else {
          onSelectLayer(null);
        }
      } else {
        // Significant drag — finalize rubber-band selection
        const intersecting = computeRubberBandElements(rubberBandState);
        onRubberBandSelect?.(intersecting, rubberBandState.addToExisting);
      }

      setRubberBandState(null);
      setRubberBandHighlightedIds([]);
    } else if (textDragState) {
      const dx = textDragState.currentX - textDragState.startX;
      const dy = textDragState.currentY - textDragState.startY;

      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
        // Single click — auto-width text
        onCreateText(textDragState.startX, textDragState.startY, "auto", 30);
      } else {
        // Drag — fixed-width text with minimum size
        const finalWidth = Math.max(Math.abs(dx), MIN_TEXTBOX_SIZE);
        const finalHeight = Math.max(Math.abs(dy), MIN_TEXTBOX_SIZE);
        const finalX = Math.min(textDragState.startX, textDragState.currentX);
        const finalY = Math.min(textDragState.startY, textDragState.currentY);
        onCreateText(finalX, finalY, finalWidth, finalHeight);
      }

      setTextDragState(null);
    } else if (shapeDragState) {
      const dx = shapeDragState.currentX - shapeDragState.startX;
      const dy = shapeDragState.currentY - shapeDragState.startY;

      // Require a minimum drag distance to place a shape.
      // A tiny click still places a default-sized shape.
      const isClick = Math.abs(dx) < 3 && Math.abs(dy) < 3;
      const DEFAULT_SHAPE_SIZE = 80;

      const finalWidth = isClick
        ? DEFAULT_SHAPE_SIZE
        : Math.max(Math.abs(dx), MIN_SHAPE_SIZE);
      const finalHeight = isClick
        ? DEFAULT_SHAPE_SIZE
        : Math.max(Math.abs(dy), MIN_SHAPE_SIZE);
      const finalX = isClick
        ? shapeDragState.startX - DEFAULT_SHAPE_SIZE / 2
        : Math.min(shapeDragState.startX, shapeDragState.currentX);
      const finalY = isClick
        ? shapeDragState.startY - DEFAULT_SHAPE_SIZE / 2
        : Math.min(shapeDragState.startY, shapeDragState.currentY);

      onCreateShape(shapeDragState.kind, finalX, finalY, finalWidth, finalHeight);
      setShapeDragState(null);
    }
  }, [
    rotateState,
    resizeState,
    dragState,
    rubberBandState,
    textDragState,
    shapeDragState,
    computeRubberBandElements,
    onRubberBandSelect,
    onClearSelection,
    onSelectLayer,
    onCreateText,
    onCreateShape,
  ]);

  // ── Rubber-band selection preview rect ──────────────────────────────────────
  const rubberBandPreview = rubberBandState ? (
    <rect
      x={Math.min(rubberBandState.startX, rubberBandState.currentX)}
      y={Math.min(rubberBandState.startY, rubberBandState.currentY)}
      width={Math.abs(rubberBandState.currentX - rubberBandState.startX)}
      height={Math.abs(rubberBandState.currentY - rubberBandState.startY)}
      fill="rgba(59,130,246,0.08)"
      stroke="#3b82f6"
      strokeWidth={1}
      strokeDasharray="4 2"
      rx={1}
      className="pointer-events-none"
    />
  ) : null;

  // ── Text drag preview rect ──────────────────────────────────────────────────
  const textDragPreview = textDragState ? (
    <rect
      x={Math.min(textDragState.startX, textDragState.currentX)}
      y={Math.min(textDragState.startY, textDragState.currentY)}
      width={Math.abs(textDragState.currentX - textDragState.startX)}
      height={Math.abs(textDragState.currentY - textDragState.startY)}
      fill="none"
      stroke="#3b82f6"
      strokeWidth={1}
      strokeDasharray="4 2"
    />
  ) : null;

  // ── Shape placement drag preview ─────────────────────────────────────────────
  const shapeDragPreview = shapeDragState ? (
    <rect
      x={Math.min(shapeDragState.startX, shapeDragState.currentX)}
      y={Math.min(shapeDragState.startY, shapeDragState.currentY)}
      width={Math.max(
        Math.abs(shapeDragState.currentX - shapeDragState.startX),
        1,
      )}
      height={Math.max(
        Math.abs(shapeDragState.currentY - shapeDragState.startY),
        1,
      )}
      fill="rgba(139,92,246,0.12)"
      stroke="#8b5cf6"
      strokeWidth={1}
      strokeDasharray="4 2"
      rx={2}
      className="pointer-events-none"
    />
  ) : null;

  // ── Get editing overlay position ────────────────────────────────────────────
  const editingProps =
    editingLayerId && elementProperties[editingLayerId];
  const editingTextProps =
    editingProps && editingProps.type === "text" ? editingProps : null;

  const editingOverlay =
    isEditingText && editingLayerId && editingTextProps ? (
      <TextOverlay
        layerId={editingLayerId}
        content={editingContent ?? ""}
        x={editingTextProps.x}
        y={editingTextProps.y}
        width={editingTextProps.width}
        height={editingTextProps.height}
        fontFamily={editingTextProps.fontFamily}
        fontSize={editingTextProps.fontSize}
        fontWeight={editingTextProps.fontWeight}
        color={editingTextProps.color}
        textAlign={editingTextProps.textAlign}
        onChange={onEditingContentChange ?? (() => {})}
        onCommit={onCommitText ?? (() => {})}
      />
    ) : null;

  const showResizeOverlay =
    activeTool === "move" &&
    selectedId &&
    selectedProps &&
    (selectedProps.type === "shape" || selectedProps.type === "image");

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
        <rect
          x={hx - visualSize / 2}
          y={hy - visualSize / 2}
          width={visualSize}
          height={visualSize}
          fill="white"
          stroke="#3b82f6"
          strokeWidth={1.5}
          className="pointer-events-none"
        />
        <rect
          x={hx - hitSize / 2}
          y={hy - hitSize / 2}
          width={hitSize}
          height={hitSize}
          fill="transparent"
          style={{ cursor }}
          onMouseDown={(e) => handleResizeMouseDown(e, handleName)}
        />
      </g>
    );
  };

  const rotateTransform =
    showResizeOverlay && selectedProps && (selectedProps.type === "shape" || selectedProps.type === "image") && selectedProps.rotation
      ? `rotate(${selectedProps.rotation}, ${selectedProps.x + selectedProps.width / 2}, ${selectedProps.y + selectedProps.height / 2})`
      : undefined;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={frameSize.width}
        height={frameSize.height}
        viewBox={`0 0 ${frameSize.width} ${frameSize.height}`}
        className="bg-zinc-900 rounded-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] border border-white/10 overflow-hidden"
        style={{
          cursor: getCursor(),
          // Prevent text content selection inside the SVG, especially when
          // using the Move Tool — only the layer/component should be selected.
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {children}

        <ElementsRenderer
          layers={layers}
          elementProperties={elementProperties}
          selectedLayerId={selectedLayerId}
          selectedLayerIds={selectedLayerIds}
          editingLayerId={editingLayerId}
          rubberBandHighlightedIds={rubberBandHighlightedIds}
          onElementMouseDown={handleElementMouseDown}
          onElementDoubleClick={handleElementDoubleClick}
        />

        {/* Resize Handles Overlay */}
        {showResizeOverlay && (
          <g className="resize-overlay" transform={rotateTransform}>
            {/* Bounding box outline */}
            <rect
              x={selectedProps.x}
              y={selectedProps.y}
              width={selectedProps.width}
              height={selectedProps.height}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={1}
              className="pointer-events-none"
            />
            {/* Rotate handle connector line */}
            <line
              x1={selectedProps.x + selectedProps.width / 2}
              y1={selectedProps.y}
              x2={selectedProps.x + selectedProps.width / 2}
              y2={selectedProps.y - 24}
              stroke="#3b82f6"
              strokeWidth={1}
              className="pointer-events-none"
            />
            {/* Rotate handle visual circle */}
            <circle
              cx={selectedProps.x + selectedProps.width / 2}
              cy={selectedProps.y - 24}
              r={4}
              fill="white"
              stroke="#3b82f6"
              strokeWidth={1.5}
              className="pointer-events-none"
            />
            {/* Rotate handle invisible hit area */}
            <circle
              cx={selectedProps.x + selectedProps.width / 2}
              cy={selectedProps.y - 24}
              r={10}
              fill="transparent"
              style={{ cursor: rotateState ? "grabbing" : "grab" }}
              onMouseDown={handleRotateMouseDown}
            />
            {/* 8 Handles */}
            {renderHandle(selectedProps.x, selectedProps.y, "tl")}
            {renderHandle(
              selectedProps.x + selectedProps.width / 2,
              selectedProps.y,
              "tc",
            )}
            {renderHandle(
              selectedProps.x + selectedProps.width,
              selectedProps.y,
              "tr",
            )}
            {renderHandle(
              selectedProps.x,
              selectedProps.y + selectedProps.height / 2,
              "ml",
            )}
            {renderHandle(
              selectedProps.x + selectedProps.width,
              selectedProps.y + selectedProps.height / 2,
              "mr",
            )}
            {renderHandle(
              selectedProps.x,
              selectedProps.y + selectedProps.height,
              "bl",
            )}
            {renderHandle(
              selectedProps.x + selectedProps.width / 2,
              selectedProps.y + selectedProps.height,
              "bc",
            )}
            {renderHandle(
              selectedProps.x + selectedProps.width,
              selectedProps.y + selectedProps.height,
              "br",
            )}
          </g>
        )}

        {rubberBandPreview}
        {textDragPreview}
        {shapeDragPreview}
      </svg>

      {/* Text editing overlay (absolutely positioned over SVG) */}
      {editingOverlay}
    </div>
  );
}

const getHandleCursor = (
  handle: "tl" | "tc" | "tr" | "ml" | "mr" | "bl" | "bc" | "br",
) => {
  if (handle === "tl" || handle === "br") return "nwse-resize";
  if (handle === "tr" || handle === "bl") return "nesw-resize";
  if (handle === "tc" || handle === "bc") return "ns-resize";
  if (handle === "ml" || handle === "mr") return "ew-resize";
  return "default";
};

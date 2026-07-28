import { useState, useRef, useCallback } from "react";
import ElementsRenderer, { getTextBoundingBox } from "./ElementsRenderer";
import TextOverlay from "./TextOverlay";
import {
  MIN_TEXTBOX_SIZE,
  type DragState,
  type TextDragState,
  type RubberBandState,
  type CanvasProps,
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
  children,
}: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [textDragState, setTextDragState] = useState<TextDragState | null>(
    null,
  );
  const [rubberBandState, setRubberBandState] =
    useState<RubberBandState | null>(null);
  const [rubberBandHighlightedIds, setRubberBandHighlightedIds] = useState<
    string[]
  >([]);

  // ── Cursor ──────────────────────────────────────────────────────────────────
  const getCursor = () => {
    if (activeTool === "text") return "text";
    if (dragState) return "grabbing";
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
      }
    },
    [activeTool, isEditingText, getSVGCoords, onCommitText],
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

        const bb = getTextBoundingBox(props);
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
      if (dragState) {
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
      }
    },
    [
      dragState,
      rubberBandState,
      textDragState,
      getSVGCoords,
      onMoveElement,
      computeRubberBandElements,
    ],
  );

  // ── Mouse up handler ───────────────────────────────────────────────────────
  const handleMouseUp = useCallback(() => {
    if (dragState) {
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
        // Single click — auto-width text so the overlay and bounding box
        // resize with the content as the user types (matching Figma behavior)
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
    }
  }, [
    dragState,
    rubberBandState,
    textDragState,
    computeRubberBandElements,
    onRubberBandSelect,
    onClearSelection,
    onSelectLayer,
    onCreateText,
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

  // ── Get editing overlay position ────────────────────────────────────────────
  const editingOverlay =
    isEditingText && editingLayerId && elementProperties[editingLayerId] ? (
      <TextOverlay
        layerId={editingLayerId}
        content={editingContent ?? ""}
        x={elementProperties[editingLayerId].x}
        y={elementProperties[editingLayerId].y}
        width={elementProperties[editingLayerId].width}
        height={elementProperties[editingLayerId].height}
        fontFamily={elementProperties[editingLayerId].fontFamily}
        fontSize={elementProperties[editingLayerId].fontSize}
        fontWeight={elementProperties[editingLayerId].fontWeight}
        color={elementProperties[editingLayerId].color}
        backgroundColor={elementProperties[editingLayerId].backgroundColor}
        textAlign={elementProperties[editingLayerId].textAlign}
        onChange={onEditingContentChange ?? (() => {})}
        onCommit={onCommitText ?? (() => {})}
      />
    ) : null;

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

        {rubberBandPreview}
        {textDragPreview}
      </svg>

      {/* Text editing overlay (absolutely positioned over SVG) */}
      {editingOverlay}
    </div>
  );
}

import React from "react";
import type { LayerType } from "../../context/EditorContext";
import type { ElementProperties } from "./ElementsRenderer";
import ElementsRenderer from "./ElementsRenderer";
import TextOverlay from "./TextOverlay";
import DragPreviews from "./DragPreviews";
import type {
  TextDragState,
  ShapeDragState,
  RubberBandState,
  PathDragState,
} from "./types";
import type { SnapGuideLine, Viewport } from "../../lib/editor/geometry";
import { getHandleCursor } from "./Canvas/helpers";
import { ROTATE_CURSOR } from "../../lib/editor-tools/RotateHandler";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CanvasOverlayProps {
  // Frame & viewport
  frameSize: { width: number; height: number };
  viewport: Viewport;
  gridEnabled: boolean;
  snapEnabled: boolean;
  gridSize: number;

  // Selection state
  layers: LayerType[];
  selectedLayerId: string | null;
  selectedLayerIds: string[];
  elementProperties: Record<string, ElementProperties>;
  selectedVertex: { layerId: string; index: number } | null;
  activeTool: string;
  hoveredLayerId: string | null;
  editingLayerId?: string | null;
  editingContent?: string;
  isEditingText: boolean;
  selectedProps: ElementProperties | null;
  selectedId: string | null;
  multiBounds: { x: number; y: number; width: number; height: number } | null;

  // Overlay state
  showResizeOverlay: boolean;
  overlayProps: {
    type: string;
    kind: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fill: string;
    stroke: string;
    strokeWidth: number;
    opacity: number;
    rotation?: number;
  } | null;
  rotateTransform: string | undefined;
  rotateState: boolean;
  snapGuideLines: SnapGuideLine[];

  // Drag preview states
  rubberBandState: RubberBandState | null;
  textDragState: TextDragState | null;
  shapeDragState: ShapeDragState | null;
  pathDragState: PathDragState | null;
  rubberBandHighlightedIds: string[];

  // Preview
  previewAnimation: boolean;
  scrubTime: number | null;

  // Event handlers
  onElementMouseDown: (e: React.MouseEvent, layerId: string) => void;
  onElementDoubleClick: (e: React.MouseEvent, layerId: string) => void;
  onElementHover: (id: string | null) => void;
  handleResizeMouseDown: (e: React.MouseEvent, handle: "tl" | "tc" | "tr" | "ml" | "mr" | "bl" | "bc" | "br") => void;
  handleRotateMouseDown: (e: React.MouseEvent) => void;

  // Editing overlay
  onEditingContentChange?: (content: string) => void;
  onCommitText?: () => void;

  children?: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CanvasOverlay({
  frameSize,
  viewport,
  gridEnabled,
  gridSize,
  layers,
  selectedLayerId,
  selectedLayerIds,
  elementProperties,
  selectedVertex,
  activeTool,
  hoveredLayerId,
  editingLayerId,
  editingContent,
  isEditingText,
  selectedProps,
  selectedId,
  showResizeOverlay,
  overlayProps,
  rotateTransform,
  rotateState,
  snapGuideLines,
  rubberBandState,
  textDragState,
  shapeDragState,
  pathDragState,
  rubberBandHighlightedIds,
  previewAnimation,
  scrubTime,
  onElementMouseDown,
  onElementDoubleClick,
  onElementHover,
  handleResizeMouseDown,
  handleRotateMouseDown,
  onEditingContentChange,
  onCommitText,
  children,
}: CanvasOverlayProps) {
  void rotateState; // kept for prop compatibility, cursor is now ROTATE_CURSOR (MS Word style)
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

  return (
    <>
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
        rubberBandHighlightedIds={rubberBandHighlightedIds}
        hoveredLayerId={activeTool === "move" ? hoveredLayerId : null}
        hideSelectionOutlineForId={showResizeOverlay ? selectedId : null}
        showEditPoints={activeTool === "move" && selectedProps?.type === "path"}
        selectedVertex={activeTool === "move" ? selectedVertex : null}
        previewAnimation={previewAnimation}
        scrubTime={scrubTime}
        frameSize={frameSize}
        onElementMouseDown={onElementMouseDown}
        onElementDoubleClick={onElementDoubleClick}
        onElementHover={onElementHover}
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
            style={{ cursor: ROTATE_CURSOR }}
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

      <DragPreviews rubberBandState={rubberBandState} textDragState={textDragState} shapeDragState={shapeDragState} pathDragState={pathDragState} />

      {/* Smart alignment guides */}
      {snapGuideLines.length > 0 && (
        <g className="snap-guides pointer-events-none">
          {snapGuideLines.map((guide, i) =>
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

      {editingOverlay}
    </>
  );
}

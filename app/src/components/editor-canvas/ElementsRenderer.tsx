import type { LayerType } from "../../context/EditorContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TextElementProperties {
  type: "text";
  x: number;
  y: number;
  width: number | "auto";
  height: number;
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  textAlign: "left" | "center" | "right";
}

export type ShapeKind = "rect" | "circle" | "triangle" | "star" | "hexagon" | "line";

export interface ShapeElementProperties {
  type: "shape";
  kind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  /** Rotation in degrees around the shape's own center (0–360). */
  rotation?: number;
}

/** Union of all element property types */
export type ElementProperties = TextElementProperties | ShapeElementProperties;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEXT_ANCHOR_MAP: Record<string, "start" | "middle" | "end"> = {
  left: "start",
  center: "middle",
  right: "end",
};

/**
 * Build a bounding box rect for a text element.
 * This is a rough estimation since we don't have canvas text metrics in SVG.
 */
function getTextBoundingBox(props: TextElementProperties) {
  const charWidth = props.fontSize * 0.6;
  let textWidth: number;
  let textHeight: number;

  if (props.width === "auto") {
    textWidth = Math.max(props.content.length * charWidth, 20);
    textHeight = props.fontSize * 1.4;
  } else {
    textWidth = props.width;
    textHeight = props.height;
  }

  let offsetX = 0;
  if (props.textAlign === "center") offsetX = -textWidth / 2;
  if (props.textAlign === "right") offsetX = -textWidth;

  return {
    x: props.x + offsetX - 4,
    y: props.y - props.fontSize * 0.85,
    width: textWidth + 8,
    height: textHeight + 4,
  };
}

/** Bounding box for a shape element (same coords as the shape itself). */
function getShapeBoundingBox(props: ShapeElementProperties) {
  return { x: props.x, y: props.y, width: props.width, height: props.height };
}

/** Returns bounding box for any element type — used for rubber-band selection */
export function getElementBoundingBox(props: ElementProperties) {
  if (props.type === "text") return getTextBoundingBox(props);
  return getShapeBoundingBox(props);
}

// ── Triangle path helper ────────────────────────────────────────────────────
function trianglePath(x: number, y: number, w: number, h: number): string {
  return `M ${x + w / 2} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
}

// ── Star path helper (5-pointed star) ──────────────────────────────────────
function starPath(x: number, y: number, w: number, h: number): string {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const outerR = Math.min(w, h) / 2;
  const innerR = outerR * 0.4;
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return `M ${points.join(" L ")} Z`;
}

// ── Hexagon path helper ─────────────────────────────────────────────────────
function hexagonPath(x: number, y: number, w: number, h: number): string {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    points.push(
      `${cx + rx * Math.cos(angle)},${cy + ry * Math.sin(angle)}`,
    );
  }
  return `M ${points.join(" L ")} Z`;
}

// ─── Element Renderers ───────────────────────────────────────────────────────

function TextElement({
  properties,
  isSelected,
  isRubberBandHighlighted,
  isEditing,
}: {
  properties: TextElementProperties;
  isSelected: boolean;
  isRubberBandHighlighted?: boolean;
  isEditing?: boolean;
}) {
  const anchor = TEXT_ANCHOR_MAP[properties.textAlign] ?? "start";
  let offsetX = 0;
  if (anchor === "middle") offsetX = 0;
  if (anchor === "end") offsetX = 0;

  const bb = getTextBoundingBox(properties);
  const showHighlight = isSelected || isRubberBandHighlighted;

  return (
    <g className="canvas-element" data-layer-type="text">
      {showHighlight && (
        <rect
          x={bb.x}
          y={bb.y}
          width={bb.width}
          height={bb.height}
          fill={
            isRubberBandHighlighted && !isSelected
              ? "rgba(59,130,246,0.08)"
              : "none"
          }
          stroke={
            isRubberBandHighlighted && !isSelected ? "#60a5fa" : "#3b82f6"
          }
          strokeWidth={isRubberBandHighlighted && !isSelected ? 1 : 1}
          strokeDasharray={
            isRubberBandHighlighted && !isSelected ? "3 2" : undefined
          }
          rx={2}
          className="pointer-events-none"
        />
      )}
      {/* Hide the SVG text while editing — TextOverlay handles display */}
      {!isEditing && (
        <>
          <text
            x={properties.x + offsetX}
            y={properties.y}
            fontFamily={properties.fontFamily}
            fontSize={properties.fontSize}
            fontWeight={properties.fontWeight}
            fill={properties.color}
            textAnchor={anchor}
          >
            {properties.content}
          </text>
          {/* Invisible hit area for easier selection */}
          {/* Cursor is inherited from the parent SVG — no cursor override here
              so the Move Tool shows a default/grab cursor, not a pointer. */}
          <rect
            x={bb.x}
            y={bb.y}
            width={bb.width}
            height={bb.height}
            fill="transparent"
          />
        </>
      )}
    </g>
  );
}

function ShapeElement({
  properties,
  isSelected,
  isRubberBandHighlighted,
}: {
  properties: ShapeElementProperties;
  isSelected: boolean;
  isRubberBandHighlighted?: boolean;
}) {
  const { kind, x, y, width, height, fill, stroke, strokeWidth, opacity, rotation } =
    properties;
  const showHighlight = isSelected || isRubberBandHighlighted;

  const selectionStroke = isRubberBandHighlighted && !isSelected ? "#60a5fa" : "#3b82f6";
  const selectionDash = isRubberBandHighlighted && !isSelected ? "3 2" : undefined;
  const selectionFill = isRubberBandHighlighted && !isSelected ? "rgba(59,130,246,0.08)" : "none";

  // Center of the bounding box — used as the rotation origin
  const cx = x + width / 2;
  const cy = y + height / 2;
  const rotateTransform =
    rotation ? `rotate(${rotation}, ${cx}, ${cy})` : undefined;

  // Render the actual shape
  let shapeEl: React.ReactNode;
  let hitEl: React.ReactNode;

  if (kind === "rect") {
    shapeEl = (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={opacity}
        rx={4}
      />
    );
    hitEl = <rect x={x} y={y} width={width} height={height} fill="transparent" />;
  } else if (kind === "circle") {
    const rx = width / 2;
    const ry = height / 2;
    shapeEl = (
      <ellipse
        cx={x + rx}
        cy={y + ry}
        rx={rx}
        ry={ry}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={opacity}
      />
    );
    hitEl = <rect x={x} y={y} width={width} height={height} fill="transparent" />;
  } else if (kind === "triangle") {
    shapeEl = (
      <path
        d={trianglePath(x, y, width, height)}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={opacity}
      />
    );
    hitEl = <rect x={x} y={y} width={width} height={height} fill="transparent" />;
  } else if (kind === "star") {
    shapeEl = (
      <path
        d={starPath(x, y, width, height)}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={opacity}
      />
    );
    hitEl = <rect x={x} y={y} width={width} height={height} fill="transparent" />;
  } else if (kind === "hexagon") {
    shapeEl = (
      <path
        d={hexagonPath(x, y, width, height)}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={opacity}
      />
    );
    hitEl = <rect x={x} y={y} width={width} height={height} fill="transparent" />;
  } else if (kind === "line") {
    const midY = y + height / 2;
    shapeEl = (
      <line
        x1={x}
        y1={midY}
        x2={x + width}
        y2={midY}
        stroke={stroke || fill}
        strokeWidth={Math.max(strokeWidth, 2)}
        opacity={opacity}
      />
    );
    hitEl = (
      <rect
        x={x}
        y={midY - 6}
        width={width}
        height={12}
        fill="transparent"
      />
    );
  } else {
    shapeEl = null;
    hitEl = null;
  }

  return (
    <g
      className="canvas-element"
      data-layer-type="shape"
      transform={rotateTransform}
    >
      {shapeEl}
      {hitEl}
      {showHighlight && (
        <rect
          x={x - 2}
          y={y - 2}
          width={width + 4}
          height={height + 4}
          fill={selectionFill}
          stroke={selectionStroke}
          strokeWidth={1}
          strokeDasharray={selectionDash}
          rx={2}
          className="pointer-events-none"
        />
      )}
    </g>
  );
}

// ─── Main Renderer ───────────────────────────────────────────────────────────

interface ElementsRendererProps {
  layers: LayerType[];
  elementProperties: Record<string, ElementProperties>;
  /** Single selected layer ID (legacy — prefer selectedLayerIds) */
  selectedLayerId?: string | null;
  /** Multi-selection: all selected layer IDs.
   *  When provided, each layer whose ID is in this array gets a selection highlight.
   *  Falls back to selectedLayerId for backward compatibility. */
  selectedLayerIds?: string[];
  /** Currently being edited — hide selection overlay for this one */
  editingLayerId?: string | null;
  /** IDs of layers highlighted during an active rubber-band selection. */
  rubberBandHighlightedIds?: string[];
  /** Called when an element is mousedown'd for selection/drag */
  onElementMouseDown: (e: React.MouseEvent, layerId: string) => void;
  /** Called when an element is mousedown'd for text editing */
  onElementDoubleClick?: (e: React.MouseEvent, layerId: string) => void;
}

export default function ElementsRenderer({
  layers,
  elementProperties,
  selectedLayerId,
  selectedLayerIds,
  editingLayerId,
  rubberBandHighlightedIds,
  onElementMouseDown,
  onElementDoubleClick,
}: ElementsRendererProps) {
  // Compute the set of selected IDs — prefer selectedLayerIds if provided,
  // otherwise fall back to the legacy single selectedLayerId
  const selectedSet = new Set(
    selectedLayerIds ?? (selectedLayerId ? [selectedLayerId] : []),
  );

  // Compute the set of rubber-band highlighted IDs
  const rubberBandSet = new Set(rubberBandHighlightedIds ?? []);

  // Only render visible layers that have properties
  const visibleLayers = layers.filter(
    (l) => l.visible && elementProperties[l.id],
  );

  return (
    <>
      {visibleLayers.map((layer) => {
        const props = elementProperties[layer.id];
        const isSelected =
          selectedSet.has(layer.id) && editingLayerId !== layer.id;
        const isRubberBandHighlighted =
          rubberBandSet.has(layer.id) && !selectedSet.has(layer.id);
        const isEditing = editingLayerId === layer.id;

        if (!props) return null;

        return (
          <g
            key={layer.id}
            data-layer-id={layer.id}
            onMouseDown={(e) => onElementMouseDown(e, layer.id)}
            onDoubleClick={(e) => onElementDoubleClick?.(e, layer.id)}
            style={{ pointerEvents: isEditing ? "none" : undefined }}
          >
            {props.type === "text" ? (
              <TextElement
                properties={props}
                isSelected={isSelected}
                isRubberBandHighlighted={isRubberBandHighlighted}
                isEditing={isEditing}
              />
            ) : (
              <ShapeElement
                properties={props}
                isSelected={isSelected}
                isRubberBandHighlighted={isRubberBandHighlighted}
              />
            )}
          </g>
        );
      })}
    </>
  );
}

export { getTextBoundingBox, getShapeBoundingBox };

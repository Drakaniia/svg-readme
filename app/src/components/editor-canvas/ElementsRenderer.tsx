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
  /** Text foreground color (hex). Maps to SVG <text fill="...">. */
  color: string;
  /** Text box background fill (hex). When set, renders a filled rect behind the text.
   *  Undefined or empty string means no background. Open-pencil equivalent: fills on a rect. */
  backgroundColor?: string;
  textAlign: "left" | "center" | "right";
}

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
      {/* Background fill rect — rendered behind text, visible even while editing */}
      {properties.backgroundColor && (
        <rect
          x={bb.x}
          y={bb.y}
          width={bb.width}
          height={bb.height}
          fill={properties.backgroundColor}
          rx={3}
          className="pointer-events-none"
        />
      )}
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

// ─── Main Renderer ───────────────────────────────────────────────────────────

interface ElementsRendererProps {
  layers: LayerType[];
  elementProperties: Record<string, TextElementProperties>;
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
            <TextElement
              properties={props}
              isSelected={isSelected}
              isRubberBandHighlighted={isRubberBandHighlighted}
              isEditing={isEditing}
            />
          </g>
        );
      })}
    </>
  );
}

export { getTextBoundingBox };

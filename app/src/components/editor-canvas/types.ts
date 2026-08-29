import type { LayerType, EditorTool } from "../../context/EditorContext";
import type { TextElementProperties, ElementProperties, ShapeKind, PathElementProperties } from "./ElementsRenderer";
import type { PathVertexHandle } from "../../lib/editor/pathUtils";
import type { Viewport } from "../../lib/editor/geometry";

// ─── Constants ────────────────────────────────────────────────────────────────

export const MIN_TEXTBOX_SIZE = 20;
export const MIN_SHAPE_SIZE = 10;

/** Default textbox size matching Open Pencil's DEFAULT_TEXT_WIDTH / DEFAULT_TEXT_HEIGHT */
export const DEFAULT_TEXT_WIDTH = 200;
export const DEFAULT_TEXT_HEIGHT = 24;

export const DEFAULT_TEXT_PROPS: Omit<
  TextElementProperties,
  "x" | "y" | "content"
> = {
  type: "text",
  width: "auto",
  height: DEFAULT_TEXT_HEIGHT,
  fontFamily: "Inter",
  fontSize: 14,
  fontWeight: 400,
  color: "#ffffff",
  backgroundColor: undefined,
  textAlign: "left",
  textAlignVertical: "top",
  textAutoResize: "WIDTH_AND_HEIGHT",
  lineHeight: undefined,
  letterSpacing: 0,
  italic: false,
  textDecoration: "NONE",
  textCase: "ORIGINAL",
};

/** Tool IDs that are shape-placement tools */
export const SHAPE_TOOLS = new Set<EditorTool>([
  "rect",
  "circle",
  "triangle",
  "star",
  "hexagon",
  "line",
]);

/** Map from a shape EditorTool to its ShapeKind */
export function toolToShapeKind(tool: EditorTool): ShapeKind | null {
  if (
    tool === "rect" ||
    tool === "circle" ||
    tool === "triangle" ||
    tool === "star" ||
    tool === "hexagon" ||
    tool === "line"
  ) {
    return tool;
  }
  return null;
}

// ─── Drag types ───────────────────────────────────────────────────────────────

/** State for dragging an element on the canvas */
export interface DragState {
  elementId: string;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  /** Initial positions of ALL selected layers when multi-drag starts.
   *  When present, dragging moves every layer in this map by the delta.
   *  Only populated when the clicked layer is part of a multi-selection. */
  multiStartPositions?: Record<string, { x: number; y: number }>;
}

/** State for dragging to create a text box */
export interface TextDragState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

/** State for dragging to create a shape */
export interface ShapeDragState {
  kind: ShapeKind;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

/** State for rubber-band / marquee selection on empty canvas. */
export interface RubberBandState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  /** Whether Shift was held when the drag started — if true, adds to existing selection. */
  addToExisting: boolean;
}

/** State for resizing an element (or a multi-selection as a unit, B3) */
export interface ResizeState {
  elementId: string;
  handle: "tl" | "tc" | "tr" | "ml" | "mr" | "bl" | "bc" | "br";
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
  initialWidth: number;
  initialHeight: number;
  /** Multi-select resize: all selected ids + their original boxes + the
   *  original selection bounds. When present, every element is proportionally
   *  remapped through the old → new selection bounds. */
  selectionIds?: string[];
  initialBoxes?: Record<string, { x: number; y: number; width: number; height: number }>;
  initialSelectionBounds?: { x: number; y: number; width: number; height: number };
}

/** State for rotating an element (or a multi-selection as a unit, B3) */
export interface RotateState {
  elementId: string;
  /** Center of the shape's bounding box in SVG coordinates */
  centerX: number;
  centerY: number;
  /** Angle (degrees) from center to mousedown point */
  startAngle: number;
  /** Shape's rotation before the drag started */
  initialRotation: number;
  /** Multi-select rotate: all selected ids + their pre-drag rotations. The
   *  same angle delta is applied to every element around the selection center. */
  selectionIds?: string[];
  initialRotations?: Record<string, number>;
}

/** State for pen tool path building (click-to-place).
 *  Supports both click-to-place anchor points and freehand drawing.
 *  When isBuilding is false and points exist, the path is ready to finalize. */
export interface PathDragState {
  /** Placed anchor vertices (in world coords). Always contains at least 1 point. */
  points: [number, number][];
  /** Per-vertex bezier handles (parallel to points). Absent → all-straight path. */
  handles?: (PathVertexHandle | undefined)[];
  /** Index of the vertex whose bezier handle is currently being pulled out
   *  (click-drag placement). Cleared on mouseup. */
  pendingHandleVertex?: number;
  /** Current position of the handle being pulled, while the button is held. */
  pendingHandlePoint?: [number, number];
  /** Whether the handle pull has exceeded the corner→smooth drag threshold. */
  pendingHandleMoved?: boolean;
  /** Current mouse position for the rubber-band preview line from the last vertex. */
  previewPoint: [number, number] | null;
  /** Whether the user is actively building a path (click-to-place mode).
   *  When true, mouseup does NOT finalize — user must close/dblclick/Enter. */
  isBuilding: boolean;
  /** Whether the path should be closed (last point connects to first). */
  closed: boolean;
}

// ─── Props ────────────────────────────────────────────────────────────────────

/** Props for the Canvas component */
export interface CanvasProps {
  frameSize: { width: number; height: number };
  activeTool: EditorTool;
  layers: LayerType[];
  selectedLayerId: string | null;
  selectedLayerIds: string[];
  isEditingText: boolean;
  elementProperties: Record<string, ElementProperties>;
  /** Called when user clicks on canvas (text tool) to create text */
  onCreateText: (
    x: number,
    y: number,
    width: number | "auto",
    height: number,
  ) => void;
  /** Called when user drags on canvas (shape tool) to place a shape */
  onCreateShape: (
    kind: ShapeKind,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
  /** Called when user finishes drawing a path (pen tool) */
  onCreatePath: (props: Omit<PathElementProperties, "type">) => void;
  /** Called when the paint bucket tool paints a layer with the current color. */
  onPaintLayer: (layerId: string, color: string) => void;
  /** Color selected for the paint bucket tool. */
  paintColor?: string;
  /** Called when an element is selected */
  onSelectLayer: (id: string | null) => void;
  /** Called when an element is clicked with Shift held — toggles multi-select.
   *  If not provided, falls back to onSelectLayer. */
  onShiftSelectLayer?: (id: string) => void;
  /** Called when empty canvas is clicked — clears all selection.
   *  If not provided, falls back to onSelectLayer(null). */
  onClearSelection?: () => void;
  /** Called when rubber-band selection completes.
   *  ids: the layer IDs within the selection area.
   *  addToExisting: if true, adds to current selection; otherwise replaces it. */
  onRubberBandSelect?: (ids: string[], addToExisting: boolean) => void;
  /** Called once when a move drag begins, before positions change. */
  onMoveStart?: () => void;
  /** Called when an element is dragged to a new position */
  onMoveElement: (id: string, x: number, y: number) => void;
  /** Called when an element begins resizing */
  onResizeStart?: () => void;
  /** Called when an element is resized */
  onResizeElement?: (
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
  /** Called when an element begins rotating */
  onRotateStart?: () => void;
  /** Called when a shape is rotated via the rotate handle */
  onRotateElement?: (id: string, rotation: number) => void;
  /** Called when editing state changes */
  onEditingChange: (editing: boolean) => void;
  /** Called when user wants to edit existing text */
  onEditText: (layerId: string) => void;
  /** Content of the currently-being-edited text */
  editingContent?: string;
  /** Which layer is currently being edited */
  editingLayerId?: string | null;
  /** Called when editing content changes */
  onEditingContentChange?: (content: string) => void;
  /** Called when editing commits */
  onCommitText?: () => void;
  /** Current canvas viewport transform. Defaults to an untransformed canvas. */
  viewport?: Viewport;
  /** Called when pan or zoom changes. */
  onViewportChange?: (viewport: Viewport) => void;
  /** Show a world-space grid behind the artwork. */
  gridEnabled?: boolean;
  /** Snap moved layers to the configured grid. */
  snapEnabled?: boolean;
  gridSize?: number;
  /** Currently selected path node (move tool node editing). Passed to ElementsRenderer. */
  selectedVertex?: { layerId: string; index: number } | null;
  /** When true, previews CSS animations on elements that have an animation config. */
  previewAnimation?: boolean;
  /** When set, pauses animations at this time position (scrub mode). */
  scrubTime?: number | null;

  children?: React.ReactNode;
}

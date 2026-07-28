import type { LayerType, EditorTool } from "../../context/EditorContext";
import type { TextElementProperties } from "./ElementsRenderer";

// ─── Constants ────────────────────────────────────────────────────────────────

export const MIN_TEXTBOX_SIZE = 20;

export const DEFAULT_TEXT_PROPS: Omit<
  TextElementProperties,
  "x" | "y" | "content"
> = {
  type: "text",
  width: "auto",
  height: 30,
  fontFamily: "Poppins",
  fontSize: 16,
  fontWeight: 400,
  color: "#ffffff",
  backgroundColor: undefined,
  textAlign: "left",
};

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

/** State for rubber-band / marquee selection on empty canvas. */
export interface RubberBandState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  /** Whether Shift was held when the drag started — if true, adds to existing selection. */
  addToExisting: boolean;
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
  elementProperties: Record<string, TextElementProperties>;
  /** Called when user clicks on canvas (text tool) to create text */
  onCreateText: (
    x: number,
    y: number,
    width: number | "auto",
    height: number,
  ) => void;
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
  /** Called when an element is dragged to a new position */
  onMoveElement: (id: string, x: number, y: number) => void;
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

  children?: React.ReactNode;
}

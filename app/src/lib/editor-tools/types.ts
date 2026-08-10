import type React from "react";
import type { ElementProperties } from "../../components/editor-canvas/ElementsRenderer";
import type { Viewport, Point, SnapGuideLine } from "../editor/geometry";
import type {
  DragState,
  TextDragState,
  ShapeDragState,
  RubberBandState,
  ResizeState,
  RotateState,
  PathDragState,
} from "../../components/editor-canvas/types";

/**
 * Read-only context passed into every tool handler method so tools remain
 * pure functions that compute next state without holding their own closures.
 */
export interface ToolEventContext {
  /** Event that triggered the handler. */
  event: React.MouseEvent;

  /** Current cursor position in world (SVG) coordinates. */
  worldPoint: Point;

  /** Current cursor position in screen (client) coordinates. */
  screenPoint: Point;

  /** The ID of the currently singly-selected element, if any. */
  selectedId: string | null;

  /** All currently selected element IDs. */
  selectedLayerIds: string[];

  /** Properties of the singly-selected element, if one exists. */
  selectedProps: ElementProperties | null;

  /** Map of all element properties (used for multi-drag lookups). */
  elementProperties: Record<string, ElementProperties>;

  /** Whether any element is currently being text-edited. */
  isEditingText: boolean;

  /** Current viewport state. */
  viewport: Viewport;

  /** Whether grid snapping is enabled. */
  snapEnabled: boolean;

  /** Grid cell size in world units. */
  gridSize: number;

  /** Whether Shift was held during the mousedown that started the interaction. */
  shiftKey: boolean;

  /** Whether Alt was held during the mousedown that started the interaction. */
  altKey: boolean;
}

/** State for editing an individual path point in move tool. */
export interface PathEditState {
  elementId: string;
  pointIndex: number;
}

/** State for PanZoomHandler (pan/zoom tool). */
export interface PanState {
  startX: number;
  startY: number;
  initialPanX: number;
  initialPanY: number;
}

/**
 * Union of all tool-level interaction states managed by Canvas.
 * Each tool contributes a subset of these states.
 */
export interface ToolInteractionState {
  dragState: DragState | null;
  textDragState: TextDragState | null;
  shapeDragState: ShapeDragState | null;
  rubberBandState: RubberBandState | null;
  rubberBandHighlightedIds: string[];
  resizeState: ResizeState | null;
  rotateState: RotateState | null;
  panState: PanState | null;
  /** Freehand pen drawing state. */
  pathDragState: PathDragState | null;
  /** Path point editing state (move tool, dragging a single vertex). */
  pathEditState: PathEditState | null;
  /** Smart alignment guide lines to render during drag/resize. */
  snapGuideLines: SnapGuideLine[];
}

/** Default tool interaction state with nothing active. */
export function defaultToolState(): ToolInteractionState {
  return {
    dragState: null,
    textDragState: null,
    shapeDragState: null,
    rubberBandState: null,
    rubberBandHighlightedIds: [],
    resizeState: null,
    rotateState: null,
    panState: null,
    pathDragState: null,
    pathEditState: null,
    snapGuideLines: [],
  };
}

/**
 * A tool handler object. Canvas invokes these methods at the right phase
 * and each tool returns the interaction state fields it cares about.
 * When a tool returns nothing, the Canvas keeps the previous state.
 */
export interface ToolHandler {
  /** Called on canvas-level mousedown (empty area click). */
  onCanvasMouseDown?: (ctx: ToolEventContext) => Partial<ToolInteractionState> | void;

  /** Called on element-level mousedown (clicking a rendered layer). */
  onElementMouseDown?: (ctx: ToolEventContext, layerId: string) => Partial<ToolInteractionState> | void;

  /** Called on mousemove while this tool is active. */
  onMouseMove?: (ctx: ToolEventContext, state: ToolInteractionState) => Partial<ToolInteractionState> | void;

  /** Called on mouseup while this tool is active. */
  onMouseUp?: (ctx: ToolEventContext, state: ToolInteractionState) => Partial<ToolInteractionState> | void;

  /** Returns the CSS cursor value for this tool in its current state. */
  getCursor?: (state: ToolInteractionState) => string;

  /** Whether this tool shows resize/rotate handles for the selected element. */
  showResizeOverlay?: boolean;
}

export type ToolEntry = {
  handler: ToolHandler;
};

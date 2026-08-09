import {
  EditorProvider,
  useEditor,
  type EditorState,
} from "../../../context/EditorContext";
import type { LayerType } from "../../../context/EditorContext";
import type { TextElementProperties } from "../../../components/editor-canvas/ElementsRenderer";
import { render } from "@testing-library/react";

// ─── Shared Helpers ─────────────────────────────────────────────────────────

/**
 * Track the current layer counter so each "Add Layer" call gets a unique ID.
 * We use a ref-like module variable because we need to reset in between tests.
 */
let _layerCounter = 0;
export function resetLayerCounter() {
  _layerCounter = 0;
  localStorage.clear();
}
export function nextLayerId(): string {
  _layerCounter += 1;
  return `layer-${_layerCounter}`;
}

/** Factory for a minimal text layer */
export function makeLayer(
  id: string,
  overrides?: Partial<LayerType>,
): LayerType {
  return {
    id,
    name: `Layer ${id}`,
    type: "text",
    locked: false,
    visible: true,
    active: false,
    ...overrides,
  };
}

/** Factory for text element properties */
export function makeTextProps(
  overrides?: Partial<TextElementProperties>,
): TextElementProperties {
  return {
    type: "text",
    x: 100,
    y: 100,
    width: "auto",
    height: 30,
    content: "Hello",
    fontFamily: "Poppins",
    fontSize: 16,
    fontWeight: 400,
    color: "#ffffff",
    textAlign: "left",
    textAlignVertical: "top",
    ...overrides,
  };
}

// ─── Test Consumer ────────────────────────────────────────────────────────────

export function renderWithProvider(
  ui: React.ReactElement,
  initial?: Partial<EditorState>,
) {
  return render(<EditorProvider initial={initial}>{ui}</EditorProvider>);
}

export function MoveToolTestConsumer() {
  const ctx = useEditor();
  return (
    <div>
      <span data-testid="activeTool">{ctx.activeTool}</span>
      <span data-testid="isEditingText">{String(ctx.isEditingText)}</span>
      <span data-testid="selectedLayerId">{ctx.selectedLayerId ?? "null"}</span>
      <span data-testid="selectedLayerType">
        {ctx.selectedLayerId
          ? (ctx.layers.find((l) => l.id === ctx.selectedLayerId)?.type ?? "?")
          : "none"}
      </span>
      <span data-testid="layersCount">{ctx.layers.length}</span>
      <span data-testid="isProjectActive">{String(ctx.isProjectActive)}</span>

      {/* Move Tool actions — simulate Figma Move Tool behavior */}
      <button
        data-testid="setActiveTool-move"
        onClick={() => ctx.setActiveTool("move")}
      >
        Set Move
      </button>
      <button
        data-testid="setActiveTool-text"
        onClick={() => ctx.setActiveTool("text")}
      >
        Set Text
      </button>
      <button
        data-testid="clickEmptyCanvas"
        onClick={() => ctx.setSelectedLayerId(null)}
      >
        Click Empty Canvas
      </button>

      {/* Add a new layer with unique auto-incrementing ID */}
      <button
        data-testid="addLayer"
        onClick={() => {
          const id = nextLayerId();
          ctx.setLayers((prev) => [...prev, makeLayer(id)]);
        }}
      >
        Add Layer
      </button>

      {/* Add two layers in one click for multi-layer test setup */}
      <button
        data-testid="addTwoLayers"
        onClick={() => {
          ctx.setLayers((prev) => [
            ...prev,
            makeLayer(nextLayerId()),
            makeLayer(nextLayerId()),
          ]);
        }}
      >
        Add Two Layers
      </button>

      {/* Select first/second layer (for switching selection tests) */}
      <button
        data-testid="selectFirstLayer"
        onClick={() => {
          const first = ctx.layers[0];
          if (first) ctx.setSelectedLayerId(first.id);
        }}
      >
        Select First Layer
      </button>
      <button
        data-testid="selectSecondLayer"
        onClick={() => {
          const second = ctx.layers[1];
          if (second) ctx.setSelectedLayerId(second.id);
        }}
      >
        Select Second Layer
      </button>

      {/* Double-click: selects the _first_ layer and enters edit mode */}
      <button
        data-testid="doubleClickLayer"
        onClick={() => {
          const first = ctx.layers[0];
          if (first) {
            ctx.setSelectedLayerId(first.id);
            ctx.setIsEditingText(true);
          }
        }}
      >
        Double Click Layer
      </button>

      {/* Enter / exit text edit mode for the selected layer */}
      <button
        data-testid="enterEditMode"
        onClick={() => {
          const first = ctx.layers[0];
          if (first) {
            ctx.setSelectedLayerId(first.id);
            ctx.setIsEditingText(true);
          }
        }}
      >
        Enter Text Edit Mode
      </button>
      <button
        data-testid="exitEditMode"
        onClick={() => {
          ctx.setIsEditingText(false);
        }}
      >
        Exit Text Edit Mode
      </button>
    </div>
  );
}

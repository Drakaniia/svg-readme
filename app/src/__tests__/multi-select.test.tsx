import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  EditorProvider,
  useEditor,
  type EditorState,
  type LayerType,
} from "../context/EditorContext";
import ElementsRenderer from "../components/editor-canvas/ElementsRenderer";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderWithProvider(
  ui: React.ReactElement,
  initial?: Partial<EditorState>,
) {
  return render(<EditorProvider initial={initial}>{ui}</EditorProvider>);
}

function makeLayer(id: string, overrides?: Partial<LayerType>): LayerType {
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

// ─── Test Consumer ────────────────────────────────────────────────────────────

function MultiSelectTestConsumer() {
  const ctx = useEditor();
  return (
    <div>
      <span data-testid="selectedLayerIds">
        {ctx.selectedLayerIds.length > 0
          ? ctx.selectedLayerIds.join(",")
          : "(none)"}
      </span>
      <span data-testid="layersCount">{ctx.layers.length}</span>

      {/* Add layers */}
      <button
        data-testid="addLayer1"
        onClick={() => ctx.setLayers((prev) => [...prev, makeLayer("layer-1")])}
      >
        Add Layer 1
      </button>
      <button
        data-testid="addLayer2"
        onClick={() => ctx.setLayers((prev) => [...prev, makeLayer("layer-2")])}
      >
        Add Layer 2
      </button>
      <button
        data-testid="addLayer3"
        onClick={() => ctx.setLayers((prev) => [...prev, makeLayer("layer-3")])}
      >
        Add Layer 3
      </button>

      {/* Click on a layer without Shift (replaces selection) */}
      <button
        data-testid="clickLayer1"
        onClick={() => ctx.selectLayer("layer-1", false)}
      >
        Click Layer 1
      </button>
      <button
        data-testid="clickLayer2"
        onClick={() => ctx.selectLayer("layer-2", false)}
      >
        Click Layer 2
      </button>
      <button
        data-testid="clickLayer3"
        onClick={() => ctx.selectLayer("layer-3", false)}
      >
        Click Layer 3
      </button>

      {/* Shift+click on a layer (toggles in multi-select) */}
      <button
        data-testid="shiftClickLayer1"
        onClick={() => ctx.selectLayer("layer-1", true)}
      >
        Shift+Click Layer 1
      </button>
      <button
        data-testid="shiftClickLayer2"
        onClick={() => ctx.selectLayer("layer-2", true)}
      >
        Shift+Click Layer 2
      </button>
      <button
        data-testid="shiftClickLayer3"
        onClick={() => ctx.selectLayer("layer-3", true)}
      >
        Shift+Click Layer 3
      </button>

      {/* Click empty canvas (clears all) */}
      <button
        data-testid="clickEmptyCanvas"
        onClick={() => ctx.clearSelection()}
      >
        Click Empty Canvas
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Shift+Click Multi-Select Tests (Figma reference)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Shift+click multi-select (Figma reference)", () => {
  // Figma: Shift+click an unselected layer adds it to the selection
  it("Shift+click on unselected layer adds it to selection (both selected)", () => {
    renderWithProvider(<MultiSelectTestConsumer />);

    // Add two layers
    act(() => screen.getByTestId("addLayer1").click());
    act(() => screen.getByTestId("addLayer2").click());

    // Select layer-1 (normal click, no shift)
    act(() => screen.getByTestId("clickLayer1").click());
    expect(screen.getByTestId("selectedLayerIds").textContent).toBe("layer-1");

    // Shift+click layer-2 → both should be selected
    act(() => screen.getByTestId("shiftClickLayer2").click());
    expect(screen.getByTestId("selectedLayerIds").textContent).toContain(
      "layer-1",
    );
    expect(screen.getByTestId("selectedLayerIds").textContent).toContain(
      "layer-2",
    );
  });

  // Figma: Shift+click on an already-selected layer removes it
  it("Shift+click on already-selected layer removes it from selection", () => {
    renderWithProvider(<MultiSelectTestConsumer />);

    // Add two layers and select both
    act(() => screen.getByTestId("addLayer1").click());
    act(() => screen.getByTestId("addLayer2").click());
    act(() => screen.getByTestId("clickLayer1").click());
    act(() => screen.getByTestId("shiftClickLayer2").click());

    // Both should be selected initially
    expect(screen.getByTestId("selectedLayerIds").textContent).toContain(
      "layer-1",
    );
    expect(screen.getByTestId("selectedLayerIds").textContent).toContain(
      "layer-2",
    );

    // Shift+click layer-1 → it should be removed, only layer-2 remains
    act(() => screen.getByTestId("shiftClickLayer1").click());
    expect(screen.getByTestId("selectedLayerIds").textContent).not.toContain(
      "layer-1",
    );
    expect(screen.getByTestId("selectedLayerIds").textContent).toContain(
      "layer-2",
    );
  });

  // Figma: Click without Shift on a layer clears multi-select, selects only that layer
  it("click without Shift clears multi-select and selects only the clicked layer", () => {
    renderWithProvider(<MultiSelectTestConsumer />);

    // Add three layers and select layer-1 + layer-2 via shift
    act(() => screen.getByTestId("addLayer1").click());
    act(() => screen.getByTestId("addLayer2").click());
    act(() => screen.getByTestId("addLayer3").click());
    act(() => screen.getByTestId("clickLayer1").click());
    act(() => screen.getByTestId("shiftClickLayer2").click());

    // Both selected
    expect(screen.getByTestId("selectedLayerIds").textContent).toContain(
      "layer-1",
    );
    expect(screen.getByTestId("selectedLayerIds").textContent).toContain(
      "layer-2",
    );

    // Click layer-3 without Shift → should replace selection
    act(() => screen.getByTestId("clickLayer3").click());
    expect(screen.getByTestId("selectedLayerIds").textContent).not.toContain(
      "layer-1",
    );
    expect(screen.getByTestId("selectedLayerIds").textContent).not.toContain(
      "layer-2",
    );
    expect(screen.getByTestId("selectedLayerIds").textContent).toBe("layer-3");
  });

  // Figma: Clicking empty canvas clears all selection (including multi-select)
  it("click on empty canvas clears multi-selection", () => {
    renderWithProvider(<MultiSelectTestConsumer />);

    // Add two layers and select both
    act(() => screen.getByTestId("addLayer1").click());
    act(() => screen.getByTestId("addLayer2").click());
    act(() => screen.getByTestId("clickLayer1").click());
    act(() => screen.getByTestId("shiftClickLayer2").click());

    expect(screen.getByTestId("selectedLayerIds").textContent).toContain(
      "layer-1",
    );

    // Click empty canvas
    act(() => screen.getByTestId("clickEmptyCanvas").click());
    expect(screen.getByTestId("selectedLayerIds").textContent).toBe("(none)");
  });

  // Figma: No layer selected initially
  it("defaults selectedLayerIds to empty array", () => {
    renderWithProvider(<MultiSelectTestConsumer />);
    expect(screen.getByTestId("selectedLayerIds").textContent).toBe("(none)");
  });

  // Figma: Shift+click can toggle layers one by one
  it("can multi-select three layers by Shift+clicking each", () => {
    renderWithProvider(<MultiSelectTestConsumer />);

    act(() => screen.getByTestId("addLayer1").click());
    act(() => screen.getByTestId("addLayer2").click());
    act(() => screen.getByTestId("addLayer3").click());

    // Select layer-1 normally, then shift+click the other two
    act(() => screen.getByTestId("clickLayer1").click());
    act(() => screen.getByTestId("shiftClickLayer2").click());
    act(() => screen.getByTestId("shiftClickLayer3").click());

    const ids = screen.getByTestId("selectedLayerIds").textContent ?? "";
    const selected = ids.split(",").sort();
    expect(selected).toEqual(["layer-1", "layer-2", "layer-3"]);
  });

  // Figma: Shift+click on the only selected layer deselects everything
  it("Shift+click on the only selected layer deselects all", () => {
    renderWithProvider(<MultiSelectTestConsumer />);

    act(() => screen.getByTestId("addLayer1").click());
    act(() => screen.getByTestId("clickLayer1").click());
    expect(screen.getByTestId("selectedLayerIds").textContent).toBe("layer-1");

    // Shift+click the only selected layer → deselects it
    act(() => screen.getByTestId("shiftClickLayer1").click());
    expect(screen.getByTestId("selectedLayerIds").textContent).toBe("(none)");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ElementsRenderer — Multi-select highlights
// ═══════════════════════════════════════════════════════════════════════════════

describe("ElementsRenderer — multi-select highlights (Figma reference)", () => {
  it("renders blue selection rects for multiple selected layers", () => {
    const layers = [makeLayer("layer-1"), makeLayer("layer-2")];
    const elementProps = {
      "layer-1": {
        type: "text" as const,
        x: 100,
        y: 100,
        width: "auto" as const,
        height: 30,
        content: "Hello",
        fontFamily: "Poppins",
        fontSize: 16,
        fontWeight: 400,
        color: "#ffffff",
        textAlign: "left" as const,
        textAlignVertical: "top" as const,
      },
      "layer-2": {
        type: "text" as const,
        x: 200,
        y: 150,
        width: "auto" as const,
        height: 30,
        content: "World",
        fontFamily: "Poppins",
        fontSize: 16,
        fontWeight: 400,
        color: "#ffffff",
        textAlign: "left" as const,
        textAlignVertical: "top" as const,
      },
    };

    const { container } = render(
      <svg>
        <ElementsRenderer
          layers={layers}
          elementProperties={elementProps}
          selectedLayerIds={["layer-1", "layer-2"]}
          editingLayerId={null}
          onElementMouseDown={() => {}}
          onElementDoubleClick={() => {}}
        />
      </svg>,
    );

    // Both layers should have blue selection rects
    const selectionRects = container.querySelectorAll("rect[stroke='#3b82f6']");
    expect(selectionRects.length).toBe(2);
  });

  it("renders single selection rect when only one layer is selected", () => {
    const layers = [makeLayer("layer-1"), makeLayer("layer-2")];
    const elementProps = {
      "layer-1": {
        type: "text" as const,
        x: 100,
        y: 100,
        width: "auto" as const,
        height: 30,
        content: "Hello",
        fontFamily: "Poppins",
        fontSize: 16,
        fontWeight: 400,
        color: "#ffffff",
        textAlign: "left" as const,
        textAlignVertical: "top" as const,
      },
      "layer-2": {
        type: "text" as const,
        x: 200,
        y: 150,
        width: "auto" as const,
        height: 30,
        content: "World",
        fontFamily: "Poppins",
        fontSize: 16,
        fontWeight: 400,
        color: "#ffffff",
        textAlign: "left" as const,
        textAlignVertical: "top" as const,
      },
    };

    const { container } = render(
      <svg>
        <ElementsRenderer
          layers={layers}
          elementProperties={elementProps}
          selectedLayerIds={["layer-1"]}
          editingLayerId={null}
          onElementMouseDown={() => {}}
          onElementDoubleClick={() => {}}
        />
      </svg>,
    );

    const selectionRects = container.querySelectorAll("rect[stroke='#3b82f6']");
    expect(selectionRects.length).toBe(1);
  });
});

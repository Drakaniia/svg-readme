import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditorProvider } from "../../context/EditorContext";
import EditorRightBar from "../../components/ui/EditorRightBar";
import type { LayerType } from "../../context/EditorContext";
import type { ElementProperties } from "../../components/editor-canvas/ElementsRenderer";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function shapeLayer(id: string): LayerType {
  return { id, name: `Shape ${id}`, type: "shape", locked: false, visible: true };
}

function groupLayer(id: string): LayerType {
  return { id, name: "My Group", type: "group", locked: false, visible: true };
}

function shapeProps(_id: string, overrides?: Partial<ElementProperties>): ElementProperties {
  return {
    type: "shape",
    kind: "rect",
    x: 10,
    y: 10,
    width: 100,
    height: 50,
    fill: "#8b5cf6",
    stroke: "rgba(255,255,255,0.2)",
    strokeWidth: 1,
    opacity: 1,
    ...overrides,
  } as ElementProperties;
}

function textProps(_id: string): ElementProperties {
  return {
    type: "text",
    x: 10,
    y: 10,
    width: "auto",
    height: 24,
    content: "Hi",
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: 400,
    color: "#ffffff",
    textAlign: "left",
    textAlignVertical: "top",
  } as ElementProperties;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Multi-select property editing (B10)", () => {
  it("shows the multi-selection panel with bulk controls when 2+ layers are selected", () => {
    const layers = [shapeLayer("a"), shapeLayer("b")];
    const props = { a: shapeProps("a"), b: shapeProps("b") };

    render(
      <EditorProvider initial={{ layers, isProjectActive: true }}>
        <EditorRightBar
          selectedLayerIds={["a", "b"]}
          elementProperties={props}
          onBulkUpdateProperties={vi.fn()}
          frameSize={{ width: 800, height: 200 }}
        />
      </EditorProvider>,
    );

    expect(screen.getByText("Multiple Selection")).toBeDefined();
    expect(screen.getByText("2 layers selected")).toBeDefined();
    // Bulk opacity control present
    expect(screen.getByLabelText("Bulk opacity")).toBeDefined();
    expect(screen.getByLabelText("Bulk fill color")).toBeDefined();
    expect(screen.getByLabelText("Bulk stroke color")).toBeDefined();
  });

  it("applies bulk opacity changes to every selected layer", () => {
    const layers = [shapeLayer("a"), shapeLayer("b")];
    const props = { a: shapeProps("a"), b: shapeProps("b") };
    const onBulkUpdateProperties = vi.fn();

    render(
      <EditorProvider initial={{ layers, isProjectActive: true }}>
        <EditorRightBar
          selectedLayerIds={["a", "b"]}
          elementProperties={props}
          onBulkUpdateProperties={onBulkUpdateProperties}
        />
      </EditorProvider>,
    );

    fireEvent.change(screen.getByLabelText("Bulk opacity"), {
      target: { value: "0.5" },
    });
    expect(onBulkUpdateProperties).toHaveBeenCalledWith({ opacity: 0.5 });
  });

  it("shows a shared value when every selected layer agrees", () => {
    const layers = [shapeLayer("a"), shapeLayer("b")];
    const props = {
      a: shapeProps("a", { opacity: 0.25 }),
      b: shapeProps("b", { opacity: 0.25 }),
    };

    render(
      <EditorProvider initial={{ layers, isProjectActive: true }}>
        <EditorRightBar
          selectedLayerIds={["a", "b"]}
          elementProperties={props}
          onBulkUpdateProperties={vi.fn()}
        />
      </EditorProvider>,
    );

    expect((screen.getByLabelText("Bulk opacity") as HTMLInputElement).value).toBe("0.25");
  });

  it("shows a mixed placeholder when layers disagree", () => {
    const layers = [shapeLayer("a"), shapeLayer("b")];
    const props = {
      a: shapeProps("a", { opacity: 0.25 }),
      b: shapeProps("b", { opacity: 0.75 }),
    };

    render(
      <EditorProvider initial={{ layers, isProjectActive: true }}>
        <EditorRightBar
          selectedLayerIds={["a", "b"]}
          elementProperties={props}
          onBulkUpdateProperties={vi.fn()}
        />
      </EditorProvider>,
    );

    expect((screen.getByLabelText("Bulk opacity") as HTMLInputElement).value).toBe("");
  });

  it("shows font-size bulk control only when every selection is text", () => {
    const layers = [shapeLayer("a"), shapeLayer("b")];
    const props = { a: textProps("a"), b: textProps("b") };

    render(
      <EditorProvider initial={{ layers, isProjectActive: true }}>
        <EditorRightBar
          selectedLayerIds={["a", "b"]}
          elementProperties={props}
          onBulkUpdateProperties={vi.fn()}
        />
      </EditorProvider>,
    );

    expect(screen.getByLabelText("Bulk font size")).toBeDefined();
  });

  it("hides the type-specific flip control for text-only selections", () => {
    const layers = [shapeLayer("a"), shapeLayer("b")];
    const props = { a: textProps("a"), b: textProps("b") };

    render(
      <EditorProvider initial={{ layers, isProjectActive: true }}>
        <EditorRightBar
          selectedLayerIds={["a", "b"]}
          elementProperties={props}
          onBulkUpdateProperties={vi.fn()}
        />
      </EditorProvider>,
    );

    expect(screen.queryByTitle("Flip Horizontal (all selected)")).toBeNull();
  });
});

describe("Group selection panel (B10)", () => {
  it("shows combined bounds for a selected group", () => {
    const layers = [
      groupLayer("g1"),
      shapeLayer("c1"),
      shapeLayer("c2"),
    ].map((l, i) => (i > 0 ? { ...l, parentId: "g1" } : l));

    const props = {
      c1: shapeProps("c1", { x: 10, y: 20, width: 40, height: 30 }),
      c2: shapeProps("c2", { x: 100, y: 80, width: 20, height: 10 }),
    };

    render(
      <EditorProvider initial={{ layers, isProjectActive: true }}>
        <EditorRightBar
          selectedLayerIds={["g1"]}
          elementProperties={props}
          frameSize={{ width: 800, height: 200 }}
        />
      </EditorProvider>,
    );

    expect(screen.getByText("Group Bounds")).toBeDefined();
    // Combined bounds: x=10, y=20, w=110, h=70
    expect(screen.getByText("110")).toBeDefined();
    expect(screen.getByText("70")).toBeDefined();
    expect(screen.getByText(/Combined bounds of 2 child layers/)).toBeDefined();
  });

  it("enables align-to-frame for a single selection (B7)", () => {
    const layers = [shapeLayer("solo")];
    const props = { solo: shapeProps("solo") };
    const onMoveElement = vi.fn();

    render(
      <EditorProvider initial={{ layers, isProjectActive: true }}>
        <EditorRightBar
          selectedLayerIds={["solo"]}
          elementProperties={props}
          onMoveElement={onMoveElement}
          frameSize={{ width: 800, height: 200 }}
        />
      </EditorProvider>,
    );

    // Single-layer selection now has working align buttons against the frame.
    const leftBtn = screen.getByTitle("Left");
    expect(leftBtn).toBeDefined();
    expect((leftBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(leftBtn);
    // Shape is 100×50 at (10,10) → align left to frame x=0 moves it to x=0.
    expect(onMoveElement).toHaveBeenCalledWith("solo", 0, 10);
  });
});

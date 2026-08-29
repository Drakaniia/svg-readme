import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import Canvas from "../../components/editor-canvas/Canvas";
import type { CanvasProps } from "../../components/editor-canvas/types";
import type { ShapeElementProperties } from "../../components/editor-canvas/ElementsRenderer";

const mockShape: ShapeElementProperties = {
  type: "shape",
  kind: "rect",
  x: 50,
  y: 50,
  width: 100,
  height: 100,
  fill: "#8b5cf6",
  stroke: "rgba(255,255,255,0.2)",
  strokeWidth: 1,
  opacity: 1,
};

function makeProps(): CanvasProps {
  return {
    frameSize: { width: 800, height: 600 },
    activeTool: "paint",
    layers: [
      { id: "shape-1", name: "Rect", type: "shape", locked: false, visible: true, active: true },
    ],
    selectedLayerId: null,
    selectedLayerIds: [],
    isEditingText: false,
    elementProperties: { "shape-1": mockShape },
    onCreateText: vi.fn(),
    onCreateShape: vi.fn(),
    onSelectLayer: vi.fn(),
    onMoveElement: vi.fn(),
    onEditingChange: vi.fn(),
    onEditText: vi.fn(),
    onPaintLayer: vi.fn(),
  };
}

describe("Paint bucket tool", () => {
  it("paints a layer's element with the selected color on mousedown", () => {
    const props = makeProps();
    const { container } = render(<Canvas {...props} paintColor="#ff0000" />);
    const g = container.querySelector('[data-layer-id="shape-1"]');
    expect(g).not.toBeNull();
    fireEvent.mouseDown(g!, { button: 0 });
    expect(props.onPaintLayer).toHaveBeenCalledWith("shape-1", "#ff0000");
  });

  it("selects the painted layer", () => {
    const props = makeProps();
    const { container } = render(<Canvas {...props} paintColor="#ff0000" />);
    const g = container.querySelector('[data-layer-id="shape-1"]');
    fireEvent.mouseDown(g!, { button: 0 });
    expect(props.onSelectLayer).toHaveBeenCalledWith("shape-1");
  });

  it("does not paint the empty canvas", () => {
    const props = makeProps();
    const { container } = render(<Canvas {...props} paintColor="#ff0000" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    fireEvent.mouseDown(svg!, { button: 0 });
    expect(props.onPaintLayer).not.toHaveBeenCalled();
  });
});
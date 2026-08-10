import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import Canvas from "../../components/editor-canvas/Canvas";
import type { CanvasProps } from "../../components/editor-canvas/types";
import type { ShapeElementProperties } from "../../components/editor-canvas/ElementsRenderer";

const mockShapeProps: ShapeElementProperties = {
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

const defaultProps: CanvasProps = {
  frameSize: { width: 800, height: 600 },
  activeTool: "move",
  layers: [
    {
      id: "shape-1",
      name: "Rectangle",
      type: "shape",
      locked: false,
      visible: true,
      active: true,
    },
  ],
  selectedLayerId: "shape-1",
  selectedLayerIds: ["shape-1"],
  isEditingText: false,
  elementProperties: {
    "shape-1": mockShapeProps,
  },
  onCreateText: vi.fn(),
  onCreateShape: vi.fn(),
  onSelectLayer: vi.fn(),
  onMoveElement: vi.fn(),
  onResizeStart: vi.fn(),
  onResizeElement: vi.fn(),
  onEditingChange: vi.fn(),
  onEditText: vi.fn(),
};

describe("Canvas — Resizable Shapes Feature", () => {
  it("renders selection outline and 8 resize handles when exactly one shape is selected", () => {
    const { container } = render(<Canvas {...defaultProps} />);

    // Check that the resize overlay is rendered
    const overlay = container.querySelector(".resize-overlay");
    expect(overlay).not.toBeNull();

    // Check for the bounding box rect outline
    const outline = overlay?.querySelector("rect[fill='none']");
    expect(outline).not.toBeNull();
    expect(outline?.getAttribute("x")).toBe("50");
    expect(outline?.getAttribute("y")).toBe("50");
    expect(outline?.getAttribute("width")).toBe("100");
    expect(outline?.getAttribute("height")).toBe("100");

    // Check that 8 resize handle groups are rendered
    const handles = container.querySelectorAll(".resize-handle-group");
    expect(handles.length).toBe(8);
  });

  it("does not render resize handles when activeTool is not move", () => {
    const { container } = render(<Canvas {...defaultProps} activeTool="rect" />);
    const overlay = container.querySelector(".resize-overlay");
    expect(overlay).toBeNull();
  });

  it("does not render resize handles when multiple layers are selected", () => {
    const { container } = render(
      <Canvas
        {...defaultProps}
        selectedLayerIds={["shape-1", "shape-2"]}
      />,
    );
    const overlay = container.querySelector(".resize-overlay");
    expect(overlay).toBeNull();
  });

  it("triggers onResizeStart callback when clicking on a handle", () => {
    const onResizeStart = vi.fn();
    const { container } = render(
      <Canvas {...defaultProps} onResizeStart={onResizeStart} />,
    );

    // Get the bottom-right handle hit target (transparent rect)
    const handleHitTargets = container.querySelectorAll(
      ".resize-handle-group rect[fill='transparent']",
    );
    // Let's click the last handle (BR)
    const brHandle = handleHitTargets[7];
    expect(brHandle).toBeDefined();

    fireEvent.mouseDown(brHandle, { clientX: 150, clientY: 150 });
    expect(onResizeStart).toHaveBeenCalled();
  });

  it("resizes bottom-right (br) handle correctly on drag", () => {
    const onResizeElement = vi.fn();
    const { container } = render(
      <Canvas {...defaultProps} onResizeElement={onResizeElement} />,
    );

    const handleHitTargets = container.querySelectorAll(
      ".resize-handle-group rect[fill='transparent']",
    );
    // Index 7 is BR handle
    const brHandle = handleHitTargets[7];

    // Mouse down at handle position
    fireEvent.mouseDown(brHandle, { clientX: 150, clientY: 150 });

    // Drag 20px right, 30px down on svg canvas
    const svgElement = container.querySelector("svg");
    expect(svgElement).not.toBeNull();
    fireEvent.mouseMove(svgElement!, { clientX: 170, clientY: 180 });

    // Initial shape was at x: 50, y: 50, w: 100, h: 100
    // Moving BR by dx: 20, dy: 30 should result in width: 120, height: 130, x: 50, y: 50
    expect(onResizeElement).toHaveBeenCalledWith(
      "shape-1",
      50, // x
      50, // y
      120, // width
      130, // height
    );
  });

  it("resizes top-left (tl) handle correctly and adjusts position", () => {
    const onResizeElement = vi.fn();
    const { container } = render(
      <Canvas {...defaultProps} onResizeElement={onResizeElement} />,
    );

    const handleHitTargets = container.querySelectorAll(
      ".resize-handle-group rect[fill='transparent']",
    );
    // Index 0 is TL handle
    const tlHandle = handleHitTargets[0];

    // Mouse down at handle position
    fireEvent.mouseDown(tlHandle, { clientX: 50, clientY: 50 });

    // Drag 10px right, 15px down (shrinking top-left corner)
    const svgElement = container.querySelector("svg");
    fireEvent.mouseMove(svgElement!, { clientX: 60, clientY: 65 });

    // Initial shape was at x: 50, y: 50, w: 100, h: 100
    // Moving TL by dx: 10, dy: 15 should result in width: 90, height: 85, x: 60, y: 65
    expect(onResizeElement).toHaveBeenCalledWith(
      "shape-1",
      60, // x
      65, // y
      90, // width
      85, // height
    );
  });

  it("respects MIN_SHAPE_SIZE constraint during resizing", () => {
    const onResizeElement = vi.fn();
    const { container } = render(
      <Canvas {...defaultProps} onResizeElement={onResizeElement} />,
    );

    const handleHitTargets = container.querySelectorAll(
      ".resize-handle-group rect[fill='transparent']",
    );
    // Index 7 is BR handle
    const brHandle = handleHitTargets[7];

    fireEvent.mouseDown(brHandle, { clientX: 150, clientY: 150 });

    const svgElement = container.querySelector("svg");
    // Drag left by 120px (trying to shrink width to -20px)
    fireEvent.mouseMove(svgElement!, { clientX: 30, clientY: 150 });

    // Width should be constrained to MIN_SHAPE_SIZE (10)
    expect(onResizeElement).toHaveBeenCalledWith(
      "shape-1",
      50, // x stays same for BR
      50, // y stays same
      10, // width (constrained)
      100, // height (unchanged)
    );
  });
});

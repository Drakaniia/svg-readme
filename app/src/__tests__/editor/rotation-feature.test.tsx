import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import Canvas from "../../components/editor-canvas/Canvas";
import type { CanvasProps } from "../../components/editor-canvas/types";
import type { ShapeElementProperties } from "../../components/editor-canvas/ElementsRenderer";
import ElementsRenderer from "../../components/editor-canvas/ElementsRenderer";

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
  rotation: 45,
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
  onRotateStart: vi.fn(),
  onRotateElement: vi.fn(),
  onEditingChange: vi.fn(),
  onEditText: vi.fn(),
  onPaintLayer: vi.fn(),
};

describe("Canvas — Shape Rotation Feature", () => {
  it("renders rotate handle connector and hit circle when exactly one shape is selected", () => {
    const { container } = render(<Canvas {...defaultProps} />);

    // Check that the resize overlay is rendered
    const overlay = container.querySelector(".resize-overlay");
    expect(overlay).not.toBeNull();

    // Check for the rotation connector line
    const line = overlay?.querySelector("line");
    expect(line).not.toBeNull();
    // Bounding box: x: 50, y: 50, width: 100, height: 100.
    // Center: 100.
    // In our code:
    // x1 = selectedProps.x + selectedProps.width / 2 = 100
    // y1 = selectedProps.y = 50
    // x2 = selectedProps.x + selectedProps.width / 2 = 100
    // y2 = selectedProps.y - 24 = 26
    expect(line?.getAttribute("x1")).toBe("100");
    expect(line?.getAttribute("y1")).toBe("50");
    expect(line?.getAttribute("x2")).toBe("100");
    expect(line?.getAttribute("y2")).toBe("26");

    // Check that there is a transparent hit target circle for rotate handle
    const circles = overlay?.querySelectorAll("circle");
    expect(circles?.length).toBe(2); // visual circle (r=4) and hit area circle (r=10)
    
    const hitCircle = circles?.[1];
    expect(hitCircle?.getAttribute("cx")).toBe("100");
    expect(hitCircle?.getAttribute("cy")).toBe("26");
    expect(hitCircle?.getAttribute("fill")).toBe("transparent");
  });

  it("applies the rotation transform to the resize overlay container", () => {
    const { container } = render(<Canvas {...defaultProps} />);
    const overlay = container.querySelector(".resize-overlay");
    // Center is 100, 100. Rotation is 45.
    expect(overlay?.getAttribute("transform")).toBe("rotate(45, 100, 100)");
  });

  it("triggers onRotateStart and onRotateElement when dragging the rotate handle", () => {
    const onRotateStart = vi.fn();
    const onRotateElement = vi.fn();
    const { container } = render(
      <Canvas
        {...defaultProps}
        onRotateStart={onRotateStart}
        onRotateElement={onRotateElement}
      />,
    );

    const circles = container.querySelectorAll(".resize-overlay circle");
    const rotateHitCircle = circles[1]; // Transparent hit area

    // SVG coordinates from mouse event logic in Canvas uses svg.getBoundingClientRect()
    // In jsdom environment, getBoundingClientRect returns 0 for width/height by default.
    // So getSVGCoords clientX / clientY map exactly to canvas coordinates when clientX/Y are passed relative to rect=0.
    // Let's click at rotation handle position: x = 100, y = 26.
    // Center is cx = 100, cy = 100.
    // dx = 0, dy = -74. Angle = atan2(-74, 0) = -90 degrees.
    fireEvent.mouseDown(rotateHitCircle, { clientX: 100, clientY: 26 });
    expect(onRotateStart).toHaveBeenCalled();

    // Now drag mouse to clientX: 174, clientY: 100.
    // dx = 74, dy = 0. Angle = atan2(0, 74) = 0 degrees.
    // Angle delta = 0 - (-90) = 90 degrees.
    // New rotation = (initialRotation: 45 + angleDelta: 90) = 135 degrees.
    const svgElement = container.querySelector("svg");
    fireEvent.mouseMove(svgElement!, { clientX: 174, clientY: 100 });

    expect(onRotateElement).toHaveBeenCalledWith("shape-1", 135);
  });

  it("applies rotation transform to the shape in ElementsRenderer", () => {
    const { container } = render(
      <svg>
        <ElementsRenderer
          layers={defaultProps.layers}
          elementProperties={defaultProps.elementProperties}
          selectedLayerIds={defaultProps.selectedLayerIds}
          onElementMouseDown={vi.fn()}
        />
      </svg>
    );

    const elementGroup = container.querySelector("[data-layer-type='shape']");
    expect(elementGroup).not.toBeNull();
    // Center: 100, 100. Rotation: 45.
    expect(elementGroup?.getAttribute("transform")).toBe("rotate(45, 100, 100)");
  });
});

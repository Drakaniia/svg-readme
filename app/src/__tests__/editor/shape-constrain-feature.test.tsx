import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import Canvas from "../../components/editor-canvas/Canvas";
import type { CanvasProps } from "../../components/editor-canvas/types";

const defaultProps: CanvasProps = {
  frameSize: { width: 800, height: 600 },
  activeTool: "move",
  layers: [],
  selectedLayerId: null,
  selectedLayerIds: [],
  isEditingText: false,
  elementProperties: {},
  onCreateText: vi.fn(),
  onCreateShape: vi.fn(),
  onSelectLayer: vi.fn(),
  onMoveElement: vi.fn(),
  onResizeStart: vi.fn(),
  onResizeElement: vi.fn(),
  onEditingChange: vi.fn(),
  onEditText: vi.fn(),
  onPaintLayer: vi.fn(),
};

describe("Shape Constrain (Shift key) Feature", () => {
  describe("rect tool — shift constrains to square", () => {
    it("creates a perfect square when shift is held (drag right-down)", () => {
      const onCreateShape = vi.fn();
      const { container } = render(
        <Canvas {...defaultProps} activeTool="rect" onCreateShape={onCreateShape} />,
      );
      const svg = container.querySelector("svg")!;

      // Drag from (200,200) to (300,260): dx=100, dy=60 → max=100 → square 100×100
      fireEvent.mouseDown(svg, { clientX: 200, clientY: 200 });
      fireEvent.mouseMove(svg, { clientX: 300, clientY: 260, shiftKey: true });
      fireEvent.mouseUp(svg, { clientX: 300, clientY: 260, shiftKey: true });

      expect(onCreateShape).toHaveBeenCalledWith("rect", 200, 200, 100, 100);
    });

    it("creates a perfect square when shift is held (drag left-up)", () => {
      const onCreateShape = vi.fn();
      const { container } = render(
        <Canvas {...defaultProps} activeTool="rect" onCreateShape={onCreateShape} />,
      );
      const svg = container.querySelector("svg")!;

      // Drag from (300,300) to (200,240): dx=-100, dy=-60 → max=100
      fireEvent.mouseDown(svg, { clientX: 300, clientY: 300 });
      fireEvent.mouseMove(svg, { clientX: 200, clientY: 240, shiftKey: true });
      fireEvent.mouseUp(svg, { clientX: 200, clientY: 240, shiftKey: true });

      expect(onCreateShape).toHaveBeenCalledWith("rect", 200, 200, 100, 100);
    });

    it("without shift, shape is NOT constrained (自由尺寸)", () => {
      const onCreateShape = vi.fn();
      const { container } = render(
        <Canvas {...defaultProps} activeTool="rect" onCreateShape={onCreateShape} />,
      );
      const svg = container.querySelector("svg")!;

      fireEvent.mouseDown(svg, { clientX: 200, clientY: 200 });
      fireEvent.mouseMove(svg, { clientX: 300, clientY: 260, shiftKey: false });
      fireEvent.mouseUp(svg, { clientX: 300, clientY: 260, shiftKey: false });

      // 100×60 unconstrained
      expect(onCreateShape).toHaveBeenCalledWith("rect", 200, 200, 100, 60);
    });
  });

  describe("circle tool — shift constrains to perfect circle", () => {
    it("creates a perfect circle when shift is held", () => {
      const onCreateShape = vi.fn();
      const { container } = render(
        <Canvas {...defaultProps} activeTool="circle" onCreateShape={onCreateShape} />,
      );
      const svg = container.querySelector("svg")!;

      // Drag from (200,200) to (350,280): dx=150, dy=80 → max=150 → 150×150
      fireEvent.mouseDown(svg, { clientX: 200, clientY: 200 });
      fireEvent.mouseMove(svg, { clientX: 350, clientY: 280, shiftKey: true });
      fireEvent.mouseUp(svg, { clientX: 350, clientY: 280, shiftKey: true });

      expect(onCreateShape).toHaveBeenCalledWith("circle", 200, 200, 150, 150);
    });
  });

  describe("triangle tool — shift constrains to equilateral bounding box", () => {
    it("creates a square bounding box when shift is held", () => {
      const onCreateShape = vi.fn();
      const { container } = render(
        <Canvas {...defaultProps} activeTool="triangle" onCreateShape={onCreateShape} />,
      );
      const svg = container.querySelector("svg")!;

      // Drag from (100,100) to (250,180): dx=150, dy=80 → max=150 → 150×150
      fireEvent.mouseDown(svg, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(svg, { clientX: 250, clientY: 180, shiftKey: true });
      fireEvent.mouseUp(svg, { clientX: 250, clientY: 180, shiftKey: true });

      expect(onCreateShape).toHaveBeenCalledWith("triangle", 100, 100, 150, 150);
    });
  });

  describe("star tool — shift constrains to square bounding box", () => {
    it("creates a square bounding box when shift is held", () => {
      const onCreateShape = vi.fn();
      const { container } = render(
        <Canvas {...defaultProps} activeTool="star" onCreateShape={onCreateShape} />,
      );
      const svg = container.querySelector("svg")!;

      // Drag from (100,100) to (220,160): dx=120, dy=60 → max=120 → 120×120
      fireEvent.mouseDown(svg, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(svg, { clientX: 220, clientY: 160, shiftKey: true });
      fireEvent.mouseUp(svg, { clientX: 220, clientY: 160, shiftKey: true });

      expect(onCreateShape).toHaveBeenCalledWith("star", 100, 100, 120, 120);
    });
  });

  describe("hexagon tool — shift constrains to square bounding box", () => {
    it("creates a square bounding box when shift is held", () => {
      const onCreateShape = vi.fn();
      const { container } = render(
        <Canvas {...defaultProps} activeTool="hexagon" onCreateShape={onCreateShape} />,
      );
      const svg = container.querySelector("svg")!;

      // Drag from (100,100) to (250,170): dx=150, dy=70 → max=150 → 150×150
      fireEvent.mouseDown(svg, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(svg, { clientX: 250, clientY: 170, shiftKey: true });
      fireEvent.mouseUp(svg, { clientX: 250, clientY: 170, shiftKey: true });

      expect(onCreateShape).toHaveBeenCalledWith("hexagon", 100, 100, 150, 150);
    });
  });

  describe("click (no drag) creates default size regardless of shift", () => {
    it("creates a default-size shape on click even with shift held", () => {
      const onCreateShape = vi.fn();
      const { container } = render(
        <Canvas {...defaultProps} activeTool="rect" onCreateShape={onCreateShape} />,
      );
      const svg = container.querySelector("svg")!;

      // Click without drag
      fireEvent.mouseDown(svg, { clientX: 200, clientY: 200 });
      fireEvent.mouseUp(svg, { clientX: 200, clientY: 200, shiftKey: true });

      // Default size DS=80, position centered: (200-40, 200-40, 80, 80)
      expect(onCreateShape).toHaveBeenCalledWith("rect", 160, 160, 80, 80);
    });
  });
});

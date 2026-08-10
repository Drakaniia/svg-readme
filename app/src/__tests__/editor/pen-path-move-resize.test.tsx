import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { useState } from "react";
import Canvas from "../../components/editor-canvas/Canvas";
import type { CanvasProps } from "../../components/editor-canvas/types";
import type { PathElementProperties } from "../../components/editor-canvas/ElementsRenderer";
import { translatePoints, rescalePoints } from "../../lib/editor/pathUtils";

const pathProps: PathElementProperties = {
  type: "path",
  x: 100,
  y: 100,
  width: 200,
  height: 100,
  points: [
    [100, 100],
    [300, 100],
    [300, 200],
    [100, 200],
  ],
  stroke: "#3b82f6",
  strokeWidth: 2,
  fill: "rgba(59,130,246,0.15)",
  opacity: 1,
  closed: true,
};

/**
 * A stateful wrapper that mimics EditorInner's handlers: moving/resizing a path
 * must translate/rescale the absolute points, not just the box.
 */
function Harness({ activeTool = "move" as const }: { activeTool?: "move" }) {
  const [props, setProps] = useState<PathElementProperties>(pathProps);
  const handleMoveElement = (id: string, x: number, y: number) => {
    setProps((prev) => {
      const { points, handles, bounds } = translatePoints(
        prev.points,
        x - prev.x,
        y - prev.y,
        prev.handles,
      );
      return { ...prev, points, handles, ...bounds };
    });
  };
  const handleResizeElement = (id: string, x: number, y: number, width: number, height: number) => {
    setProps((prev) => {
      const { points, handles, bounds } = rescalePoints(
        prev.points,
        { x: prev.x, y: prev.y, width: prev.width, height: prev.height },
        { x, y, width, height },
        prev.handles,
      );
      return { ...prev, points, handles, ...bounds };
    });
  };
  const canvasProps: CanvasProps = {
    frameSize: { width: 800, height: 600 },
    activeTool,
    layers: [
      {
        id: "path-1",
        name: "Path",
        type: "shape",
        locked: false,
        visible: true,
        active: true,
      },
    ],
    selectedLayerId: "path-1",
    selectedLayerIds: ["path-1"],
    isEditingText: false,
    elementProperties: { "path-1": props },
    onCreateText: vi.fn(),
    onCreateShape: vi.fn(),
    onSelectLayer: vi.fn(),
    onMoveElement: handleMoveElement,
    onResizeStart: vi.fn(),
    onResizeElement: handleResizeElement,
    onEditingChange: vi.fn(),
    onEditText: vi.fn(),
    snapEnabled: false,
  };
  return <Canvas {...canvasProps} />;
}

function getPathD(container: HTMLElement): string {
  const el = container.querySelector('g[data-layer-type="path"] > path');
  return el?.getAttribute("d") ?? "";
}

describe("Pen-drawn path: move + resize keep geometry in sync", () => {
  it("moving the shape translates the path points (not just the box)", () => {
    const { container } = render(<Harness />);
    const before = getPathD(container);
    expect(before).toContain("M 100 100");

    // Grab the path's invisible hit area and drag it 50,30
    const hitEl = container.querySelector(
      'g[data-layer-type="path"] > rect[fill="transparent"]',
    );
    expect(hitEl).not.toBeNull();
    fireEvent.mouseDown(hitEl!, { clientX: 200, clientY: 150, button: 0 });
    fireEvent.mouseMove(container.querySelector("svg")!, {
      clientX: 250,
      clientY: 180,
    });
    fireEvent.mouseUp(container.querySelector("svg")!, {
      clientX: 250,
      clientY: 180,
    });

    const after = getPathD(container);
    // The first point must have moved from (100,100) to (150,130)
    expect(after).toContain("M 150 130");
    expect(after).not.toBe(before);
  });

  it("resizing with a handle rescales the path points", () => {
    const { container } = render(<Harness />);
    // BR handle is the 8th transparent hit rect in the resize overlay
    const handles = container.querySelectorAll(
      ".resize-handle-group rect[fill='transparent']",
    );
    expect(handles.length).toBe(8);
    fireEvent.mouseDown(handles[7], { clientX: 300, clientY: 200, button: 0 });
    // Drag BR from (300,200) to (350,240): width 200→250, height 100→140
    fireEvent.mouseMove(container.querySelector("svg")!, {
      clientX: 350,
      clientY: 240,
    });
    fireEvent.mouseUp(container.querySelector("svg")!, {
      clientX: 350,
      clientY: 240,
    });

    const after = getPathD(container);
    // Bottom-right corner moved from (300,200) to (350,240)
    expect(after).toContain("350");
    expect(after).toContain("240");
  });

  it("box-only updates (Design panel X/Y/W/H) keep path geometry in sync", () => {
    // Mirrors the fixed handleUpdateProperties: a path's box update must
    // translate/rescale the absolute points — never just the selection box.
    const oldBox = { x: 100, y: 100, width: 200, height: 100 };
    const { points: moved, bounds: movedBounds } = rescalePoints(
      pathProps.points,
      oldBox,
      { x: 150, y: 130, width: 200, height: 100 },
    );
    // Moving X/Y only must shift the points (translation), keeping size.
    expect(moved[0]).toEqual([150, 130]);
    expect(movedBounds).toEqual({ x: 150, y: 130, width: 200, height: 100 });

    const { points: grown } = rescalePoints(
      pathProps.points,
      oldBox,
      { x: 100, y: 100, width: 300, height: 100 },
    );
    // Growing W only must stretch the right edge, keeping the left edge.
    expect(grown[1]).toEqual([400, 100]);
    expect(grown[0]).toEqual([100, 100]);
  });
});

describe("Pen tool: closing a path via double-click finalizes it", () => {
  function makeCanvasProps(onCreatePath: ReturnType<typeof vi.fn>) {
    const canvasProps: CanvasProps = {
      frameSize: { width: 800, height: 600 },
      activeTool: "pen",
      layers: [],
      selectedLayerId: null,
      selectedLayerIds: [],
      isEditingText: false,
      elementProperties: {},
      onCreateText: vi.fn(),
      onCreateShape: vi.fn(),
      onCreatePath,
      onSelectLayer: vi.fn(),
      onMoveElement: vi.fn(),
      onEditingChange: vi.fn(),
      onEditText: vi.fn(),
    };
    return canvasProps;
  }

  it("creates the path when the canvas is double-clicked to close it", () => {
    const onCreatePath = vi.fn();
    const { container } = render(<Canvas {...makeCanvasProps(onCreatePath)} />);
    const svg = container.querySelector("svg")!;

    const click = (x: number, y: number) => {
      fireEvent.mouseDown(svg, { clientX: x, clientY: y, button: 0 });
      fireEvent.mouseMove(svg, { clientX: x, clientY: y });
      fireEvent.mouseUp(svg, { clientX: x, clientY: y });
    };
    click(100, 100);
    click(300, 100);
    click(300, 200);
    click(100, 200);
    // Double-click closes the path — must finalize immediately (no mouseup follows).
    fireEvent.doubleClick(svg, { clientX: 100, clientY: 200 });

    expect(onCreatePath).toHaveBeenCalledTimes(1);
    const created = onCreatePath.mock.calls[0][0];
    expect(created.closed).toBe(true);
    expect(created.points.length).toBeGreaterThanOrEqual(2);
    expect(created.x).toBeLessThanOrEqual(100);
    expect(created.y).toBeLessThanOrEqual(100);
  });
});

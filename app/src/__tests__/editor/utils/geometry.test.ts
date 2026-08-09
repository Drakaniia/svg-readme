import { describe, expect, it } from "vitest";
import {
  alignItems,
  distributeItems,
  distributeItemsWithSpacing,
  alignItemsToFrame,
  getSelectionBounds,
  snapPosition,
  clampZoom,
  screenToWorld,
  zoomAtPoint,
  type GeometryItem,
} from "../../../lib/editor/geometry";

const items: GeometryItem[] = [
  { id: "a", x: 10, y: 20, bounds: { x: 10, y: 20, width: 40, height: 20 } },
  { id: "b", x: 100, y: 60, bounds: { x: 100, y: 60, width: 20, height: 40 } },
  { id: "c", x: 200, y: 100, bounds: { x: 200, y: 100, width: 30, height: 10 } },
];

describe("editor geometry", () => {
  it("computes the union bounds of a selection", () => {
    expect(getSelectionBounds(items)).toEqual({
      x: 10,
      y: 20,
      width: 220,
      height: 90,
    });
  });

  it("aligns items to the selection edges and centers", () => {
    expect(alignItems(items, "left")).toEqual({
      a: { x: 10, y: 20 },
      b: { x: 10, y: 60 },
      c: { x: 10, y: 100 },
    });
    expect(alignItems(items, "center-horizontal")).toEqual({
      a: { x: 100, y: 20 },
      b: { x: 110, y: 60 },
      c: { x: 105, y: 100 },
    });
    expect(alignItems(items, "bottom")).toEqual({
      a: { x: 10, y: 90 },
      b: { x: 100, y: 70 },
      c: { x: 200, y: 100 },
    });
  });

  it("distributes items evenly while preserving their order", () => {
    const spaced: GeometryItem[] = [
      { id: "a", x: 0, y: 0, bounds: { x: 0, y: 0, width: 20, height: 10 } },
      { id: "b", x: 45, y: 0, bounds: { x: 45, y: 0, width: 10, height: 10 } },
      { id: "c", x: 100, y: 0, bounds: { x: 100, y: 0, width: 20, height: 10 } },
    ];

    expect(distributeItems(spaced, "horizontal")).toEqual({
      a: { x: 0, y: 0 },
      b: { x: 55, y: 0 },
      c: { x: 100, y: 0 },
    });
  });

  it("distributes items with an exact gap while keeping the outermost fixed (B7)", () => {
    const spaced: GeometryItem[] = [
      { id: "a", x: 0, y: 0, bounds: { x: 0, y: 0, width: 20, height: 10 } },
      { id: "b", x: 45, y: 0, bounds: { x: 45, y: 0, width: 10, height: 10 } },
      { id: "c", x: 100, y: 0, bounds: { x: 100, y: 0, width: 20, height: 10 } },
    ];

    // Gap of 10: a stays, b moves to 20+10=30, c stays at 100.
    expect(distributeItemsWithSpacing(spaced, "horizontal", 10)).toEqual({
      a: { x: 0, y: 0 },
      b: { x: 30, y: 0 },
      c: { x: 100, y: 0 },
    });
  });

  it("distributes vertically with an exact gap (B7)", () => {
    const vertical: GeometryItem[] = [
      { id: "a", x: 0, y: 0, bounds: { x: 0, y: 0, width: 10, height: 10 } },
      { id: "b", x: 0, y: 30, bounds: { x: 0, y: 30, width: 10, height: 10 } },
      { id: "c", x: 0, y: 80, bounds: { x: 0, y: 80, width: 10, height: 10 } },
    ];
    expect(distributeItemsWithSpacing(vertical, "vertical", 20)).toEqual({
      a: { x: 0, y: 0 },
      b: { x: 0, y: 30 },
      c: { x: 0, y: 80 },
    });
  });

  it("returns identity for fewer than 3 items in spacing mode", () => {
    const two: GeometryItem[] = [
      { id: "a", x: 5, y: 5, bounds: { x: 5, y: 5, width: 10, height: 10 } },
      { id: "b", x: 50, y: 50, bounds: { x: 50, y: 50, width: 10, height: 10 } },
    ];
    expect(distributeItemsWithSpacing(two, "horizontal", 10)).toEqual({
      a: { x: 5, y: 5 },
      b: { x: 50, y: 50 },
    });
  });

  it("aligns a single item to the frame/artboard (B7)", () => {
    const frame = { x: 0, y: 0, width: 800, height: 200 };
    const one: GeometryItem[] = [
      { id: "a", x: 100, y: 50, bounds: { x: 100, y: 50, width: 40, height: 20 } },
    ];
    expect(alignItemsToFrame(one, "center-horizontal", frame)).toEqual({
      a: { x: 400 - 20 - 100 + 100, y: 50 },
    });
    // center-horizontal: frame cx (400) − item cx (120) = +280 → x = 380
    expect(alignItemsToFrame(one, "center-horizontal", frame)).toEqual({
      a: { x: 380, y: 50 },
    });
    expect(alignItemsToFrame(one, "bottom", frame)).toEqual({
      a: { x: 100, y: 180 },
    });
  });

  it("snaps positions to a grid and nearby alignment guides", () => {
    expect(snapPosition({ x: 23, y: 38 }, { gridSize: 10 })).toEqual({
      x: 20,
      y: 40,
    });
    expect(
      snapPosition(
        { x: 98, y: 37 },
        { gridSize: 10, guides: [{ x: 100, y: 40 }], threshold: 4 },
      ),
    ).toEqual({ x: 100, y: 40 });
  });

  it("keeps zoom within bounds and preserves the pointer world position", () => {
    expect(clampZoom(0.01)).toBe(0.1);
    expect(clampZoom(10)).toBe(4);

    const viewport = { zoom: 1, panX: 10, panY: -20 };
    const pointer = { x: 200, y: 120 };
    const worldBefore = screenToWorld(pointer, viewport);
    const zoomed = zoomAtPoint(viewport, pointer, 2);

    expect(zoomed).toEqual({ zoom: 2, panX: -180, panY: -160 });
    expect(screenToWorld(pointer, zoomed)).toEqual(worldBefore);
  });
});

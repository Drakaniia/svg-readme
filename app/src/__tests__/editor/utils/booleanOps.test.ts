import { describe, it, expect } from "vitest";
import { applyBooleanOp } from "../../../lib/editor/layerOps/booleanOps";
import { shapeToPolygon } from "../../../lib/editor/layerOps/booleanOps";
import type { LayerType } from "../../../context/EditorContext";
import type { ElementProperties } from "../../../components/editor-canvas/ElementsRenderer";

function rectLayer(id: string, x: number, y: number, w: number, h: number): { layer: LayerType; props: ElementProperties } {
  return {
    layer: { id, name: id, type: "shape", locked: false, visible: true },
    props: {
      type: "shape",
      kind: "rect",
      x,
      y,
      width: w,
      height: h,
      fill: "#8b5cf6",
      stroke: "none",
      strokeWidth: 0,
      opacity: 1,
    },
  };
}

describe("applyBooleanOp — real geometry", () => {
  it("union of two overlapping rects yields the outer boundary (not a bbox)", () => {
    const a = rectLayer("a", 0, 0, 10, 10);
    const b = rectLayer("b", 5, 5, 10, 10);
    const result = applyBooleanOp(
      [a.layer, b.layer],
      { a: a.props, b: b.props },
      ["a", "b"],
      "union",
    );
    expect(result).not.toBeNull();
    const props = result!.updatedProperties[result!.resultId];
    expect(props.type).toBe("path");
    if (props.type !== "path") return;
    // The union spans both rects…
    expect(props.x).toBeCloseTo(0);
    expect(props.y).toBeCloseTo(0);
    expect(props.width).toBeCloseTo(15);
    expect(props.height).toBeCloseTo(15);
    // …but it is NOT a 4-point rectangle — it must trace the stepped outline.
    expect(props.points.length).toBeGreaterThanOrEqual(6);
    // Original layers are removed, result added
    expect(result!.updatedLayers.some((l) => l.id === "a")).toBe(false);
    expect(result!.updatedLayers.some((l) => l.id === "b")).toBe(false);
    expect(result!.updatedLayers.some((l) => l.id === result!.resultId)).toBe(true);
  });

  it("intersect of two overlapping rects yields exactly the shared rect", () => {
    const a = rectLayer("a", 0, 0, 10, 10);
    const b = rectLayer("b", 5, 5, 10, 10);
    const result = applyBooleanOp(
      [a.layer, b.layer],
      { a: a.props, b: b.props },
      ["a", "b"],
      "intersect",
    );
    expect(result).not.toBeNull();
    const props = result!.updatedProperties[result!.resultId];
    if (props.type !== "path") throw new Error("expected path");
    expect(props.points).toHaveLength(4);
    expect(props.x).toBeCloseTo(5);
    expect(props.y).toBeCloseTo(5);
    expect(props.width).toBeCloseTo(5);
    expect(props.height).toBeCloseTo(5);
  });

  it("subtract of two overlapping rects yields an L-shape (6 points)", () => {
    const a = rectLayer("a", 0, 0, 10, 10);
    const b = rectLayer("b", 5, 5, 10, 10);
    const result = applyBooleanOp(
      [a.layer, b.layer],
      { a: a.props, b: b.props },
      ["a", "b"],
      "subtract",
    );
    expect(result).not.toBeNull();
    const props = result!.updatedProperties[result!.resultId];
    if (props.type !== "path") throw new Error("expected path");
    expect(props.points).toHaveLength(6);
    expect(props.x).toBeCloseTo(0);
    expect(props.y).toBeCloseTo(0);
  });

  it("subtract of an inner rect produces a frame with a hole subpath", () => {
    const outer = rectLayer("outer", 0, 0, 20, 20);
    const inner = rectLayer("inner", 5, 5, 10, 10);
    const result = applyBooleanOp(
      [outer.layer, inner.layer],
      { outer: outer.props, inner: inner.props },
      ["outer", "inner"],
      "subtract",
    );
    expect(result).not.toBeNull();
    const props = result!.updatedProperties[result!.resultId];
    if (props.type !== "path") throw new Error("expected path");
    // Outer boundary + one hole subpath
    expect(props.subpaths).toBeDefined();
    expect(props.subpaths!.length).toBeGreaterThanOrEqual(1);
    expect(props.width).toBeCloseTo(20);
    expect(props.height).toBeCloseTo(20);
  });

  it("requires at least two selectable shapes", () => {
    const a = rectLayer("a", 0, 0, 10, 10);
    expect(applyBooleanOp([a.layer], { a: a.props }, ["a"], "union")).toBeNull();
    // Text layers are not boolean operands
    const t: ElementProperties = {
      type: "text",
      x: 0,
      y: 0,
      width: "auto",
      height: 20,
      content: "hi",
      fontFamily: "sans",
      fontSize: 16,
      fontWeight: 400,
      color: "#fff",
      textAlign: "left",
      textAlignVertical: "top",
    };
    expect(
      applyBooleanOp([a.layer, { id: "t", name: "t", type: "text", locked: false, visible: true }], { a: a.props, t }, ["a", "t"], "union"),
    ).toBeNull();
  });

  it("keeps original layers untouched when the op cannot produce a result (disjoint union)", () => {
    const a = rectLayer("a", 0, 0, 10, 10);
    const b = rectLayer("b", 50, 50, 10, 10);
    const result = applyBooleanOp(
      [a.layer, b.layer],
      { a: a.props, b: b.props },
      ["a", "b"],
      "union",
    );
    expect(result).toBeNull();
  });
});

describe("shapeToPolygon", () => {
  it("samples rects, triangles, stars and circles as polygons", () => {
    const rect = rectLayer("r", 0, 0, 10, 20);
    expect(shapeToPolygon(rect.props as never)).toHaveLength(4);

    const tri: ElementProperties = {
      type: "shape",
      kind: "triangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      fill: "#000",
      stroke: "none",
      strokeWidth: 0,
      opacity: 1,
    };
    expect(shapeToPolygon(tri as never)).toHaveLength(3);

    const star: ElementProperties = {
      type: "shape",
      kind: "star",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      fill: "#000",
      stroke: "none",
      strokeWidth: 0,
      opacity: 1,
    };
    expect(shapeToPolygon(star as never)).toHaveLength(10);

    const circle: ElementProperties = {
      type: "shape",
      kind: "circle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      fill: "#000",
      stroke: "none",
      strokeWidth: 0,
      opacity: 1,
    };
    const circPts = shapeToPolygon(circle as never);
    expect(circPts!.length).toBe(64);
  });

  it("returns null for lines and open paths (no area)", () => {
    const line: ElementProperties = {
      type: "shape",
      kind: "line",
      x: 0,
      y: 0,
      width: 10,
      height: 2,
      fill: "#000",
      stroke: "#000",
      strokeWidth: 2,
      opacity: 1,
    };
    expect(shapeToPolygon(line as never)).toBeNull();

    const openPath: ElementProperties = {
      type: "path",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      points: [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
      stroke: "#000",
      strokeWidth: 1,
      fill: "none",
      opacity: 1,
      closed: false,
    };
    expect(shapeToPolygon(openPath as never)).toBeNull();
  });
});

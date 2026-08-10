import { describe, expect, it } from "vitest";
import {
  computePointsBounds,
  translatePoints,
  rescalePoints,
  pointsToSvgD,
  segmentMidpoint,
  splitSegment,
  deleteVertex,
  toggleVertexSmooth,
  shiftVertexHandles,
  mirrorPoint,
} from "../../../lib/editor/pathUtils";

describe("path point transforms", () => {
  const points: [number, number][] = [
    [10, 20],
    [50, 20],
    [50, 80],
    [10, 80],
  ];

  it("computes the bounding box of a set of points", () => {
    expect(computePointsBounds(points)).toEqual({
      x: 10,
      y: 20,
      width: 40,
      height: 60,
    });
    expect(computePointsBounds([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it("translates points and shifts the bounding box by the same delta", () => {
    const { points: next, bounds } = translatePoints(points, 30, -10);
    expect(next).toEqual([
      [40, 10],
      [80, 10],
      [80, 70],
      [40, 70],
    ]);
    expect(bounds).toEqual({ x: 40, y: 10, width: 40, height: 60 });
  });

  it("rescalePoints proportionally maps points into a new box", () => {
    const { points: next, bounds } = rescalePoints(
      points,
      { x: 10, y: 20, width: 40, height: 60 },
      { x: 0, y: 0, width: 80, height: 120 },
    );
    expect(next).toEqual([
      [0, 0],
      [80, 0],
      [80, 120],
      [0, 120],
    ]);
    expect(bounds).toEqual({ x: 0, y: 0, width: 80, height: 120 });
  });

  it("rescalePoints handles a moved-and-grown box (top-left handle resize)", () => {
    const { points: next, bounds } = rescalePoints(
      points,
      { x: 10, y: 20, width: 40, height: 60 },
      { x: 5, y: 10, width: 80, height: 100 },
    );
    expect(next).toEqual([
      [5, 10],
      [85, 10],
      [85, 110],
      [5, 110],
    ]);
    expect(bounds).toEqual({ x: 5, y: 10, width: 80, height: 100 });
  });

  it("rescalePoints collapses zero-size dimensions onto the new origin", () => {
    const degenerate: [number, number][] = [[30, 40], [30, 40]];
    const { points: next, bounds } = rescalePoints(
      degenerate,
      { x: 30, y: 40, width: 0, height: 0 },
      { x: 0, y: 0, width: 100, height: 50 },
    );
    expect(next).toEqual([
      [0, 0],
      [0, 0],
    ]);
    expect(bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it("pointsToSvgD builds an absolute-coordinate path", () => {
    expect(pointsToSvgD(points, false)).toBe(
      "M 10 20 L 50 20 L 50 80 L 10 80",
    );
    expect(pointsToSvgD(points, true)).toBe(
      "M 10 20 L 50 20 L 50 80 L 10 80 Z",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Bezier handles (B1 — real vector editing)
// ═══════════════════════════════════════════════════════════════════════════════

describe("bezier handle rendering", () => {
  it("emits a cubic C command when a vertex carries handles", () => {
    const handles = [
      { out: [0, 50] as [number, number] },
      { in: [100, 50] as [number, number] },
    ];
    expect(pointsToSvgD([[0, 0], [100, 0]], false, handles)).toBe(
      "M 0 0 C 0 50 100 50 100 0",
    );
  });

  it("supports one-sided handles (missing control defaults to the anchor)", () => {
    const handles = [
      { out: [0, 50] as [number, number] },
      undefined,
    ];
    expect(pointsToSvgD([[0, 0], [100, 0]], false, handles)).toBe(
      "M 0 0 C 0 50 100 0 100 0",
    );
  });

  it("keeps straight segments straight when no handles exist on them", () => {
    const handles = [
      undefined,
      undefined,
    ];
    expect(pointsToSvgD([[0, 0], [100, 0]], false, handles)).toBe(
      "M 0 0 L 100 0",
    );
  });

  it("renders a curved closing segment for closed paths with wrap handles", () => {
    // Triangle with a curved closing edge (last anchor → first anchor).
    const pts: [number, number][] = [
      [0, 0],
      [100, 0],
      [50, 100],
    ];
    const handles = [
      { in: [25, -30] as [number, number] },
      undefined,
      { out: [75, 130] as [number, number] },
    ];
    expect(pointsToSvgD(pts, true, handles)).toBe(
      "M 0 0 L 100 0 L 50 100 C 75 130 25 -30 0 0 Z",
    );
  });

  it("closed paths without wrap handles close with Z only", () => {
    const pts: [number, number][] = [
      [0, 0],
      [100, 0],
      [50, 100],
    ];
    expect(pointsToSvgD(pts, true)).toBe("M 0 0 L 100 0 L 50 100 Z");
  });

  it("mirrorPoint reflects a point across an anchor", () => {
    expect(mirrorPoint([0, 50], [50, 50])).toEqual([100, 50]);
  });

  it("computes the midpoint of a cubic segment on the curve", () => {
    const handles = [
      { out: [0, 50] as [number, number] },
      { in: [100, 50] as [number, number] },
    ];
    expect(segmentMidpoint([[0, 0], [100, 0]], handles, 0, false)).toEqual([
      50, 37.5,
    ]);
  });

  it("computes the chord midpoint of a straight segment", () => {
    expect(segmentMidpoint([[0, 0], [100, 40]], undefined, 0, false)).toEqual([
      50, 20,
    ]);
  });
});

describe("path node editing", () => {
  it("splitSegment inserts a midpoint anchor on a straight segment", () => {
    const { points, handles } = splitSegment(
      [[0, 0], [100, 0]],
      undefined,
      0,
      false,
    );
    expect(points).toEqual([[0, 0], [50, 0], [100, 0]]);
    expect(handles).toBeUndefined();
  });

  it("splitSegment subdivides a cubic with de Casteljau, preserving the curve", () => {
    const pts: [number, number][] = [[0, 0], [100, 0]];
    const handles = [
      { out: [0, 50] as [number, number] },
      { in: [100, 50] as [number, number] },
    ];
    const { points, handles: next } = splitSegment(pts, handles, 0, false);
    expect(points).toEqual([[0, 0], [50, 37.5], [100, 0]]);
    expect(next).toHaveLength(3);
    // Left half: [0].out retracted to a, new vertex in = d.
    expect(next![0]!.out).toEqual([0, 25]);
    expect(next![1]!.in).toEqual([25, 37.5]);
    // Right half: new vertex out = e, old [1].in retracted to c.
    expect(next![1]!.out).toEqual([75, 37.5]);
    expect(next![1]!.smooth).toBe(true);
    expect(next![2]!.in).toEqual([100, 25]);
    // The two halves render the same shape as the original single curve.
    expect(pointsToSvgD(points, false, next)).toBe(
      "M 0 0 C 0 25 25 37.5 50 37.5 C 75 37.5 100 25 100 0",
    );
  });

  it("splitSegment does not create handles on straight splits", () => {
    const { points, handles } = splitSegment(
      [[0, 0], [100, 0], [100, 100]],
      undefined,
      0,
      false,
    );
    expect(points).toHaveLength(4);
    expect(handles).toBeUndefined();
  });

  it("deleteVertex removes the anchor and its handles", () => {
    const pts: [number, number][] = [
      [0, 0],
      [50, 50],
      [100, 0],
    ];
    const handles = [
      { out: [0, 30] as [number, number] },
      { in: [50, 80] as [number, number], out: [50, 80] as [number, number], smooth: true },
      { in: [100, 30] as [number, number] },
    ];
    const { points, handles: next } = deleteVertex(pts, handles, 1);
    expect(points).toEqual([[0, 0], [100, 0]]);
    expect(next).toEqual([
      { out: [0, 30] },
      { in: [100, 30] },
    ]);
  });

  it("deleteVertex refuses to drop below 2 anchors", () => {
    const { points } = deleteVertex([[0, 0], [100, 0]], undefined, 0);
    expect(points).toEqual([[0, 0], [100, 0]]);
  });

  it("toggleVertexSmooth mirrors an existing handle to make a smooth corner", () => {
    const pts: [number, number][] = [
      [0, 0],
      [50, 50],
      [100, 0],
    ];
    const handles = [undefined, { out: [0, 50] as [number, number] }, undefined];
    const next = toggleVertexSmooth(pts, handles, 1);
    expect(next![1]!.smooth).toBe(true);
    expect(next![1]!.in).toEqual([100, 50]); // mirror of out across the anchor
    expect(next![1]!.out).toEqual([0, 50]);
  });

  it("toggleVertexSmooth synthesizes handles for a plain corner", () => {
    const pts: [number, number][] = [
      [0, 0],
      [50, 50],
      [100, 0],
    ];
    const next = toggleVertexSmooth(pts, undefined, 1);
    // Direction (100,0) − (0,0) → out along +x, mirrored in.
    expect(next![1]).toEqual({
      in: [25, 50],
      out: [75, 50],
      smooth: true,
    });
  });

  it("toggleVertexSmooth unlocks a smooth point back to a corner", () => {
    const pts: [number, number][] = [
      [0, 0],
      [50, 50],
      [100, 0],
    ];
    const handles = [
      undefined,
      { in: [25, 50] as [number, number], out: [75, 50] as [number, number], smooth: true },
      undefined,
    ];
    const next = toggleVertexSmooth(pts, handles, 1);
    expect(next![1]).toEqual({
      in: [25, 50],
      out: [75, 50],
      smooth: false,
    });
  });

  it("shiftVertexHandles moves the handles attached to a vertex", () => {
    const handles = [
      { out: [10, 20] as [number, number] },
      { in: [90, 20] as [number, number] },
    ];
    const next = shiftVertexHandles(handles, 0, 5, -10);
    expect(next![0]!.out).toEqual([15, 10]);
    expect(next![1]!.in).toEqual([90, 20]);
  });

  it("translatePoints moves bezier handles along with the anchors", () => {
    const handles = [
      { out: [0, 50] as [number, number] },
      { in: [100, 50] as [number, number] },
    ];
    const { points: next, handles: nextHandles } = translatePoints(
      [[0, 0], [100, 0]],
      30,
      10,
      handles,
    );
    expect(next).toEqual([[30, 10], [130, 10]]);
    expect(nextHandles![0]!.out).toEqual([30, 60]);
    expect(nextHandles![1]!.in).toEqual([130, 60]);
  });

  it("rescalePoints scales bezier handles with the anchors", () => {
    const handles = [
      { out: [0, 50] as [number, number] },
      { in: [100, 50] as [number, number] },
    ];
    const { points: next, handles: nextHandles } = rescalePoints(
      [[0, 0], [100, 0]],
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 0, y: 0, width: 200, height: 50 },
      handles,
    );
    expect(next).toEqual([[0, 0], [200, 0]]);
    expect(nextHandles![0]!.out).toEqual([0, 25]);
    expect(nextHandles![1]!.in).toEqual([200, 25]);
  });
});

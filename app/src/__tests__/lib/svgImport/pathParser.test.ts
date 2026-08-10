import { describe, it, expect } from "vitest";
import { parsePathD } from "../../../lib/svgImport/pathParser";

/** Tolerance helper for float comparisons. */
function expectClose(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThan(1e-4);
}

describe("parsePathD", () => {
  it("parses a simple M L path", () => {
    const result = parsePathD("M 10 20 L 30 40");
    expect(result).toHaveLength(1);
    expect(result[0].points).toEqual([
      [10, 20],
      [30, 40],
    ]);
    expect(result[0].closed).toBe(false);
    expect(result[0].handles).toBeUndefined();
  });

  it("parses relative lineto commands", () => {
    const result = parsePathD("M 10 20 l 5 5 l 3 -2");
    expect(result[0].points).toEqual([
      [10, 20],
      [15, 25],
      [18, 23],
    ]);
  });

  it("parses H and V commands", () => {
    const result = parsePathD("M 0 0 H 50 V 30");
    expect(result[0].points).toEqual([
      [0, 0],
      [50, 0],
      [50, 30],
    ]);
  });

  it("parses relative H and V", () => {
    const result = parsePathD("M 10 10 h 20 v -5");
    expect(result[0].points).toEqual([
      [10, 10],
      [30, 10],
      [30, 5],
    ]);
  });

  it("parses closed paths with Z", () => {
    const result = parsePathD("M 0 0 L 10 0 L 10 10 Z");
    expect(result[0].closed).toBe(true);
    expect(result[0].points).toHaveLength(3);
  });

  it("creates cubic bezier handles for C commands", () => {
    const result = parsePathD("M 0 0 C 10 20, 30 40, 50 60");
    const { points, handles } = result[0];
    expect(points).toEqual([
      [0, 0],
      [50, 60],
    ]);
    expect(handles?.[0]?.out).toEqual([10, 20]);
    expect(handles?.[1]?.in).toEqual([30, 40]);
  });

  it("reflects control points for S (smooth cubic)", () => {
    const result = parsePathD("M 0 0 C 10 10, 20 20, 30 20 S 50 30, 60 20");
    const { handles } = result[0];
    // S control 1 = reflection of previous c2 (20,20) about (30,20) = (40,20)
    expect(handles?.[1]?.out).toEqual([40, 20]);
    expect(handles?.[2]?.in).toEqual([50, 30]);
    expect(handles?.[2]?.smooth).toBe(true);
  });

  it("converts quadratic curves to cubic handles", () => {
    const result = parsePathD("M 0 0 Q 50 100, 100 0");
    const { points, handles } = result[0];
    expect(points).toEqual([
      [0, 0],
      [100, 0],
    ]);
    // Q → cubic: c1 = p0 + 2/3(q-p0) = (33.33, 66.67); c2 = p1 + 2/3(q-p1)
    const c1 = handles?.[0]?.out;
    const c2 = handles?.[1]?.in;
    expect(c1).toBeDefined();
    expect(c2).toBeDefined();
    expectClose(c1![0], 33.3333);
    expectClose(c1![1], 66.6667);
    expectClose(c2![0], 66.6667);
    expectClose(c2![1], 66.6667);
  });

  it("converts smooth quadratic T with reflection", () => {
    // Q control (50,100) → next T control reflects about (100,0): (150,-100)
    const result = parsePathD("M 0 0 Q 50 100, 100 0 T 200 0");
    const { points, handles } = result[0];
    expect(points).toEqual([
      [0, 0],
      [100, 0],
      [200, 0],
    ]);
    const c1 = handles?.[2]?.in;
    // p1 = (200,0); reflected control about (100,0): (50,-100)? c1 = p1 + 2/3(q-p1)
    // q = (150,-100): c1 = (200,0) + 2/3*((150,-100)-(200,0)) = (200 - 33.33, -66.67)
    expectClose(c1![0], 166.6667);
    expectClose(c1![1], -66.6667);
  });

  it("approximates arcs with cubic segments", () => {
    const result = parsePathD("M 0 0 A 50 50 0 0 1 100 0");
    const { points, handles } = result[0];
    // Semicircle should produce at least 2 interior points
    expect(points.length).toBeGreaterThanOrEqual(2);
    expect(points[0]).toEqual([0, 0]);
    expectClose(points[points.length - 1][0], 100);
    expectClose(points[points.length - 1][1], 0);
    // Every segment should carry bezier handles (curve)
    expect(handles).toBeDefined();
  });

  it("splits multiple subpaths", () => {
    const result = parsePathD("M 0 0 L 10 0 M 20 20 L 30 30");
    expect(result).toHaveLength(2);
    expect(result[0].points).toEqual([
      [0, 0],
      [10, 0],
    ]);
    expect(result[1].points).toEqual([
      [20, 20],
      [30, 30],
    ]);
  });

  it("handles exponent notation and decimals", () => {
    const result = parsePathD("M 1e2 2E1 L 0.5 .5");
    expect(result[0].points).toEqual([
      [100, 20],
      [0.5, 0.5],
    ]);
  });

  it("handles implicit repeated coordinate pairs", () => {
    const result = parsePathD("M 0 0 10 10 20 20");
    expect(result[0].points).toEqual([
      [0, 0],
      [10, 10],
      [20, 20],
    ]);
  });

  it("returns empty array for empty d", () => {
    expect(parsePathD("")).toEqual([]);
  });
});

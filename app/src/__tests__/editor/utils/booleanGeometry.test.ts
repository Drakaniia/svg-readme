import { describe, it, expect } from "vitest";
import {
  polygonBoolean,
  type Pt,
} from "../../../lib/editor/booleanGeometry";

/** Axis-aligned rect → CCW polygon. */
function rect(x: number, y: number, w: number, h: number): Pt[] {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
}

function bounds(loops: Pt[][]): { x: number; y: number; w: number; h: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const loop of loops)
    for (const [x, y] of loop) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Count total vertices across loops. */
function totalVertices(loops: Pt[][]): number {
  return loops.reduce((n, l) => n + l.length, 0);
}

/** Normalize a loop to a canonical form (sorted vertices) for comparison. */
function canonical(loop: Pt[]): string {
  return loop
    .map((p) => `${Math.round(p[0])},${Math.round(p[1])}`)
    .sort()
    .join(" ");
}

const A = rect(0, 0, 10, 10);
const B = rect(5, 5, 10, 10);

describe("polygonBoolean — two overlapping rects", () => {
  it("union produces the outer rectilinear boundary", () => {
    const result = polygonBoolean(A, B, "union");
    expect(result).not.toBeNull();
    const loops = result!;
    expect(loops.length).toBe(1);
    expect(totalVertices(loops)).toBe(8);
    expect(bounds(loops)).toEqual({ x: 0, y: 0, w: 15, h: 15 });
    // Corner points of the union must be present
    const pts = canonical(loops[0]);
    expect(pts).toContain("0,0");
    expect(pts).toContain("15,15");
  });

  it("intersect produces the shared rectangle", () => {
    const result = polygonBoolean(A, B, "intersect");
    expect(result).not.toBeNull();
    const loops = result!;
    expect(loops.length).toBe(1);
    expect(totalVertices(loops)).toBe(4);
    expect(bounds(loops)).toEqual({ x: 5, y: 5, w: 5, h: 5 });
  });

  it("subtract produces an L-shape (6 vertices)", () => {
    const result = polygonBoolean(A, B, "subtract");
    expect(result).not.toBeNull();
    const loops = result!;
    expect(loops.length).toBe(1);
    expect(totalVertices(loops)).toBe(6);
    const pts = canonical(loops[0]);
    expect(pts).toContain("0,0");
    expect(pts).toContain("10,5");
    expect(pts).toContain("5,10");
    expect(pts).not.toContain("15,15");
  });

  it("exclude covers both non-overlapping lobes", () => {
    const result = polygonBoolean(A, B, "exclude");
    expect(result).not.toBeNull();
    const loops = result!;
    // Either one self-touching loop or two lobes — total bounds are the union box.
    expect(bounds(loops)).toEqual({ x: 0, y: 0, w: 15, h: 15 });
    const pts = loops.map(canonical).join(" ");
    expect(pts).toContain("0,0");
    expect(pts).toContain("15,15");
    // The shared corner belongs to the result boundary (touching point)
    expect(pts).toContain("10,5");
  });
});

describe("polygonBoolean — containment & disjoint", () => {
  const outer = rect(0, 0, 20, 20);
  const inner = rect(5, 5, 10, 10);

  it("subtract of an inner rect removes the hole region (loop count preserved)", () => {
    const result = polygonBoolean(outer, inner, "subtract");
    expect(result).not.toBeNull();
    // Frame shape: outer boundary + inner hole (opposite winding).
    expect(result!.length).toBeGreaterThanOrEqual(2);
    expect(bounds(result!)).toEqual({ x: 0, y: 0, w: 20, h: 20 });
  });

  it("intersect with inner rect returns the inner rect", () => {
    const result = polygonBoolean(outer, inner, "intersect");
    expect(result).not.toBeNull();
    expect(totalVertices(result!)).toBe(4);
    expect(bounds(result!)).toEqual({ x: 5, y: 5, w: 10, h: 10 });
  });

  it("union with inner rect returns the outer rect", () => {
    const result = polygonBoolean(outer, inner, "union");
    expect(result).not.toBeNull();
    expect(totalVertices(result!)).toBe(4);
    expect(bounds(result!)).toEqual({ x: 0, y: 0, w: 20, h: 20 });
  });

  it("disjoint rects: union → null, intersect → []", () => {
    const far = rect(50, 50, 5, 5);
    expect(polygonBoolean(A, far, "union")).toBeNull();
    expect(polygonBoolean(A, far, "intersect")).toEqual([]);
    expect(polygonBoolean(A, far, "subtract")).not.toBeNull();
  });
});

describe("polygonBoolean — non-rect shapes", () => {
  it("handles a triangle vs rect union", () => {
    const tri: Pt[] = [
      [5, 0],
      [10, 10],
      [0, 10],
    ];
    const result = polygonBoolean(tri, rect(0, 8, 10, 4), "union");
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(0);
    expect(bounds(result!)).toEqual({ x: 0, y: 0, w: 10, h: 12 });
  });

  it("intersects a circle (sampled) with a rect", () => {
    const cx = 5;
    const cy = 5;
    const r = 4;
    const circle: Pt[] = Array.from({ length: 64 }, (_, i) => {
      const a = (i / 64) * Math.PI * 2;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt;
    });
    const result = polygonBoolean(circle, rect(3, 3, 10, 10), "intersect");
    expect(result).not.toBeNull();
    const loops = result!;
    expect(loops.length).toBe(1);
    // Intersection sits inside the rect and inside the circle
    expect(bounds(loops).x).toBeGreaterThanOrEqual(3);
    expect(bounds(loops).y).toBeGreaterThanOrEqual(3);
    expect(bounds(loops).w).toBeLessThanOrEqual(10);
    expect(bounds(loops).h).toBeLessThanOrEqual(10);
  });

  it("returns null for degenerate inputs", () => {
    expect(polygonBoolean(rect(0, 0, 10, 10), rect(0, 0, 1, 1), "union")).not.toBeNull();
    expect(polygonBoolean([], [], "union")).toBeNull();
    expect(polygonBoolean([[0, 0], [1, 1]], rect(0, 0, 2, 2), "union")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { simplifyPath } from "../../../lib/editor/pathSimplify";

describe("simplifyPath (Ramer–Douglas–Peucker)", () => {
  it("returns the same points when given 2 or fewer points", () => {
    expect(simplifyPath([[0, 0], [10, 10]])).toEqual([[0, 0], [10, 10]]);
    expect(simplifyPath([[5, 5]])).toEqual([[5, 5]]);
    expect(simplifyPath([])).toEqual([]);
  });

  it("keeps endpoints when middle points are nearly collinear", () => {
    // Nearly straight line
    const points: [number, number][] = [
      [0, 0],
      [5, 0.5],
      [10, 0],
    ];
    const simplified = simplifyPath(points, 1.0);
    expect(simplified).toEqual([[0, 0], [10, 0]]);
  });

  it("preserves points that deviate significantly from the line", () => {
    // Sharp V shape
    const points: [number, number][] = [
      [0, 0],
      [5, 20],
      [10, 0],
    ];
    const simplified = simplifyPath(points, 1.0);
    // The middle point is far from the line, so all 3 should be kept
    expect(simplified).toHaveLength(3);
    expect(simplified[0]).toEqual([0, 0]);
    expect(simplified[2]).toEqual([10, 0]);
  });

  it("handles a more complex polyline with varying deviations", () => {
    const points: [number, number][] = [
      [0, 0],
      [2, 0.1],
      [4, 0.05],
      [6, 0.2],
      [8, 0],
      [10, 0],
    ];
    // With epsilon=0.5 these nearly-collinear points should reduce
    const simplified = simplifyPath(points, 0.5);
    expect(simplified.length).toBeLessThan(points.length);
    expect(simplified[0]).toEqual([0, 0]);
    expect(simplified[simplified.length - 1]).toEqual([10, 0]);
  });

  it("does not modify the input array", () => {
    const points: [number, number][] = [
      [0, 0],
      [5, 5],
      [10, 0],
    ];
    const copy = points.slice();
    simplifyPath(points, 1.0);
    expect(points).toEqual(copy);
  });

  it("handles epsilon=0 (keep all points)", () => {
    const points: [number, number][] = [
      [0, 0],
      [1, 0.01],
      [2, 0],
      [3, 0.01],
      [4, 0],
    ];
    const simplified = simplifyPath(points, 0);
    // All points should be kept since no deviation is allowed
    expect(simplified).toHaveLength(points.length);
  });
});

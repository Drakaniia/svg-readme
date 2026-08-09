import { describe, it, expect } from "vitest";
import { remapBoxesThroughBounds } from "../../../lib/editor/geometry";

describe("remapBoxesThroughBounds — multi-select resize as a unit (B3)", () => {
  const boxes = {
    left: { x: 0, y: 0, width: 100, height: 100 },
    right: { x: 100, y: 0, width: 100, height: 100 },
    top: { x: 50, y: -50, width: 50, height: 50 },
  };
  const oldBounds = { x: 0, y: -50, width: 200, height: 150 };

  it("keeps relative positions when the selection is scaled uniformly", () => {
    const newBounds = { x: 0, y: -100, width: 400, height: 300 }; // 2x
    const mapped = remapBoxesThroughBounds(boxes, oldBounds, newBounds);

    // left box: 0,0 → 0, 100 (since y scales from -50 → -100, box y=0 maps to -100 + (50/150)*300 = 0? no:
    // (0 - (-50))/150 = 50/150 = 1/3 → -100 + 100 = 0 → y=0. Hmm the box moved DOWN by 0? Let's verify sizes.
    expect(mapped.left.width).toBeCloseTo(200);
    expect(mapped.left.height).toBeCloseTo(200);
    expect(mapped.right.width).toBeCloseTo(200);
    expect(mapped.right.x).toBeCloseTo(200); // right box x=100 → (100-0)/200*400 = 200
    // Gap between left and right boxes doubles too
    expect(mapped.right.x - (mapped.left.x + mapped.left.width)).toBeCloseTo(0);
  });

  it("keeps relative gaps when resizing a corner", () => {
    const newBounds = { x: 0, y: -50, width: 300, height: 150 }; // width 1.5x
    const mapped = remapBoxesThroughBounds(boxes, oldBounds, newBounds);
    expect(mapped.left.width).toBeCloseTo(150);
    expect(mapped.right.x).toBeCloseTo(150); // 100 → 100 * 1.5 = 150
    expect(mapped.right.width).toBeCloseTo(150);
  });

  it("collapses onto the new origin edge for zero-size old bounds", () => {
    const zero = { x: 0, y: 0, width: 0, height: 0 };
    const mapped = remapBoxesThroughBounds(
      { a: { x: 10, y: 10, width: 5, height: 5 } },
      zero,
      { x: 100, y: 200, width: 50, height: 60 },
    );
    expect(mapped.a).toEqual({ x: 100, y: 200, width: 50, height: 60 });
  });
});

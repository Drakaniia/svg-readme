import { describe, it, expect } from "vitest";
import { getTextBoundingBox } from "../../../components/editor-canvas/ElementsRenderer";
import type { TextElementProperties } from "../../../components/editor-canvas/ElementsRenderer";

/** Factory for text element properties */
function makeTextProps(
  overrides?: Partial<TextElementProperties>,
): TextElementProperties {
  return {
    type: "text",
    x: 100,
    y: 100,
    width: "auto",
    height: 30,
    content: "Hello",
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: 400,
    color: "#ffffff",
    textAlign: "left",
    textAlignVertical: "top",
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  getTextBoundingBox — pure function tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("getTextBoundingBox (used by ElementsRenderer for selection highlights)", () => {
  // x,y is now the top-left of the textbox (Open Pencil <g transform> pattern).
  // Bounding box returns absolute world-space coordinates with slight padding (-2,+4).

  it("returns correct bounding box for auto-width left-aligned text", () => {
    const props = makeTextProps({
      x: 100,
      y: 100,
      content: "Hi",
      fontSize: 16,
      textAlign: "left",
    });
    const bb = getTextBoundingBox(props);
    expect(bb.x).toBeCloseTo(98);    // x - 2
    expect(bb.y).toBeCloseTo(98);    // y - 2
    expect(bb.width).toBeCloseTo(24, 0);   // max(2*9.6, 20) + 4 = 24
    expect(bb.height).toBeCloseTo(26.4, 1); // 16*1.4 + 4 = 26.4
  });

  // Center-aligned: bounding box is around the box, not anchored to text center
  it("returns correct bounding box for center-aligned text", () => {
    const props = makeTextProps({
      x: 200,
      y: 150,
      content: "Hello",
      fontSize: 20,
      textAlign: "center",
    });
    const bb = getTextBoundingBox(props);
    expect(bb.x).toBeCloseTo(198);     // x - 2
    expect(bb.width).toBeCloseTo(64);  // max(5*12, 20) + 4 = 64
  });

  // Right-aligned: bounding box is still at top-left, text alignment doesn't affect box position
  it("returns correct bounding box for right-aligned text", () => {
    const props = makeTextProps({
      x: 300,
      y: 200,
      content: "Test",
      fontSize: 16,
      textAlign: "right",
    });
    const bb = getTextBoundingBox(props);
    expect(bb.x).toBeCloseTo(298);    // x - 2
  });

  // Fixed-width text box uses explicit dimensions
  it("returns correct bounding box for fixed-width text", () => {
    const props = makeTextProps({
      x: 50,
      y: 50,
      width: 200,
      height: 100,
      content: "Long content here",
      textAlign: "left",
    });
    const bb = getTextBoundingBox(props);
    expect(bb.x).toBeCloseTo(48);     // x - 2
    expect(bb.width).toBe(204);       // 200 + 4
    expect(bb.height).toBe(104);      // 100 + 4
  });

  // Empty text has a minimum width
  it("returns minimum width for empty text content", () => {
    const props = makeTextProps({ content: "", fontSize: 16 });
    const bb = getTextBoundingBox(props);
    expect(bb.width).toBe(24);        // max(0, 20) + 4 = 24
  });
});

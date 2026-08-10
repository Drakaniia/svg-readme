import { describe, it, expect } from "vitest";
import {
  isValidHex,
  normalizeHex,
  hexToRgba,
  hexToRgb,
  rgbToHex,
  hsbToHex,
  hexToHsb,
  hexToHsl,
  hslToHex,
} from "../../lib/color";

// ═══════════════════════════════════════════════════════════════════════════
// Alpha support (8-digit hex #rrggbbaa) — ported from open-pencil's color model
// ═══════════════════════════════════════════════════════════════════════════

describe("isValidHex", () => {
  it("accepts 3, 4, 6, and 8 digit hex", () => {
    expect(isValidHex("#fff")).toBe(true);
    expect(isValidHex("#fffa")).toBe(true);
    expect(isValidHex("#ffffff")).toBe(true);
    expect(isValidHex("#ffffff80")).toBe(true);
    expect(isValidHex("fff")).toBe(true); // no leading hash
  });

  it("rejects malformed hex", () => {
    expect(isValidHex("#ffff")).toBe(true); // 4-digit shorthand is valid
    expect(isValidHex("#fffff")).toBe(false);
    expect(isValidHex("#fffffffff")).toBe(false);
    expect(isValidHex("hello")).toBe(false);
    expect(isValidHex("#gggggg")).toBe(false);
  });
});

describe("normalizeHex", () => {
  it("normalizes 3-digit shorthand", () => {
    expect(normalizeHex("#abc")).toBe("#aabbcc");
  });

  it("normalizes 4-digit shorthand to 8-digit", () => {
    expect(normalizeHex("#abcd")).toBe("#aabbccdd");
  });

  it("keeps 6-digit hex as-is", () => {
    expect(normalizeHex("#ff6600")).toBe("#ff6600");
  });

  it("keeps 8-digit hex as-is", () => {
    expect(normalizeHex("#ff660080")).toBe("#ff660080");
  });
});

describe("hexToRgba", () => {
  it("parses opaque 6-digit hex with alpha = 100", () => {
    expect(hexToRgba("#336699")).toEqual({ r: 51, g: 102, b: 153, a: 100 });
  });

  it("parses 8-digit hex alpha", () => {
    expect(hexToRgba("#33669940")).toEqual({ r: 51, g: 102, b: 153, a: 25 });
    expect(hexToRgba("#ff0000ff")).toEqual({ r: 255, g: 0, b: 0, a: 100 });
    expect(hexToRgba("#ff000000")).toEqual({ r: 255, g: 0, b: 0, a: 0 });
  });

  it("falls back to black when invalid", () => {
    expect(hexToRgba("nope")).toEqual({ r: 0, g: 0, b: 0, a: 100 });
  });
});

describe("rgbToHex", () => {
  it("outputs 6-digit hex for opaque colors", () => {
    expect(rgbToHex(255, 102, 0)).toBe("#ff6600");
    expect(rgbToHex(51, 102, 153, 100)).toBe("#336699");
  });

  it("outputs 8-digit hex when alpha < 100", () => {
    expect(rgbToHex(255, 102, 0, 50)).toBe("#ff660080");
    expect(rgbToHex(255, 102, 0, 0)).toBe("#ff660000");
  });

  it("clamps out-of-range channels", () => {
    expect(rgbToHex(300, -5, 0)).toBe("#ff0000");
  });
});

describe("hsbToHex with alpha", () => {
  it("keeps 6-digit output for opaque colors", () => {
    expect(hsbToHex(0, 100, 100)).toBe("#ff0000");
    expect(hsbToHex(0, 100, 100, 100)).toBe("#ff0000");
  });

  it("adds alpha channel when alpha < 100", () => {
    expect(hsbToHex(0, 100, 100, 50)).toBe("#ff000080");
  });
});

describe("round-trips", () => {
  // Integer channel rounding can shift a hex by ±1 per leg; compare with tolerance.
  function rgbCloseTo(actual: string, expected: string, tol = 2) {
    const a = hexToRgb(actual);
    const e = hexToRgb(expected);
    expect(Math.abs(a.r - e.r)).toBeLessThanOrEqual(tol);
    expect(Math.abs(a.g - e.g)).toBeLessThanOrEqual(tol);
    expect(Math.abs(a.b - e.b)).toBeLessThanOrEqual(tol);
  }

  it("hexToHsb then hsbToHex preserves the color", () => {
    const { h, s, b } = hexToHsb("#339af0");
    rgbCloseTo(hsbToHex(h, s, b), "#339af0");
  });

  it("hexToHsl then hslToHex preserves the color", () => {
    const { h, s, l } = hexToHsl("#339af0");
    rgbCloseTo(hslToHex(h, s, l), "#339af0");
  });

  it("hexToHsb ignores alpha but hexToRgba keeps it", () => {
    const hsb = hexToHsb("#339af040");
    expect(hsb).toEqual({ h: 207, s: 79, b: 94 });
    expect(hexToRgba("#339af040").a).toBe(25);
  });

  it("hexToRgb ignores alpha", () => {
    expect(hexToRgb("#ff000080")).toEqual({ r: 255, g: 0, b: 0 });
  });
});

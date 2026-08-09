import { describe, expect, it } from "vitest";
import {
  transformTextCase,
  getLineHeight,
  getTextLines,
  getTextBlockWidth,
  getTextBlockHeight,
  getTextAutoBox,
  computeAutoSize,
} from "../../lib/editor/textMeasure";

const base = {
  fontFamily: "Inter",
  fontSize: 16,
  fontWeight: 400,
  italic: false,
  letterSpacing: 0,
  textCase: "ORIGINAL" as const,
};

describe("transformTextCase", () => {
  it("returns original text untouched", () => {
    expect(transformTextCase("Hello World", "ORIGINAL")).toBe("Hello World");
  });
  it("uppercases", () => {
    expect(transformTextCase("hello world", "UPPER")).toBe("HELLO WORLD");
  });
  it("lowercases", () => {
    expect(transformTextCase("Hello WORLD", "LOWER")).toBe("hello world");
  });
  it("title cases each word", () => {
    expect(transformTextCase("hello world foo", "TITLE")).toBe("Hello World Foo");
  });
});

describe("getLineHeight", () => {
  it("defaults to fontSize * 1.4", () => {
    expect(getLineHeight({ fontSize: 16, lineHeight: undefined })).toBe(22.4);
  });
  it("uses explicit lineHeight", () => {
    expect(getLineHeight({ fontSize: 16, lineHeight: 24 })).toBe(24);
  });
});

describe("getTextLines", () => {
  it("splits on newlines for auto-width boxes", () => {
    const lines = getTextLines("Hello\nWorld", base, 0);
    expect(lines.map((l) => l.text)).toEqual(["Hello", "World"]);
  });
  it("wraps long lines on word boundaries for fixed boxes", () => {
    const lines = getTextLines("Hello World Here", { ...base, fontSize: 20 }, 60);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.flatMap((l) => l.text).join(" ").replace(/\s+/g, " ")).toContain("Hello");
  });
  it("applies text case to line content", () => {
    const lines = getTextLines("hello world", { ...base, textCase: "UPPER" }, 0);
    expect(lines[0].text).toBe("HELLO WORLD");
  });
});

describe("getTextBlockHeight", () => {
  it("computes lines * lineHeight", () => {
    const lines = getTextLines("a\nb\nc", base, 0);
    expect(getTextBlockHeight(lines, { fontSize: 16, lineHeight: 20 })).toBe(60);
  });
});

describe("getTextAutoBox (A11 — single source of truth for auto-width boxes)", () => {
  it("box width equals the measured block width for a known string/font-size", () => {
    const props = { ...base, content: "Hello World", width: "auto" as const, lineHeight: 22.4 };
    const box = getTextAutoBox(props, "Hello World");
    const measured = getTextBlockWidth(getTextLines("Hello World", base, 0));
    expect(box.width).toBe(Math.max(measured, 20));
    // Sanity: a 11-char string at 16px measures > minimum
    expect(box.width).toBeGreaterThanOrEqual(20);
  });
  it("enforces a minimum width of 20px", () => {
    const box = getTextAutoBox({ ...base, width: "auto" as const }, "x");
    expect(box.width).toBe(20);
  });
  it("heights multi-line auto text as lines × lineHeight", () => {
    const box = getTextAutoBox(
      { ...base, width: "auto" as const, lineHeight: 20 },
      "a\nb\nc",
    );
    expect(box.height).toBe(60);
  });
  it("keeps fixed boxes at their explicit width/height", () => {
    const box = getTextAutoBox(
      { ...base, width: 200, height: 40 },
      "Hello",
    );
    expect(box).toEqual({ width: 200, height: 40 });
  });
  it("includes letter spacing in the measured width", () => {
    const spaced = getTextAutoBox(
      { ...base, width: "auto" as const, letterSpacing: 4 },
      "abc",
    );
    const plain = getTextAutoBox({ ...base, width: "auto" as const }, "abc");
    expect(spaced.width).toBeGreaterThan(plain.width);
  });
});

describe("computeAutoSize", () => {
  const props = {
    ...base,
    width: "auto" as const,
    height: 24,
    lineHeight: undefined,
    textAutoResize: "WIDTH_AND_HEIGHT" as const,
  };
  it("sizes width and height to content in WIDTH_AND_HEIGHT mode", () => {
    const size = computeAutoSize(props, "Hi");
    expect(size.width).toBeGreaterThan(0);
    // one line → 1 * 16 * 1.4 = 22.4
    expect(size.height).toBe(22.4);
  });
  it("heights multi-line content in HEIGHT mode", () => {
    const size = computeAutoSize(
      { ...props, width: 200, textAutoResize: "HEIGHT" as const },
      "a\nb",
    );
    expect(size.width).toBeUndefined();
    expect(size.height).toBe(44.8);
  });
  it("keeps size in NONE (fixed) mode", () => {
    const size = computeAutoSize(
      { ...props, width: 200, textAutoResize: "NONE" as const },
      "Hello",
    );
    expect(size).toEqual({});
  });
});

import { describe, it, expect } from "vitest";
import { buildSvgString } from "../../lib/export";
import type { LayerType } from "../../context/EditorContext";
import type { TextElementProperties } from "../../components/editor-canvas/ElementsRenderer";

// ═══════════════════════════════════════════════════════════════════════════════
//  buildSvgString — pure function tests (TDD approach)
// ═══════════════════════════════════════════════════════════════════════════════

describe("buildSvgString", () => {
  // ── Fixture helpers ──────────────────────────────────────────────────────────

  const makeLayer = (overrides?: Partial<LayerType>): LayerType => ({
    id: `layer-${Date.now()}`,
    name: "Text Layer",
    type: "text",
    locked: false,
    visible: true,
    ...overrides,
  });

  const makeTextProps = (
    overrides?: Partial<TextElementProperties>,
  ): TextElementProperties => ({
    type: "text",
    x: 100,
    y: 100,
    width: "auto",
    height: 30,
    content: "Hello World",
    fontFamily: "Poppins",
    fontSize: 16,
    fontWeight: 400,
    color: "#ffffff",
    textAlign: "left",
    textAlignVertical: "top",
    ...overrides,
  });

  // ── RED: Write failing test first ────────────────────────────────────────────

  // Test 1: Generated SVG should be valid XML with properly escaped entities
  // This test SHOULD FAIL initially because & in Google Fonts URL is not escaped
  it("generates valid SVG XML with properly escaped ampersands", () => {
    const layers: LayerType[] = [makeLayer({ id: "text-1" })];
    const elementProperties: Record<string, TextElementProperties> = {
      "text-1": makeTextProps({ content: "Test" }),
    };

    const svgString = buildSvgString({
      frameSize: { width: 800, height: 200 },
      layers,
      elementProperties,
    });

    // Check that ampersands in text content are escaped properly
    // (CSS @import URLs inside <style> blocks may contain raw & for font loading)
    expect(svgString).not.toContain("A & B");

    // CSS @import URLs must use raw & for fonts to load correctly
    expect(svgString).toContain("&family=");
    expect(svgString).toContain("&display=");
  });

  // Test 2: Text content should be properly escaped
  it("escapes special characters in text content", () => {
    const layers: LayerType[] = [makeLayer({ id: "text-1" })];
    const elementProperties: Record<string, TextElementProperties> = {
      "text-1": makeTextProps({ content: "Tom & Jerry <friends>" }),
    };

    const svgString = buildSvgString({
      frameSize: { width: 800, height: 200 },
      layers,
      elementProperties,
    });

    // Text content should have XML entities escaped
    expect(svgString).toContain("Tom &amp; Jerry &lt;friends&gt;");
    expect(svgString).not.toContain("Tom & Jerry");
  });

  // Test 3: Basic SVG structure is correct
  it("generates SVG with correct basic structure", () => {
    const svgString = buildSvgString({
      frameSize: { width: 800, height: 200 },
      layers: [],
      elementProperties: {},
    });

    expect(svgString).toContain("<?xml");
    expect(svgString).toContain("<svg");
    expect(svgString).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svgString).toContain("</svg>");
    expect(svgString).toContain('viewBox="0 0 800 200"');
  });

  // Test 4: Frame dimensions are correctly applied
  it("applies frame dimensions to SVG root element", () => {
    const svgString = buildSvgString({
      frameSize: { width: 1024, height: 512 },
      layers: [],
      elementProperties: {},
    });

    expect(svgString).toContain('width="1024"');
    expect(svgString).toContain('height="512"');
    expect(svgString).toContain('viewBox="0 0 1024 512"');
  });

  // Test 5: Text elements are included in output
  it("includes visible text elements in SVG output", () => {
    const layers: LayerType[] = [
      makeLayer({ id: "text-1", visible: true }),
      makeLayer({ id: "text-2", visible: false }),
    ];
    const elementProperties: Record<string, TextElementProperties> = {
      "text-1": makeTextProps({ content: "Visible Text" }),
      "text-2": makeTextProps({ content: "Hidden Text" }),
    };

    const svgString = buildSvgString({
      frameSize: { width: 800, height: 200 },
      layers,
      elementProperties,
    });

    expect(svgString).toContain("Visible Text");
    expect(svgString).not.toContain("Hidden Text");
  });

  // Test 6: Empty text content is excluded
  it("excludes empty text elements from SVG output", () => {
    const layers: LayerType[] = [makeLayer({ id: "text-1" })];
    const elementProperties: Record<string, TextElementProperties> = {
      "text-1": makeTextProps({ content: "   " }), // Whitespace only
    };

    const svgString = buildSvgString({
      frameSize: { width: 800, height: 200 },
      layers,
      elementProperties,
    });

    // Empty/whitespace-only content should be excluded
    expect(svgString).not.toContain("<text");
  });

  // Test 7: Custom background color is applied
  it("applies custom background color to rect element", () => {
    const svgString = buildSvgString({
      frameSize: { width: 800, height: 200 },
      layers: [],
      elementProperties: {},
      backgroundColor: "#ff0000",
    });

    expect(svgString).toContain('fill="#ff0000"');
  });

  // Test 8: Rounded corners option works
  it("applies rounded corners when rounded option is true", () => {
    const svgStringRounded = buildSvgString({
      frameSize: { width: 800, height: 200 },
      layers: [],
      elementProperties: {},
      rounded: true,
      borderRadius: 20,
    });

    const svgStringNotRounded = buildSvgString({
      frameSize: { width: 800, height: 200 },
      layers: [],
      elementProperties: {},
      rounded: false,
    });

    expect(svgStringRounded).toContain('rx="20"');
    expect(svgStringNotRounded).not.toContain('rx="');
  });

  // Test 9: Border option works
  it("applies border when showBorder option is true", () => {
    const svgStringWithBorder = buildSvgString({
      frameSize: { width: 800, height: 200 },
      layers: [],
      elementProperties: {},
      showBorder: true,
    });

    const svgStringNoBorder = buildSvgString({
      frameSize: { width: 800, height: 200 },
      layers: [],
      elementProperties: {},
      showBorder: false,
    });

    expect(svgStringWithBorder).toContain('stroke="rgba(255,255,255,0.10)"');
    expect(svgStringWithBorder).toContain('stroke-width="1"');
    expect(svgStringNoBorder).not.toContain("stroke=");
  });

  // Test 9b: Transparent background option (A12)
  it("renders a transparent background rect when transparent is set", () => {
    const svg = buildSvgString({
      frameSize: { width: 800, height: 200 },
      layers: [],
      elementProperties: {},
      backgroundColor: "transparent",
      rounded: false,
      showBorder: false,
    });
    expect(svg).toContain('fill="transparent"');
    expect(svg).not.toContain("#09090b");
  });

  // Test 10: Text alignment is correctly applied (fixed-width boxes anchor per alignment)
  it("applies correct text-anchor for different alignments", () => {
    const fixed = { width: 200, textAutoResize: "NONE" as const };
    const svgStringLeft = buildSvgString({
      frameSize: { width: 800, height: 200 },
      layers: [makeLayer({ id: "text-1" })],
      elementProperties: {
        "text-1": makeTextProps({ content: "Test", textAlign: "left", ...fixed }),
      },
    });

    const svgStringCenter = buildSvgString({
      frameSize: { width: 800, height: 200 },
      layers: [makeLayer({ id: "text-1" })],
      elementProperties: {
        "text-1": makeTextProps({ content: "Test", textAlign: "center", ...fixed }),
      },
    });

    const svgStringRight = buildSvgString({
      frameSize: { width: 800, height: 200 },
      layers: [makeLayer({ id: "text-1" })],
      elementProperties: {
        "text-1": makeTextProps({ content: "Test", textAlign: "right", ...fixed }),
      },
    });

    expect(svgStringLeft).toContain('text-anchor="start"');
    expect(svgStringCenter).toContain('text-anchor="middle"');
    expect(svgStringRight).toContain('text-anchor="end"');
  });

  // Test 11: Justify alignment renders start-anchored (single-line text)
  it("renders justify alignment as start-anchored", () => {
    const svgString = buildSvgString({
      frameSize: { width: 800, height: 200 },
      layers: [makeLayer({ id: "text-1" })],
      elementProperties: {
        "text-1": makeTextProps({ content: "Test", textAlign: "justify" }),
      },
    });

    expect(svgString).toContain('text-anchor="start"');
  });

  // Test 12: Vertical alignment shifts the whole text block (open-pencil: textAlignVertical)
  it("applies correct baseline y for vertical alignments", () => {
    const props = { content: "Test", height: 40, fontSize: 16 };

    const svgTop = buildSvgString({
      frameSize: { width: 800, height: 200 },
      layers: [makeLayer({ id: "text-1" })],
      elementProperties: {
        "text-1": makeTextProps({ ...props, textAlignVertical: "top" }),
      },
    });
    const svgCenter = buildSvgString({
      frameSize: { width: 800, height: 200 },
      layers: [makeLayer({ id: "text-1" })],
      elementProperties: {
        "text-1": makeTextProps({ ...props, textAlignVertical: "center" }),
      },
    });
    const svgBottom = buildSvgString({
      frameSize: { width: 800, height: 200 },
      layers: [makeLayer({ id: "text-1" })],
      elementProperties: {
        "text-1": makeTextProps({ ...props, textAlignVertical: "bottom" }),
      },
    });

    // top: baseline = fontSize = 16
    // center: offset (40 - 22.4)/2 + 16 = 24.8; bottom: (40 - 22.4) + 16 = 33.6
    expect(svgTop).toContain('y="16"');
    expect(svgCenter).toContain('y="24.8"');
    expect(svgBottom).toContain('y="33.6"');
  });

  // Test 13: Auto-width text boxes anchor lines at the left edge (open-pencil default)
  it("anchors auto-width text at start regardless of alignment", () => {
    const svgString = buildSvgString({
      frameSize: { width: 800, height: 200 },
      layers: [makeLayer({ id: "text-1" })],
      elementProperties: {
        "text-1": makeTextProps({
          content: "Test",
          textAlign: "center",
          width: "auto",
        }),
      },
    });
    expect(svgString).toContain('text-anchor="start"');
    expect(svgString).toContain('x="0"');
  });

  // Test 14: Multi-line text renders one <text> per line with line-height spacing
  it("renders multi-line text as one <text> per line", () => {
    const svgString = buildSvgString({
      frameSize: { width: 800, height: 200 },
      layers: [makeLayer({ id: "text-1" })],
      elementProperties: {
        "text-1": makeTextProps({
          content: "Hello\nWorld",
          fontSize: 16,
          lineHeight: 24,
        }),
      },
    });
    expect(svgString).toContain("Hello");
    expect(svgString).toContain("World");
    // line 1 baseline = 16, line 2 = 16 + 24 = 40
    expect(svgString).toContain('y="16"');
    expect(svgString).toContain('y="40"');
  });

  // Test 15: Text case transforms content (open-pencil: textCase)
  it("applies text case transforms", () => {
    const svgUpper = buildSvgString({
      frameSize: { width: 800, height: 200 },
      layers: [makeLayer({ id: "text-1" })],
      elementProperties: {
        "text-1": makeTextProps({ content: "hello world", textCase: "UPPER" }),
      },
    });
    const svgTitle = buildSvgString({
      frameSize: { width: 800, height: 200 },
      layers: [makeLayer({ id: "text-1" })],
      elementProperties: {
        "text-1": makeTextProps({ content: "hello world", textCase: "TITLE" }),
      },
    });
    expect(svgUpper).toContain(">HELLO WORLD</text>");
    expect(svgTitle).toContain(">Hello World</text>");
  });

  // Test 16: Italic + underline render font-style and a decoration line
  it("renders italic and underline decorations", () => {
    const svgString = buildSvgString({
      frameSize: { width: 800, height: 200 },
      layers: [makeLayer({ id: "text-1" })],
      elementProperties: {
        "text-1": makeTextProps({
          content: "Test",
          italic: true,
          textDecoration: "UNDERLINE",
        }),
      },
    });
    expect(svgString).toContain('font-style="italic"');
    expect(svgString).toContain("<line ");
  });

  // Test 17: Letter spacing is emitted on the text element
  it("emits letter-spacing attribute", () => {
    const svgString = buildSvgString({
      frameSize: { width: 800, height: 200 },
      layers: [makeLayer({ id: "text-1" })],
      elementProperties: {
        "text-1": makeTextProps({ content: "Test", letterSpacing: 2 }),
      },
    });
    expect(svgString).toContain('letter-spacing="2"');
  });
});

describe("buildSvgString — masks, flips, boolean subpaths (A4/A6/A2)", () => {
  const makeShape = (overrides?: Partial<LayerType>): LayerType => ({
    id: `shape-${Date.now()}`,
    name: "Shape",
    type: "shape",
    locked: false,
    visible: true,
    ...overrides,
  });

  const makeShapeProps = (overrides?: Record<string, unknown>) => ({
    type: "shape" as const,
    kind: "rect" as const,
    x: 10,
    y: 10,
    width: 100,
    height: 50,
    fill: "#ff0000",
    stroke: "none",
    strokeWidth: 0,
    opacity: 1,
    ...overrides,
  });

  it("emits a clipPath + clip-path for a masked group (A4)", () => {
    const layers: LayerType[] = [
      { id: "g", name: "Group", type: "group", locked: false, visible: true },
      {
        id: "mask",
        name: "Mask",
        type: "shape",
        locked: false,
        visible: true,
        parentId: "g",
        masked: true,
      },
      {
        id: "kid",
        name: "Kid",
        type: "shape",
        locked: false,
        visible: true,
        parentId: "g",
      },
    ];
    const elementProperties = {
      mask: makeShapeProps({ x: 20, y: 20, width: 60, height: 40 }),
      kid: makeShapeProps({ x: 5, y: 5, width: 100, height: 50 }),
    };
    const svg = buildSvgString({
      frameSize: { width: 300, height: 200 },
      layers,
      elementProperties,
    });
    expect(svg).toContain('<clipPath id="mask-g">');
    expect(svg).toContain('clip-path="url(#mask-g)"');
  });

  it("wraps flipH/flipV around the element center in export (A6)", () => {
    const svgFlipH = buildSvgString({
      frameSize: { width: 300, height: 200 },
      layers: [makeShape({ id: "s1" })],
      elementProperties: {
        s1: makeShapeProps({ flipH: true }),
      },
    });
    // cx = 10 + 50 = 60, cy = 10 + 25 = 35
    expect(svgFlipH).toContain('transform="translate(60, 35) scale(-1, 1) translate(-60, -35)"');

    const svgFlipV = buildSvgString({
      frameSize: { width: 300, height: 200 },
      layers: [makeShape({ id: "s2" })],
      elementProperties: {
        s2: makeShapeProps({ flipV: true }),
      },
    });
    expect(svgFlipV).toContain('transform="translate(60, 35) scale(1, -1) translate(-60, -35)"');

    // Both flips combine (scale(-1, -1)) — previously impossible (else-if bug).
    const svgBoth = buildSvgString({
      frameSize: { width: 300, height: 200 },
      layers: [makeShape({ id: "s3" })],
      elementProperties: {
        s3: makeShapeProps({ flipH: true, flipV: true }),
      },
    });
    expect(svgBoth).toContain('scale(-1, -1)');
  });

  it("wraps image flips around the element center in export (A6)", () => {
    const svg = buildSvgString({
      frameSize: { width: 300, height: 200 },
      layers: [{ id: "img", name: "img", type: "image", locked: false, visible: true }],
      elementProperties: {
        img: {
          type: "image",
          x: 0,
          y: 0,
          width: 40,
          height: 20,
          url: "data:image/png;base64,AAAA",
          opacity: 1,
          flipH: true,
        },
      },
    });
    // cx = 20, cy = 10
    expect(svg).toContain('transform="translate(20, 10) scale(-1, 1) translate(-20, -10)"');
  });

  it("emits boolean-result subpaths as extra path loops (A2)", () => {
    const svg = buildSvgString({
      frameSize: { width: 300, height: 200 },
      layers: [{ id: "p", name: "p", type: "shape", locked: false, visible: true }],
      elementProperties: {
        p: {
          type: "path",
          x: 0,
          y: 0,
          width: 20,
          height: 20,
          points: [
            [0, 0],
            [20, 0],
            [20, 20],
            [0, 20],
          ],
          subpaths: [
            [
              [5, 5],
              [15, 5],
              [15, 15],
              [5, 15],
            ],
          ],
          stroke: "none",
          strokeWidth: 0,
          fill: "#fff",
          opacity: 1,
          closed: true,
        },
      },
    });
    // The d attribute contains two M subpaths
    const dMatch = svg.match(/d="([^"]+)"/);
    expect(dMatch).not.toBeNull();
    expect(dMatch![1].match(/M /g)!.length).toBe(2);
  });
});

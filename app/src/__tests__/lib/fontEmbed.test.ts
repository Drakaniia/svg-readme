import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  collectUsedFonts,
  buildFontFaceCSS,
  embedFonts,
  type FontFaceData,
} from "../../lib/fontEmbed";
import type { ElementProperties } from "../../components/editor-canvas/ElementsRenderer";

function textProps(overrides: Partial<Extract<ElementProperties, { type: "text" }>>): ElementProperties {
  return {
    type: "text",
    x: 0,
    y: 0,
    width: "auto",
    height: 24,
    content: "Hello",
    fontFamily: "Poppins",
    fontSize: 16,
    fontWeight: 400,
    color: "#ffffff",
    textAlign: "left",
    textAlignVertical: "top",
    ...overrides,
  };
}

describe("collectUsedFonts", () => {
  it("collects unique family/weight pairs from text elements", () => {
    const props: Record<string, ElementProperties> = {
      a: textProps({ fontFamily: "Poppins", fontWeight: 400 }),
      b: textProps({ fontFamily: "Poppins", fontWeight: 400 }),
      c: textProps({ fontFamily: "JetBrains Mono", fontWeight: 700 }),
    };
    expect(collectUsedFonts(props)).toEqual([
      { family: "Poppins", weight: 400 },
      { family: "JetBrains Mono", weight: 700 },
    ]);
  });

  it("ignores non-text elements", () => {
    const props: Record<string, ElementProperties> = {
      a: {
        type: "shape",
        kind: "rect",
        x: 0, y: 0, width: 10, height: 10,
        fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1,
      },
      b: textProps({ fontFamily: "Inter", fontWeight: 500 }),
    };
    expect(collectUsedFonts(props)).toEqual([
      { family: "Inter", weight: 500 },
    ]);
  });

  it("returns empty when there is no text", () => {
    expect(collectUsedFonts({})).toEqual([]);
  });
});

describe("buildFontFaceCSS", () => {
  it("emits @font-face rules with data URLs", () => {
    const fonts: FontFaceData[] = [
      {
        family: "Poppins",
        weight: 400,
        dataUrl: "data:font/ttf;base64,AAAA",
        format: "truetype",
      },
    ];
    const css = buildFontFaceCSS(fonts);
    expect(css).toContain('font-family: "Poppins"');
    expect(css).toContain("font-weight: 400");
    expect(css).toContain("url(data:font/ttf;base64,AAAA)");
  });
});

describe("embedFonts", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Mock fetch: local TTF assets return font bytes; Google Fonts CSS returns
    // a CSS document pointing at a gstatic woff2, which also returns bytes.
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("fonts.googleapis.com/css2")) {
        return {
          ok: true,
          text: async () =>
            `/* latin */\n@font-face { font-family: 'Inter'; font-style: normal; font-weight: 400; src: url(https://fonts.gstatic.com/s/inter/xxx.woff2) format('woff2'); }`,
        } as Response;
      }
      if (u.includes(".woff2")) {
        return {
          ok: true,
          arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
        } as Response;
      }
      // Local TTF asset
      return {
        ok: true,
        arrayBuffer: async () => new Uint8Array([9, 8, 7, 6]).buffer,
      } as Response;
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it("replaces the Google Fonts @import with inline @font-face rules", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><defs><style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap');
    </style></defs><text font-family="Poppins" font-weight="400">Hi</text></svg>`;

    const props: Record<string, ElementProperties> = {
      a: textProps({ fontFamily: "Poppins", fontWeight: 400 }),
    };

    const out = await embedFonts(svg, props);
    expect(out).not.toContain("fonts.googleapis.com");
    expect(out).toContain("@font-face");
    expect(out).toContain("data:font/ttf;base64");
    // Keep the <text> content untouched
    expect(out).toContain('font-family="Poppins"');
  });

  it("falls back to Google Fonts woff2 for families without local assets", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><defs><style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap');
    </style></defs></svg>`;
    const props: Record<string, ElementProperties> = {
      a: textProps({ fontFamily: "Inter", fontWeight: 400 }),
    };
    const out = await embedFonts(svg, props);
    expect(out).toContain("data:font/woff2;base64");
  });

  it("returns the SVG unchanged when no text elements exist", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><defs><style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap');
    </style></defs></svg>`;
    const out = await embedFonts(svg, {});
    expect(out).toBe(svg);
  });

  it("handles fetch failures gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><defs><style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap');
    </style></defs></svg>`;
    const props: Record<string, ElementProperties> = {
      a: textProps({ fontFamily: "Poppins", fontWeight: 400 }),
    };
    const out = await embedFonts(svg, props);
    // No crash; returns original SVG
    expect(out).toBe(svg);
  });
});

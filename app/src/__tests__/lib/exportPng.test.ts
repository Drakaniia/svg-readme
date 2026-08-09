import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock window.Image before importing the module
const originalImage = globalThis.Image;

describe("exportPng", () => {
  beforeEach(() => {
    // Mock canvas
    const mockCtx = {
      drawImage: vi.fn(),
      canvas: { width: 0, height: 0 },
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(mockCtx);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) => {
      cb(new Blob(["fake-png-data"], { type: "image/png" }));
    });

    // Mock Image constructor
    const MockImage = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = "";
      constructor() {
        setTimeout(() => this.onload?.(), 0);
      }
    } as unknown as typeof Image;
    (globalThis as unknown as { Image: typeof Image }).Image = MockImage;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.Image = originalImage;
  });

  it("rasterizes an SVG string to a PNG blob", async () => {
    const { svgStringToPngBlob } = await import("../../lib/exportPng");
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="100" height="50" fill="red"/></svg>';
    const blob = await svgStringToPngBlob(svg, 100, 50, 1);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/png");
  });

  it("scales the canvas by the scale factor", async () => {
    const { svgStringToPngBlob } = await import("../../lib/exportPng");
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="100" height="50" fill="red"/></svg>';
    const blob = await svgStringToPngBlob(svg, 100, 50, 3);
    expect(blob).toBeInstanceOf(Blob);
  });

  it("inlines fonts when elementProperties are provided", async () => {
    // Mock fetch so font embedding can resolve local assets
    const originalFetch = globalThis.fetch;
    (globalThis as unknown as { fetch: typeof fetch }).fetch = (async () => ({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      text: async () => "",
    })) as typeof fetch;
    try {
      const { svgStringToPngBlob } = await import("../../lib/exportPng");
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><defs><style>\n      @import url(\'https://fonts.googleapis.com/css2?family=Inter&display=swap\');\n    </style></defs><text font-family="Poppins" font-weight="400">Hi</text></svg>';
      const props = {
        a: {
          type: "text" as const,
          x: 0, y: 0, width: "auto" as const, height: 24,
          content: "Hi", fontFamily: "Poppins", fontSize: 16,
          fontWeight: 400, color: "#fff", textAlign: "left" as const,
          textAlignVertical: "top" as const,
        },
      };
      const blob = await svgStringToPngBlob(svg, 100, 50, 1, props);
      expect(blob).toBeInstanceOf(Blob);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

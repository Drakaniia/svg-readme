import type { ElementProperties } from "../components/editor-canvas/ElementsRenderer";

/**
 * Font embedding for raster exports (PNG / GIF / PNG-sequence).
 *
 * Browsers block external resource loading (including the Google Fonts
 * `@import`) inside an SVG rendered via `<img>`. To make rasterized banners
 * keep the editor's typography, we inline `@font-face` rules whose `src` is a
 * base64 data URL of the actual font file.
 *
 * Strategy:
 *   1. Collect the unique (family, weight) pairs used by text elements.
 *   2. Resolve each pair to font bytes:
 *      - Poppins / JetBrains Mono are bundled locally (TTF assets).
 *      - Other families (Inter, Roboto, Outfit, …) are fetched from the
 *        Google Fonts CSS2 API (which is CORS-enabled), parsing out the woff2
 *        file URL.
 *   3. Replace the `@import url('https://fonts.googleapis.com/...')` line in
 *      the SVG's <style> block with the generated @font-face rules.
 *
 * All network calls fail softly: if anything goes wrong the SVG is returned
 * unchanged so the export still completes (with fallback fonts, as before).
 */

export interface FontRequest {
  family: string;
  weight: number;
}

export interface FontFaceData {
  family: string;
  weight: number;
  dataUrl: string;
  format: "truetype" | "woff2";
}

/** Unique (family, weight) pairs used by text elements in the document. */
export function collectUsedFonts(
  elementProperties: Record<string, ElementProperties>,
): FontRequest[] {
  const seen = new Set<string>();
  const result: FontRequest[] = [];
  for (const props of Object.values(elementProperties)) {
    if (!props || props.type !== "text") continue;
    const family = (props.fontFamily || "Inter").trim();
    const weight = props.fontWeight || 400;
    const key = `${family}:${weight}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ family, weight });
  }
  return result;
}

/** Build @font-face CSS rules from resolved font data. */
export function buildFontFaceCSS(fonts: FontFaceData[]): string {
  return fonts
    .map(
      (f) =>
        `  @font-face {\n` +
        `    font-family: "${f.family}";\n` +
        `    font-style: normal;\n` +
        `    font-weight: ${f.weight};\n` +
        `    font-display: swap;\n` +
        `    src: url(${f.dataUrl}) format("${f.format}");\n` +
        `  }`,
    )
    .join("\n");
}

// ─── Local font assets (bundled by Vite) ─────────────────────────────────────

import poppinsRegular from "../assets/fonts/poppins/regular.ttf?url";
import poppinsMedium from "../assets/fonts/poppins/medium.ttf?url";
import poppinsSemiBold from "../assets/fonts/poppins/semi-bold.ttf?url";
import poppinsBold from "../assets/fonts/poppins/bold.ttf?url";
import jbmRegular from "../assets/fonts/jetbrains-mono/static/regular.ttf?url";
import jbmMedium from "../assets/fonts/jetbrains-mono/static/medium.ttf?url";
import jbmBold from "../assets/fonts/jetbrains-mono/static/bold.ttf?url";

/** Bundled font files: family → weight → asset URL (TTF). */
const LOCAL_FONT_ASSETS: Record<string, Record<number, string>> = {
  Poppins: {
    400: poppinsRegular,
    500: poppinsMedium,
    600: poppinsSemiBold,
    700: poppinsBold,
  },
  "JetBrains Mono": {
    400: jbmRegular,
    500: jbmMedium,
    700: jbmBold,
  },
};

// ─── Byte → data URL helpers ─────────────────────────────────────────────────

function arrayBufferToDataUrl(buffer: ArrayBuffer, mime: string): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/** Fetch a URL and convert the response body to a base64 data URL. */
async function fetchToDataUrl(url: string, mime: string): Promise<string | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const buffer = await res.arrayBuffer();
  return arrayBufferToDataUrl(buffer, mime);
}

// ─── Google Fonts fallback ───────────────────────────────────────────────────

const GOOGLE_FONTS_CSS =
  "https://fonts.googleapis.com/css2?family={FAMILY}:wght@{WEIGHT}&display=swap";

/** Extract the first woff2 file URL from a Google Fonts CSS response. */
function extractWoff2Url(css: string): string | null {
  const m = css.match(/url\(\s*(https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\s*\)/i);
  return m ? m[1] : null;
}

async function fetchGoogleFont(family: string, weight: number): Promise<FontFaceData | null> {
  const cssUrl = GOOGLE_FONTS_CSS.replace(
    "{FAMILY}",
    encodeURIComponent(family.replace(/\s+/g, "+")),
  ).replace("{WEIGHT}", String(weight));

  const res = await fetch(cssUrl);
  if (!res.ok) return null;
  const css = await res.text();
  const fontUrl = extractWoff2Url(css);
  if (!fontUrl) return null;

  const dataUrl = await fetchToDataUrl(fontUrl, "font/woff2");
  if (!dataUrl) return null;
  return { family, weight, dataUrl, format: "woff2" };
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

const GOOGLE_IMPORT_RE = /@import\s+url\([^)]*fonts\.googleapis\.com[^)]*\);?/g;

/**
 * Inline fonts used by the document into the exported SVG, replacing the
 * Google Fonts `@import` with @font-face data-URL rules.
 * Returns the SVG unchanged when there is nothing to embed or on failure.
 */
export async function embedFonts(
  svgString: string,
  elementProperties: Record<string, ElementProperties>,
): Promise<string> {
  const requests = collectUsedFonts(elementProperties);
  if (requests.length === 0) return svgString;

  const resolved: FontFaceData[] = [];
  for (const req of requests) {
    try {
      // 1. Local bundled TTF
      const local = LOCAL_FONT_ASSETS[req.family]?.[req.weight];
      if (local) {
        const dataUrl = await fetchToDataUrl(local, "font/ttf");
        if (dataUrl) {
          resolved.push({ family: req.family, weight: req.weight, dataUrl, format: "truetype" });
          continue;
        }
      }
      // 2. Google Fonts woff2
      const google = await fetchGoogleFont(req.family, req.weight);
      if (google) resolved.push(google);
    } catch {
      // Skip this font; keep going with the rest
    }
  }

  if (resolved.length === 0) return svgString;

  const fontFaceBlock = buildFontFaceCSS(resolved);
  const hasGoogleImport = GOOGLE_IMPORT_RE.test(svgString);
  if (hasGoogleImport) {
    return svgString.replace(GOOGLE_IMPORT_RE, fontFaceBlock);
  }
  // No @import present — append the rules at the end of the first <style> block
  return svgString.replace("</style>", `${fontFaceBlock}\n    </style>`);
}

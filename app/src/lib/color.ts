// ─── Color utility functions ─────────────────────────────────────────────────
// Modeled after open-pencil's @open-pencil/core/color utilities.
// Colors are stored as hex strings. Opaque colors use #rrggbb (6 digits);
// colors with transparency use #rrggbbaa (8 digits).

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HSL {
  h: number; // 0–360
  s: number; // 0–100
  l: number; // 0–100
}

export interface HSB {
  h: number; // 0–360
  s: number; // 0–100
  b: number; // 0–100
}

export interface RGBA {
  r: number; // 0–255
  g: number; // 0–255
  b: number; // 0–255
  a: number; // 0–100
}

// ─── Hex validation ──────────────────────────────────────────────────────────

const HEX_RE = /^#?([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function isValidHex(s: string): boolean {
  return HEX_RE.test(s);
}

/** Normalize a hex string to #rrggbb (opaque) or #rrggbbaa (with alpha). */
export function normalizeHex(s: string): string | null {
  if (!isValidHex(s)) return null;
  let h = s.replace("#", "");
  if (h.length === 3 || h.length === 4) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return `#${h}`;
}

// ─── RGB conversion helpers ───────────────────────────────────────────────────

export function hexToRgba(hex: string): RGBA {
  const n = normalizeHex(hex);
  if (!n) return { r: 0, g: 0, b: 0, a: 100 };
  const h = n.slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a =
    h.length === 8 ? Math.round((parseInt(h.slice(6, 8), 16) / 255) * 100) : 100;
  return { r, g, b, a };
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const { r, g, b } = hexToRgba(hex);
  return { r, g, b };
}

/** Convert RGB channels to hex. Pass alpha (0–100) to get an 8-digit hex. */
export function rgbToHex(r: number, g: number, b: number, a?: number): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  const base = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  if (a === undefined || a >= 100) return base;
  const alpha = Math.round((Math.max(0, Math.min(100, a)) / 100) * 255);
  return `${base}${toHex(alpha)}`;
}

// ─── HSL conversions (used for the sat/lightness 2D area) ─────────────────────

export function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const a = sNorm * Math.min(lNorm, 1 - lNorm);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

export function hexToHsl(hex: string): HSL {
  const rgb = hexToRgb(hex);
  if (!rgb) return { h: 0, s: 0, l: 0 };
  const { r, g, b } = rgb;
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rNorm) {
    h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) * 60;
  } else if (max === gNorm) {
    h = ((bNorm - rNorm) / d + 2) * 60;
  } else {
    h = ((rNorm - gNorm) / d + 4) * 60;
  }
  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// ─── HSB conversions (used for the sat/brightness 2D area, matching open-pencil's Reka ColorArea) ──

export function hsbToHex(h: number, s: number, b: number, a?: number): string {
  const sNorm = s / 100;
  const bNorm = b / 100;
  const c = bNorm * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = bNorm - c;
  let r: number, g: number, _b: number;
  if (h < 60) { r = c; g = x; _b = 0; }
  else if (h < 120) { r = x; g = c; _b = 0; }
  else if (h < 180) { r = 0; g = c; _b = x; }
  else if (h < 240) { r = 0; g = x; _b = c; }
  else if (h < 300) { r = x; g = 0; _b = c; }
  else { r = c; g = 0; _b = x; }
  return rgbToHex((r + m) * 255, (g + m) * 255, (_b + m) * 255, a);
}

export function hexToHsb(hex: string): HSB {
  const rgb = hexToRgb(hex);
  if (!rgb) return { h: 0, s: 0, b: 0 };
  const { r, g, b: bVal } = rgb;
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = bVal / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const d = max - Math.min(rNorm, gNorm, bNorm);
  const brightness = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === rNorm) h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) * 60;
    else if (max === gNorm) h = ((bNorm - rNorm) / d + 2) * 60;
    else h = ((rNorm - gNorm) / d + 4) * 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), b: Math.round(brightness * 100) };
}

// ─── Brightness / luminance ───────────────────────────────────────────────────

/** Relative luminance (0–255) — useful for determining text contrast. */
export function hexLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return Math.round(0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b);
}

// ─── CSS color parser ────────────────────────────────────────────────────────

/** Named colors that map to hex. Covers all CSS level-1 and common SVG colors. */
const NAMED_COLORS: Record<string, string> = {
  none: "none",
  transparent: "none",
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  cyan: "#00ffff",
  magenta: "#ff00ff",
  gray: "#808080",
  grey: "#808080",
  silver: "#c0c0c0",
  maroon: "#800000",
  purple: "#800080",
  fuchsia: "#ff00ff",
  lime: "#00ff00",
  olive: "#808000",
  navy: "#000080",
  teal: "#008080",
  aqua: "#00ffff",
  orange: "#ffa500",
  pink: "#ffc0cb",
  brown: "#a52a2a",
  coral: "#ff7f50",
  gold: "#ffd700",
  indigo: "#4b0082",
  ivory: "#fffff0",
  khaki: "#f0e68c",
  lavender: "#e6e6fa",
  mint: "#98ff98",
  plum: "#dda0dd",
  salmon: "#fa8072",
  tan: "#d2b48c",
  tomato: "#ff6347",
  turquoise: "#40e0d0",
  violet: "#ee82ee",
  wheat: "#f5deb3",
};

/**
 * Parse any CSS color value into a hex string (#rrggbb or #rrggbbaa).
 * Handles named colors, hex (#RGB/#RGBA/#RRGGBB/#RRGGBBAA), rgb(), rgba(),
 * hsl(), hsla(), and modern CSS color syntax with percentage/space notation.
 * Returns the original string if it can't be parsed.
 */
export function parseColor(raw: string | null): string {
  if (!raw || raw === "") return "#000000";

  const trimmed = raw.trim().toLowerCase();

  // Named colors
  if (NAMED_COLORS[trimmed] !== undefined) return NAMED_COLORS[trimmed];

  // Hex — already in a good format
  if (trimmed.startsWith("#")) {
    const norm = normalizeHex(trimmed);
    return norm ?? raw;
  }

  // Try modern CSS function notation: rgb(r g b / a) or hsl(h s% l% / a)
  const parsed = parseCssFunctionColor(trimmed);
  if (parsed) return parsed;

  // Fallback — return as-is (could be a CSS variable, currentColor, etc.)
  return raw;
}

/**
 * Parse rgb(), rgba(), hsl(), hsla() — both legacy comma notation and modern
 * space-separated notation.
 */
function parseCssFunctionColor(raw: string): string | null {
  // Match: rgb / rgba / hsl / hsla followed by ( ... )
  const m = raw.match(/^(rgba?|hsla?)\s*\(\s*(.+)\s*\)$/);
  if (!m) return null;

  const fn = m[1];
  const inner = m[2];
  const isHsl = fn.startsWith("hsl");

  // Split on commas OR forward-slash (modern syntax uses / for alpha)
  let parts: string[];
  let alpha: number | undefined;

  const slashIdx = inner.lastIndexOf("/");
  if (slashIdx !== -1) {
    // Modern syntax: "255 0 0 / 0.5" or "0deg 100% 50% / 0.8"
    parts = inner
      .slice(0, slashIdx)
      .trim()
      .split(/\s+/);
    const alphaStr = inner.slice(slashIdx + 1).trim();
    alpha = parseAlpha(alphaStr);
  } else {
    // Legacy comma syntax: "255, 0, 0" or "255, 0, 0, 0.5"
    parts = inner.split(",").map((s) => s.trim());
  }

  if (parts.length < 3) return null;

  if (isHsl) {
    const h = parseHue(parts[0]);
    const s = parsePercent(parts[1]);
    const l = parsePercent(parts[2]);
    if (h !== null && s !== null && l !== null) {
      return hslToHex(h, s, l);
    }
  } else {
    const r = parsePercentOrNumber(parts[0], 255);
    const g = parsePercentOrNumber(parts[1], 255);
    const b = parsePercentOrNumber(parts[2], 255);
    if (r !== null && g !== null && b !== null) {
      if (alpha === undefined && parts.length >= 4) {
        alpha = parseAlpha(parts[3]);
      }
      if (alpha !== undefined && alpha < 100) {
        // Return 8-digit hex with alpha
        return rgbToHex(r, g, b, alpha);
      }
      return rgbToHex(r, g, b);
    }
  }

  return null;
}

function parseHue(s: string): number | null {
  s = s.trim();
  // Handle deg, rad, grad, turn units
  const numMatch = s.match(/^([\d.]+)\s*(deg|rad|grad|turn)?$/);
  if (!numMatch) return null;
  const num = parseFloat(numMatch[1]);
  const unit = numMatch[2] || "deg";
  switch (unit) {
    case "rad":
      return (num * 180) / Math.PI;
    case "grad":
      return num * 0.9;
    case "turn":
      return num * 360;
    default:
      return num;
  }
}

function parsePercent(s: string): number | null {
  s = s.trim();
  if (s.endsWith("%")) return parseFloat(s);
  const n = parseFloat(s);
  if (!isNaN(n)) return n; // bare number (some tools emit this for HSL)
  return null;
}

function parsePercentOrNumber(s: string, max: number): number | null {
  s = s.trim();
  if (s.endsWith("%")) {
    const pct = parseFloat(s);
    return isNaN(pct) ? null : Math.round((pct / 100) * max);
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : Math.round(n);
}

function parseAlpha(s: string): number | undefined {
  s = s.trim();
  if (s.endsWith("%")) {
    const pct = parseFloat(s);
    return isNaN(pct) ? undefined : Math.max(0, Math.min(100, pct));
  }
  const n = parseFloat(s);
  return isNaN(n) ? undefined : Math.round(Math.max(0, Math.min(1, n)) * 100);
}

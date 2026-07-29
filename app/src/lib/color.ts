// ─── Color utility functions ─────────────────────────────────────────────────
// Modeled after open-pencil's @open-pencil/core/color utilities.
// Our schema is simpler: we store colors as hex strings (#rrggbb).
// HSL is used internally for the 2D picker area and hue slider.

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

// ─── Hex validation ──────────────────────────────────────────────────────────

const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHex(s: string): boolean {
  return HEX_RE.test(s);
}

/** Normalize a hex string to 7-char #rrggbb form. */
export function normalizeHex(s: string): string | null {
  if (!isValidHex(s)) return null;
  const h = s.replace("#", "");
  if (h.length === 3) {
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  return `#${h}`;
}

// ─── RGB conversion helpers ───────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  const val = parseInt(n.slice(1), 16);
  return {
    r: (val >> 16) & 0xff,
    g: (val >> 8) & 0xff,
    b: val & 0xff,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
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
  let h = 0;
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

export function hsbToHex(h: number, s: number, b: number): string {
  const sNorm = s / 100;
  const bNorm = b / 100;
  const c = bNorm * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = bNorm - c;
  let r = 0, g = 0, _b = 0;
  if (h < 60) { r = c; g = x; _b = 0; }
  else if (h < 120) { r = x; g = c; _b = 0; }
  else if (h < 180) { r = 0; g = c; _b = x; }
  else if (h < 240) { r = 0; g = x; _b = c; }
  else if (h < 300) { r = x; g = 0; _b = c; }
  else { r = c; g = 0; _b = x; }
  return rgbToHex((r + m) * 255, (g + m) * 255, (_b + m) * 255);
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

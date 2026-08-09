/** Gradient color stop. */
export interface GradientStop {
  offset: number; // 0–1
  color: string; // hex
}

/** Linear gradient definition. */
export interface LinearGradient {
  type: "linear";
  angle: number; // degrees, 0 = left-to-right
  stops: GradientStop[];
}

/** Radial gradient definition. */
export interface RadialGradient {
  type: "radial";
  cx: number; // center x (0–1 fraction)
  cy: number; // center y (0–1 fraction)
  stops: GradientStop[];
}

export type GradientFill = LinearGradient | RadialGradient;

/** Generate a unique gradient ID for SVG <defs>. */
export function gradientId(layerId: string): string {
  return `grad-${layerId}`;
}

/** Check if a fill value is a gradient object vs a plain hex string. */
export function isGradient(fill: string | GradientFill): fill is GradientFill {
  return typeof fill === "object" && fill !== null && "type" in fill;
}

/** Generate SVG attributes for a gradient fill (used on shape/image elements). */
export function gradientUrl(layerId: string): string {
  return `url(#${gradientId(layerId)})`;
}

/** Build the <linearGradient> or <radialGradient> SVG element string. */
export function buildGradientDef(
  id: string,
  gradient: GradientFill,
  _bbox?: { x: number; y: number; width: number; height: number },
): string {
  const stops = gradient.stops
    .map(
      (s) =>
        `        <stop offset="${(s.offset * 100).toFixed(0)}%" stop-color="${s.color}"/>`,
    )
    .join("\n");

  if (gradient.type === "radial") {
    return `      <radialGradient id="${id}" cx="${gradient.cx}" cy="${gradient.cy}" r="0.7">\n${stops}\n      </radialGradient>`;
  }

  const angleRad = (gradient.angle * Math.PI) / 180;
  const x1 = `${((1 - Math.cos(angleRad)) / 2 * 100).toFixed(0)}%`;
  const y1 = `${((1 - Math.sin(angleRad)) / 2 * 100).toFixed(0)}%`;
  const x2 = `${((1 + Math.cos(angleRad)) / 2 * 100).toFixed(0)}%`;
  const y2 = `${((1 + Math.sin(angleRad)) / 2 * 100).toFixed(0)}%`;

  return `      <linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">\n${stops}\n      </linearGradient>`;
}

/** Default gradient presets for quick selection. */
export const GRADIENT_PRESETS: { name: string; gradient: GradientFill }[] = [
  {
    name: "Sunset",
    gradient: {
      type: "linear",
      angle: 135,
      stops: [
        { offset: 0, color: "#f97316" },
        { offset: 1, color: "#ec4899" },
      ],
    },
  },
  {
    name: "Ocean",
    gradient: {
      type: "linear",
      angle: 180,
      stops: [
        { offset: 0, color: "#06b6d4" },
        { offset: 1, color: "#3b82f6" },
      ],
    },
  },
  {
    name: "Forest",
    gradient: {
      type: "linear",
      angle: 90,
      stops: [
        { offset: 0, color: "#22c55e" },
        { offset: 1, color: "#065f46" },
      ],
    },
  },
  {
    name: "Lavender",
    gradient: {
      type: "linear",
      angle: 45,
      stops: [
        { offset: 0, color: "#a855f7" },
        { offset: 1, color: "#6366f1" },
      ],
    },
  },
  {
    name: "Midnight",
    gradient: {
      type: "radial",
      cx: 0.5,
      cy: 0.5,
      stops: [
        { offset: 0, color: "#1e293b" },
        { offset: 1, color: "#020617" },
      ],
    },
  },
  {
    name: "Glow",
    gradient: {
      type: "radial",
      cx: 0.5,
      cy: 0.3,
      stops: [
        { offset: 0, color: "#fef08a" },
        { offset: 0.5, color: "#f59e0b" },
        { offset: 1, color: "#b45309" },
      ],
    },
  },
];

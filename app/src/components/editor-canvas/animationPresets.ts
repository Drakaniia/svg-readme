// ─── Animation Types ──────────────────────────────────────────────────────────

/** Animation configuration for a layer, embedded in the exported SVG as CSS @keyframes. */
export interface AnimationConfig {
  /** CSS @keyframes identifier (e.g. "fadeIn", "slideUp", or a custom name). */
  name: string;
  /** Duration in seconds. */
  duration: number;
  /** Delay in seconds before the animation starts. */
  delay: number;
  /** Number of iterations or "infinite". */
  iterationCount: number | "infinite";
  /** CSS animation-timing-function. */
  timingFunction: string;
  /** CSS animation-direction. */
  direction: "normal" | "reverse" | "alternate" | "alternate-reverse";
  /** CSS animation-fill-mode. */
  fillMode: "none" | "forwards" | "backwards" | "both";
  /** Optional raw @keyframes CSS block. When provided, this is used in the export
   *  instead of looking up the preset by name. Lets users define fully custom animations. */
  customKeyframes?: string;
  /** Optional keyframe timeline markers for the visual timeline editor.
   *  Each entry maps to a percentage point (0-100) with an optional easing hint. */
  keyframes?: { percent: number; easing?: string }[];
}

// ─── Animation Presets ────────────────────────────────────────────────────────

/** Pre-built animation presets — maps a display name to its @keyframes CSS and default config. */
export const ANIMATION_PRESETS: Record<
  string,
  { keyframesCSS: string; defaults: Partial<AnimationConfig> }
> = {
  "Fade In": {
    keyframesCSS: `@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}`,
    defaults: { name: "fadeIn", duration: 0.8, delay: 0, iterationCount: 1, timingFunction: "ease", direction: "normal", fillMode: "forwards" },
  },
  "Slide Up": {
    keyframesCSS: `@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}`,
    defaults: { name: "slideUp", duration: 0.6, delay: 0, iterationCount: 1, timingFunction: "ease-out", direction: "normal", fillMode: "forwards" },
  },
  "Pulse": {
    keyframesCSS: `@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.05); }
}`,
    defaults: { name: "pulse", duration: 1.6, delay: 0, iterationCount: "infinite", timingFunction: "ease-in-out", direction: "normal", fillMode: "none" },
  },
  "Bounce": {
    keyframesCSS: `@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-10px); }
}`,
    defaults: { name: "bounce", duration: 0.7, delay: 0, iterationCount: "infinite", timingFunction: "ease-in-out", direction: "normal", fillMode: "none" },
  },
  "Slide In Left": {
    keyframesCSS: `@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-30px); }
  to   { opacity: 1; transform: translateX(0); }
}`,
    defaults: { name: "slideInLeft", duration: 0.6, delay: 0, iterationCount: 1, timingFunction: "ease-out", direction: "normal", fillMode: "forwards" },
  },
  "Slide In Right": {
    keyframesCSS: `@keyframes slideInRight {
  from { opacity: 0; transform: translateX(30px); }
  to   { opacity: 1; transform: translateX(0); }
}`,
    defaults: { name: "slideInRight", duration: 0.6, delay: 0, iterationCount: 1, timingFunction: "ease-out", direction: "normal", fillMode: "forwards" },
  },
  "Zoom In": {
    keyframesCSS: `@keyframes zoomIn {
  from { opacity: 0; transform: scale(0.5); }
  to   { opacity: 1; transform: scale(1); }
}`,
    defaults: { name: "zoomIn", duration: 0.5, delay: 0, iterationCount: 1, timingFunction: "ease-out", direction: "normal", fillMode: "forwards" },
  },
  "Rotate": {
    keyframesCSS: `@keyframes rotate {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}`,
    defaults: { name: "rotate", duration: 2, delay: 0, iterationCount: "infinite", timingFunction: "linear", direction: "normal", fillMode: "none" },
  },
};

/** Builds the CSS animation shorthand from an AnimationConfig. */
export function buildAnimationCSS(cfg: AnimationConfig): string {
  return `${cfg.name} ${cfg.duration}s ${cfg.timingFunction} ${cfg.delay}s ${cfg.iterationCount} ${cfg.direction} ${cfg.fillMode}`;
}

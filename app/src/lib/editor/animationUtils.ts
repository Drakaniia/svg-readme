import type { AnimationConfig, ElementProperties } from "../../components/editor-canvas/ElementsRenderer";

// ═══════════════════════════════════════════════════════════════════════════════
//  Easing Curve SVG Path Generator
// ═══════════════════════════════════════════════════════════════════════════════

/** Maps CSS easing keywords to cubic-bezier control points. */
const EASING_POINTS: Record<string, [number, number, number, number]> = {
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
  linear: [0, 0, 1, 1],
};

/** Parses a cubic-bezier(...) string into control points. */
function parseCubicBezier(easing: string): [number, number, number, number] | null {
  const m = easing.match(/cubic-bezier\(([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
}

/**
 * Generates an SVG path `d` attribute that visualizes a CSS easing curve
 * within a given width × height box. The curve starts at (0,h) and ends at (w,0).
 * Y is inverted so the curve reads top-to-bottom like a velocity graph.
 */
export function generateEasingSvgPath(
  easing: string,
  width: number,
  height: number,
): string {
  // Resolve control points — explicit cubic-bezier first, then preset keywords, then ease fallback
  let cp: [number, number, number, number] | null = parseCubicBezier(easing);
  if (!cp && EASING_POINTS[easing]) {
    cp = EASING_POINTS[easing];
  }
  if (!cp) {
    cp = EASING_POINTS.ease;
  }

  const [x1, y1, x2, y2] = cp;

  // Linear: straight line
  if (easing === "linear") {
    return `M 0,${height} L ${width},0`;
  }

  // ease, ease-in, ease-out, ease-in-out: single cubic bezier
  if (easing === "ease" || easing === "ease-in" || easing === "ease-out") {
    const cx1 = x1 * width;
    const cy1 = height - y1 * height;
    const cx2 = x2 * width;
    const cy2 = height - y2 * height;
    return `M 0,${height} C ${cx1.toFixed(1)},${cy1.toFixed(1)} ${cx2.toFixed(1)},${cy2.toFixed(1)} ${width},0`;
  }

  // ease-in-out: two cubic beziers for the S-curve
  if (easing === "ease-in-out") {
    const midX = width / 2;
    const midY = height / 2;
    const cx1 = x1 * width;
    return `M 0,${height} C ${(cx1 * 0.5).toFixed(1)},${(height - 0.1 * height).toFixed(1)} ${(midX * 0.5).toFixed(1)},${(midY).toFixed(1)} ${midX.toFixed(1)},${midY.toFixed(1)} C ${(midX + width * 0.15).toFixed(1)},${(midY).toFixed(1)} ${(width * 0.85).toFixed(1)},${(0.1 * height).toFixed(1)} ${width},0`;
  }

  // Generic cubic-bezier (e.g. spring)
  const cx1 = x1 * width;
  const cy1 = height - y1 * height;
  const cx2 = x2 * width;
  const cy2 = height - y2 * height;
  return `M 0,${height} C ${cx1.toFixed(1)},${cy1.toFixed(1)} ${cx2.toFixed(1)},${cy2.toFixed(1)} ${width},0`;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Bulk-Apply Animation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Applies an animation config to all specified layer IDs in the element properties map.
 * Returns a new properties map with animation applied to each layer.
 * Non-targeted layers pass through unchanged.
 */
export function applyAnimationToLayers(
  layerIds: string[],
  animation: AnimationConfig,
  elementProperties: Record<string, ElementProperties>,
): Record<string, ElementProperties> {
  const result: Record<string, ElementProperties> = {};
  const targetSet = new Set(layerIds);

  for (const [id, props] of Object.entries(elementProperties)) {
    if (targetSet.has(id)) {
      result[id] = { ...props, animation } as ElementProperties;
    } else {
      result[id] = props;
    }
  }

  // Ensure all requested layer IDs exist in the result
  for (const id of layerIds) {
    if (!result[id]) {
      result[id] = elementProperties[id];
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Staggered Delay Computation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Computes staggered delays for a list of layer IDs.
 * Each layer gets baseDelay + index * staggerStep seconds of delay.
 */
export function computeStaggeredDelays(
  layerIds: string[],
  baseDelay: number,
  staggerStep: number,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (let i = 0; i < layerIds.length; i++) {
    result[layerIds[i]] = baseDelay + i * staggerStep;
  }
  return result;
}

/**
 * Applies an animation to multiple layers with staggered delays.
 * Each layer gets the same animation but with incrementally increased delay.
 */
export function applyStaggeredAnimation(
  layerIds: string[],
  animation: AnimationConfig,
  baseDelay: number,
  staggerStep: number,
  elementProperties: Record<string, ElementProperties>,
): Record<string, ElementProperties> {
  const delays = computeStaggeredDelays(layerIds, baseDelay, staggerStep);
  const result: Record<string, ElementProperties> = {};
  const targetSet = new Set(layerIds);

  for (const [id, props] of Object.entries(elementProperties)) {
    if (targetSet.has(id)) {
      result[id] = {
        ...props,
        animation: { ...animation, delay: delays[id] ?? animation.delay },
      } as ElementProperties;
    } else {
      result[id] = props;
    }
  }

  return result;
}

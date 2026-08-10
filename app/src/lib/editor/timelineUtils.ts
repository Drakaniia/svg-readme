import type { AnimationConfig } from "../../components/editor-canvas/ElementsRenderer";

// ═══════════════════════════════════════════════════════════════════════════════
//  Position Conversions
// ═══════════════════════════════════════════════════════════════════════════════

/** Convert a time (seconds) to pixel position on the timeline. */
export function timeToPixel(
  time: number,
  duration: number,
  timelineWidth: number,
): number {
  if (duration <= 0) return 0;
  return Math.round((time / duration) * timelineWidth);
}

/** Convert a pixel position to time (seconds), clamped to [0, duration]. */
export function pixelToTime(
  px: number,
  duration: number,
  timelineWidth: number,
): number {
  if (duration <= 0) return 0;
  const raw = (px / timelineWidth) * duration;
  return Math.max(0, Math.min(duration, raw));
}

/** Generate evenly spaced tick marks for the time ruler. */
export function generateTimeRulerTicks(
  duration: number,
  maxTicks: number,
): number[] {
  if (duration <= 0) return [0];
  // Find a nice step size
  const rawStep = duration / Math.max(maxTicks - 1, 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep) || 0));
  const niceSteps = [1, 2, 2.5, 5, 10];
  
  // Pick the smallest nice step >= rawStep
  let step = magnitude;
  for (const m of niceSteps) {
    const candidate = magnitude * m;
    if (candidate >= rawStep * 0.8) {
      step = candidate;
      break;
    }
  }
  if (step <= 0) step = rawStep;

  const ticks: number[] = [];
  for (let t = 0; t <= duration + 0.0001; t += step) {
    ticks.push(Math.round(t * 1000) / 1000);
  }
  return ticks;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Keyframe Hit Testing
// ═══════════════════════════════════════════════════════════════════════════════

export interface KeyframePoint {
  percent: number;
  easing?: string;
}

/** Find the index of the closest keyframe to a pixel position, or -1 if none within hitRadius. */
export function findClosestKeyframe(
  px: number,
  keyframes: KeyframePoint[],
  duration: number,
  timelineWidth: number,
  hitRadius: number,
): number {
  if (duration <= 0 || keyframes.length === 0) return -1;

  let closest = -1;
  let closestDist = Infinity;

  for (let i = 0; i < keyframes.length; i++) {
    const kfPx = timeToPixel(
      (keyframes[i].percent / 100) * duration,
      duration,
      timelineWidth,
    );
    const dist = Math.abs(px - kfPx);
    if (dist < hitRadius && dist < closestDist) {
      closest = i;
      closestDist = dist;
    }
  }

  return closest;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Scrub via Negative Delay
// ═══════════════════════════════════════════════════════════════════════════════

/** Compute the CSS animation-delay value to scrub to a given time.
 *  Using a negative delay makes the animation start from that point.
 *  Returns 0 for time 0 (no delay), negative for scrubbing forward. */
export function computeScrubDelay(scrubTime: number): number {
  if (scrubTime <= 0) return 0;
  return -scrubTime;
}

/** Build default keyframe markers from an AnimationConfig (0% and 100% if none set). */
export function ensureKeyframes(
  anim: AnimationConfig,
): { percent: number; easing?: string }[] {
  if (anim.keyframes && anim.keyframes.length >= 2) return anim.keyframes;
  return [
    { percent: 0, easing: "ease-out" },
    { percent: 100, easing: "ease-in" },
  ];
}

/** Get keyframe percentages sorted ascending. */
export function getSortedKeyframePercents(
  anim: AnimationConfig,
): { percent: number; easing?: string }[] {
  const kfs = ensureKeyframes(anim);
  return [...kfs].sort((a, b) => a.percent - b.percent);
}

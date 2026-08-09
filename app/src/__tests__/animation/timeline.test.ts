import { describe, it, expect } from "vitest";
import type { AnimationConfig } from "../../components/editor-canvas/ElementsRenderer";
import {
  timeToPixel,
  pixelToTime,
  generateTimeRulerTicks,
  findClosestKeyframe,
  computeScrubDelay,
  ensureKeyframes,
  getSortedKeyframePercents,
} from "../../lib/editor/timelineUtils";

// ═══════════════════════════════════════════════════════════════════════════════
//  Timeline Keyframe Data Model
// ═══════════════════════════════════════════════════════════════════════════════

describe("Animation Keyframe Data", () => {
  it("AnimationConfig supports a keyframes array with percent and properties", () => {
    const cfg: AnimationConfig = {
      name: "fadeIn",
      duration: 1,
      delay: 0,
      iterationCount: 1,
      timingFunction: "ease",
      direction: "normal",
      fillMode: "forwards",
      keyframes: [
        { percent: 0, easing: "ease-in" },
        { percent: 50, easing: "linear" },
        { percent: 100, easing: "ease-out" },
      ],
    };

    expect(cfg.keyframes).toBeDefined();
    expect(cfg.keyframes).toHaveLength(3);
    expect(cfg.keyframes![0].percent).toBe(0);
    expect(cfg.keyframes![2].percent).toBe(100);
    expect(cfg.keyframes![0].easing).toBe("ease-in");
  });

  it("ensureKeyframes returns default 0%/100% when keyframes is empty", () => {
    const cfg: AnimationConfig = {
      name: "fadeIn", duration: 1, delay: 0, iterationCount: 1,
      timingFunction: "ease", direction: "normal", fillMode: "forwards",
    };
    const kfs = ensureKeyframes(cfg);
    expect(kfs).toHaveLength(2);
    expect(kfs[0].percent).toBe(0);
    expect(kfs[1].percent).toBe(100);
  });

  it("getSortedKeyframePercents sorts by percent", () => {
    const cfg: AnimationConfig = {
      name: "test", duration: 1, delay: 0, iterationCount: 1,
      timingFunction: "ease", direction: "normal", fillMode: "forwards",
      keyframes: [
        { percent: 100, easing: "ease-in" },
        { percent: 0, easing: "ease-out" },
        { percent: 50, easing: "linear" },
      ],
    };
    const sorted = getSortedKeyframePercents(cfg);
    expect(sorted[0].percent).toBe(0);
    expect(sorted[1].percent).toBe(50);
    expect(sorted[2].percent).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Timeline Position Utilities
// ═══════════════════════════════════════════════════════════════════════════════

// These will be extracted to a real module after tests pass

describe("Timeline Position Computation", () => {
  it("converts time to pixel position proportionally", () => {
    // At time 0.5s of a 2s animation on a 200px timeline = 50px
    expect(timeToPixel(0.5, 2, 200)).toBe(50);
    // At time 1s (halfway) = 100px
    expect(timeToPixel(1, 2, 200)).toBe(100);
    // At time 0 = 0px
    expect(timeToPixel(0, 2, 200)).toBe(0);
  });

  it("converts pixel position to time proportionally", () => {
    expect(pixelToTime(50, 2, 200)).toBeCloseTo(0.5);
    expect(pixelToTime(100, 2, 200)).toBeCloseTo(1);
    expect(pixelToTime(0, 2, 200)).toBeCloseTo(0);
  });

  it("clamps pixel position to timeline bounds", () => {
    expect(pixelToTime(-10, 2, 200)).toBeCloseTo(0);
    expect(pixelToTime(250, 2, 200)).toBeCloseTo(2);
  });

  it("generates evenly spaced ruler ticks", () => {
    const ticks = generateTimeRulerTicks(2, 5);
    expect(ticks).toEqual([0, 0.5, 1, 1.5, 2]);
  });

  it("handles zero duration gracefully", () => {
    expect(timeToPixel(0, 0, 200)).toBe(0);
    expect(pixelToTime(100, 0, 200)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Keyframe Proximity Hit Testing
// ═══════════════════════════════════════════════════════════════════════════════

describe("Keyframe Hit Testing", () => {
  it("finds the keyframe at 0% when clicking near the start", () => {
    const kfs: KeyframePoint[] = [
      { percent: 0 },
      { percent: 100 },
    ];
    // Click at pixel 5 on a 200px timeline, 2s duration, 15px hit radius
    // Keyframe at 0% is at pixel 0 — within 15px
    const idx = findClosestKeyframe(5, kfs, 2, 200, 15);
    expect(idx).toBe(0);
  });

  it("finds the keyframe at 100% when clicking near the end", () => {
    const kfs: KeyframePoint[] = [
      { percent: 0 },
      { percent: 50 },
      { percent: 100 },
    ];
    // Keyframe at 100% is at pixel 200 — click at 195
    const idx = findClosestKeyframe(195, kfs, 2, 200, 15);
    expect(idx).toBe(2);
  });

  it("returns -1 when no keyframe is within hit radius", () => {
    const kfs: KeyframePoint[] = [
      { percent: 0 },
      { percent: 100 },
    ];
    // Click at pixel 100 — far from both 0px (0%) and 200px (100%)
    const idx = findClosestKeyframe(100, kfs, 2, 200, 15);
    expect(idx).toBe(-1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Negative Delay Scrub Computation
// ═══════════════════════════════════════════════════════════════════════════════

describe("Scrub Position Computation", () => {
  it("returns 0 delay when scrubbing to time 0 (start of animation)", () => {
    expect(computeScrubDelay(0)).toBe(0);
  });

  it("returns negative delay when scrubbing forward", () => {
    // Scrubbing to 0.5s should give delay = -0.5
    const d = computeScrubDelay(0.5);
    expect(d).toBe(-0.5);
  });

  it("returns negative delay for longer scrub positions", () => {
    const d = computeScrubDelay(2.3);
    expect(d).toBe(-2.3);
  });
});

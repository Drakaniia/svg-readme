import { describe, it, expect } from "vitest";
import type { AnimationConfig, ElementProperties } from "../../components/editor-canvas/ElementsRenderer";
import { ANIMATION_PRESETS, buildAnimationCSS } from "../../components/editor-canvas/ElementsRenderer";
import {
  generateEasingSvgPath,
  applyAnimationToLayers,
  computeStaggeredDelays,
  applyStaggeredAnimation,
} from "../../lib/editor/animationUtils";

// ═══════════════════════════════════════════════════════════════════════════════
//  Test 1: Custom Keyframes Support
// ═══════════════════════════════════════════════════════════════════════════════

describe("Custom Keyframes", () => {
  it("AnimationConfig supports a customKeyframes field for user-defined @keyframes", () => {
    const customCfg: AnimationConfig = {
      name: "myCustomAnim",
      duration: 1.2,
      delay: 0.3,
      iterationCount: 2,
      timingFunction: "ease-in-out",
      direction: "alternate",
      fillMode: "both",
      customKeyframes: `@keyframes myCustomAnim {
  0%   { opacity: 0; transform: scale(0.8); }
  50%  { opacity: 0.5; transform: scale(1.1); }
  100% { opacity: 1; transform: scale(1); }
}`,
    };

    expect(customCfg.customKeyframes).toBeDefined();
    expect(customCfg.customKeyframes).toContain("@keyframes myCustomAnim");
    expect(customCfg.customKeyframes).toContain("transform: scale(1.1)");
  });

  it("buildAnimationCSS still works with custom keyframe names", () => {
    const cfg: AnimationConfig = {
      name: "myCustomAnim",
      duration: 1.5,
      delay: 0,
      iterationCount: "infinite",
      timingFunction: "linear",
      direction: "normal",
      fillMode: "none",
    };

    const css = buildAnimationCSS(cfg);
    expect(css).toBe("myCustomAnim 1.5s linear 0s infinite normal none");
  });

  it("ANIMATION_PRESETS contains all 8 presets", () => {
    const names = Object.keys(ANIMATION_PRESETS);
    expect(names).toHaveLength(8);
    expect(names).toContain("Fade In");
    expect(names).toContain("Slide Up");
    expect(names).toContain("Pulse");
    expect(names).toContain("Bounce");
    expect(names).toContain("Slide In Left");
    expect(names).toContain("Slide In Right");
    expect(names).toContain("Zoom In");
    expect(names).toContain("Rotate");
  });

  it("each preset has the same AnimationConfig fields", () => {
    for (const [, preset] of Object.entries(ANIMATION_PRESETS)) {
      expect(preset.keyframesCSS).toBeTruthy();
      expect(preset.defaults.name).toBeTruthy();
      expect(typeof preset.defaults.duration).toBe("number");
      expect(typeof preset.defaults.delay).toBe("number");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Test 2: Easing Curve SVG Path Generator
// ═══════════════════════════════════════════════════════════════════════════════

describe("Easing Curve SVG Generator", () => {
  it('generates a path for "ease" (default CSS easing) that starts at bottom-left and ends at top-right', () => {
    const path = generateEasingSvgPath("ease", 100, 60);
    expect(path).toMatch(/^M\s*0[\s,]*60/);
    expect(path).toMatch(/100[\s,]*0/);
  });

  it("generates a straight diagonal line for 'linear' easing", () => {
    const path = generateEasingSvgPath("linear", 100, 60);
    expect(path).toBe("M 0,60 L 100,0");
  });

  it('generates a curve for "ease-in" that starts flat and steepens', () => {
    const path = generateEasingSvgPath("ease-in", 100, 60);
    expect(path).toContain("C");
  });

  it('generates a curve for "ease-out" that starts steep and flattens', () => {
    const path = generateEasingSvgPath("ease-out", 100, 60);
    expect(path).toContain("C");
  });

  it('generates an S-curve for "ease-in-out"', () => {
    const path = generateEasingSvgPath("ease-in-out", 100, 60);
    expect(path).toContain("C");
  });

  it("generates a curve for the spring preset with overshoot", () => {
    const path = generateEasingSvgPath(
      "cubic-bezier(0.34,1.56,0.64,1)",
      100,
      60,
    );
    expect(path).toContain("C");
    // Spring has y1 > 1, so cy1 < 0 (above the top edge)
    expect(path).toMatch(/-\d/);
  });

  it("falls back to ease for unknown easing strings", () => {
    const path = generateEasingSvgPath("unknown-fancy-easing", 80, 40);
    expect(path).toContain("C");
    expect(path).toMatch(/^M\s*0[\s,]*40/);
    expect(path).toMatch(/80[\s,]*0/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Test 3: Bulk-Apply Animation to Multiple Layers
// ═══════════════════════════════════════════════════════════════════════════════

describe("Bulk-Apply Animation", () => {
  it("applies the same animation to all specified layers", () => {
    const props: Record<string, ElementProperties> = {
      "layer-1": { type: "text", x: 10, y: 20, content: "A", width: "auto" as const, height: 24, fontFamily: "Inter", fontSize: 14, fontWeight: 400, color: "#fff", textAlign: "left" as const, textAlignVertical: "top" as const },
      "layer-2": { type: "shape", x: 30, y: 40, kind: "rect" as const, width: 80, height: 50, fill: "#8b5cf6", stroke: "none", strokeWidth: 0, opacity: 1 },
      "layer-3": { type: "text", x: 50, y: 60, content: "C", width: "auto" as const, height: 24, fontFamily: "Inter", fontSize: 14, fontWeight: 400, color: "#fff", textAlign: "left" as const, textAlignVertical: "top" as const },
    };

    const anim: AnimationConfig = {
      name: "fadeIn",
      duration: 0.8,
      delay: 0,
      iterationCount: 1,
      timingFunction: "ease",
      direction: "normal",
      fillMode: "forwards",
    };

    const result = applyAnimationToLayers(["layer-1", "layer-3"], anim, props);

    expect(result["layer-1"]?.animation).toEqual(anim);
    expect(result["layer-3"]?.animation).toEqual(anim);
    expect(result["layer-2"]?.animation).toBeUndefined();
    expect(result["layer-1"].content).toBe("A");
    expect(result["layer-3"].content).toBe("C");
  });

  it("returns original properties when no layer IDs provided", () => {
    const props: Record<string, ElementProperties> = {
      "layer-1": {
        type: "shape",
        kind: "rect",
        x: 10,
        y: 20,
        width: 10,
        height: 10,
        fill: "#fff",
        stroke: "none",
        strokeWidth: 0,
        opacity: 1,
      },
    };
    const anim: AnimationConfig = {
      name: "fadeIn",
      duration: 0.8,
      delay: 0,
      iterationCount: 1,
      timingFunction: "ease",
      direction: "normal",
      fillMode: "forwards",
    };

    const result = applyAnimationToLayers([], anim, props);
    expect(result).toEqual(props);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Test 4: Staggered Delay Computation
// ═══════════════════════════════════════════════════════════════════════════════

describe("Staggered Delay Computation", () => {
  it("assigns incrementing delays starting from baseDelay", () => {
    const delays = computeStaggeredDelays(["a", "b", "c"], 0.1, 0.15);
    expect(delays["a"]).toBe(0.1);
    expect(delays["b"]).toBe(0.25);
    expect(delays["c"]).toBe(0.4);
  });

  it("returns empty object for empty input", () => {
    const delays = computeStaggeredDelays([], 0, 0.2);
    expect(delays).toEqual({});
  });

  it("single layer gets baseDelay", () => {
    const delays = computeStaggeredDelays(["only"], 0.5, 0.1);
    expect(delays["only"]).toBe(0.5);
  });

  it("works with zero stagger step (all same delay)", () => {
    const delays = computeStaggeredDelays(["x", "y", "z"], 0.2, 0);
    expect(delays["x"]).toBe(0.2);
    expect(delays["y"]).toBe(0.2);
    expect(delays["z"]).toBe(0.2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Test 5: Staggered Animation Application
// ═══════════════════════════════════════════════════════════════════════════════

describe("Staggered Animation Application", () => {
  it("applies animation with incrementing delays across layers", () => {
    const props: Record<string, ElementProperties> = {
      "a": { type: "shape", x: 0, y: 0, kind: "rect" as const, width: 50, height: 30, fill: "red", stroke: "none", strokeWidth: 0, opacity: 1 },
      "b": { type: "shape", x: 60, y: 0, kind: "rect" as const, width: 50, height: 30, fill: "blue", stroke: "none", strokeWidth: 0, opacity: 1 },
      "c": { type: "shape", x: 120, y: 0, kind: "rect" as const, width: 50, height: 30, fill: "green", stroke: "none", strokeWidth: 0, opacity: 1 },
    };

    const anim: AnimationConfig = {
      name: "slideUp",
      duration: 0.6,
      delay: 0,
      iterationCount: 1,
      timingFunction: "ease-out",
      direction: "normal",
      fillMode: "forwards",
    };

    const result = applyStaggeredAnimation(["a", "b", "c"], anim, 0.1, 0.15, props);

    expect(result["a"]?.animation?.delay).toBe(0.1);
    expect(result["b"]?.animation?.delay).toBe(0.25);
    expect(result["c"]?.animation?.delay).toBe(0.4);

    // Other animation fields preserved
    expect(result["a"]?.animation?.name).toBe("slideUp");
    expect(result["a"]?.animation?.duration).toBe(0.6);

    // Original properties preserved
    expect(result["a"].fill).toBe("red");
    expect(result["b"].fill).toBe("blue");
    expect(result["c"].fill).toBe("green");
  });
});

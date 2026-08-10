export type { AnimatedExportOptions, FrameData } from "./types";

import type { ElementProperties } from "../../components/editor-canvas/ElementsRenderer";
import { buildAnimationCSS } from "../../components/editor-canvas/ElementsRenderer";
import type { LayerType } from "../../context/EditorContext";
import { embedFonts } from "../fontEmbed";
import { buildSvgString } from "../export";
import { encodeGif } from "./gif";
import type { AnimatedExportOptions, FrameData } from "./types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Compute the total animation duration across all animated layers */
function getTotalDuration(
  layers: LayerType[],
  elementProperties: Record<string, ElementProperties>,
): number {
  let maxEnd = 1; // at least 1 second
  for (const layer of layers) {
    if (!layer.visible) continue;
    const anim = elementProperties[layer.id]?.animation;
    if (!anim) continue;
    const count =
      anim.iterationCount === "infinite"
        ? 1 // Use 1 iteration for preview length
        : (anim.iterationCount as number);
    const end = anim.delay + anim.duration * count;
    if (end > maxEnd) maxEnd = end;
  }
  return maxEnd;
}

/** Build the base SVG with fonts inlined (fonts are constant across frames). */
async function buildBaseSvgWithFonts(
  options: Pick<AnimatedExportOptions, "frameSize" | "elementProperties" | "layers" | "backgroundColor">,
): Promise<string> {
  const baseSvg = buildSvgString({
    frameSize: options.frameSize,
    elementProperties: options.elementProperties,
    layers: options.layers,
    backgroundColor: options.backgroundColor,
  });
  return embedFonts(baseSvg, options.elementProperties);
}

/** Pause all animated layers at the given time (per-frame CSS injection). */
function applyPauseRules(
  baseSvg: string,
  options: Pick<AnimatedExportOptions, "layers" | "elementProperties">,
  timeSeconds: number,
): string {
  const animRules: string[] = [];
  for (const layer of options.layers) {
    if (!layer.visible) continue;
    const anim = options.elementProperties[layer.id]?.animation;
    if (!anim) continue;
    const animCSS = buildAnimationCSS(anim);
    animRules.push(`  .anim-${layer.id} { animation: ${animCSS}; animation-delay: ${-timeSeconds}s; animation-play-state: paused; }`);
  }

  if (animRules.length === 0) return baseSvg;

  const pauseBlock = animRules.join("\n");
  return baseSvg.replace(
    "    </style>",
    `${pauseBlock}\n    </style>`,
  );
}

/** Render an SVG string to a canvas and capture RGBA pixel data */
async function renderSvgToFrame(
  svgString: string,
  width: number,
  height: number,
): Promise<Uint8ClampedArray> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2d context");

  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  return new Promise<Uint8ClampedArray>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      const imageData = ctx.getImageData(0, 0, width, height);
      resolve(imageData.data);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load SVG frame"));
    };
    img.src = url;
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Capture all animation frames by rendering the SVG at each time point.
 * Each frame's delay equals 1/fps in hundredths of a second (centiseconds).
 */
export async function captureFrames(
  options: AnimatedExportOptions,
  onProgress?: (current: number, total: number) => void,
): Promise<FrameData[]> {
  const totalDuration = getTotalDuration(options.layers, options.elementProperties);
  const frameInterval = 1 / options.fps;
  const frameCount = Math.ceil(totalDuration / frameInterval);

  // Build the font-embedded base SVG once — the per-frame pause rules are
  // injected via string replacement, so fonts are only fetched a single time.
  const baseSvg = await buildBaseSvgWithFonts(options);

  const frames: FrameData[] = [];
  const delayCs = Math.round((1 / options.fps) * 100); // hundredths of a second

  for (let i = 0; i < frameCount; i++) {
    const t = i * frameInterval;
    const frameSvg = applyPauseRules(baseSvg, options, t);

    const pixels = await renderSvgToFrame(
      frameSvg,
      options.frameSize.width,
      options.frameSize.height,
    );

    frames.push({ pixels, delay: delayCs });
    onProgress?.(i + 1, frameCount);
  }

  return frames;
}

// ─── PNG Sequence Download ──────────────────────────────────────────────────

/** Download a single PNG frame */
async function downloadPngFrame(
  frame: FrameData,
  index: number,
  width: number,
  height: number,
): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  // Copy into an ArrayBuffer-backed clamped array (ImageData requires it).
  const imageData = new ImageData(new Uint8ClampedArray(frame.pixels), width, height);
  ctx.putImageData(imageData, 0, 0);

  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/png"),
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `frame-${String(index).padStart(3, "0")}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Download all frames as individual PNG files */
export async function downloadPngSequence(
  frames: FrameData[],
  width: number,
  height: number,
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  // Batch downloads with a small delay to avoid browser throttling
  for (let i = 0; i < frames.length; i++) {
    await downloadPngFrame(frames[i], i, width, height);
    onProgress?.(i + 1, frames.length);
    // Small delay between downloads to let browser process
    if (i < frames.length - 1) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

/** Download a GIF file from a Blob or Uint8Array */
export function downloadGif(
  gifData: Uint8Array | Blob,
  filename: string = "banner.gif",
): void {
  // Copy into an ArrayBuffer-backed array so Blob accepts it (TS lib.dom typing).
  const blob =
    gifData instanceof Blob ? gifData : new Blob([new Uint8Array(gifData)], { type: "image/gif" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── High-level export ──────────────────────────────────────────────────────

/**
 * Export the animated SVG as a GIF or PNG sequence.
 * @returns The Blob for GIF format, or null for PNG sequence (handled via downloads internally)
 */
export async function exportAnimated(
  options: AnimatedExportOptions,
  onFrameProgress?: (current: number, total: number) => void,
  onEncodingProgress?: () => void,
): Promise<{ gifBlob?: Blob; pngCount?: number }> {
  // Capture frames
  const frames = await captureFrames(options, onFrameProgress);

  if (options.format === "gif") {
    const { width, height } = options.frameSize;
    onEncodingProgress?.();
    const gifData = encodeGif(frames, width, height);
    // Copy into an ArrayBuffer-backed array so Blob accepts it (TS lib.dom typing).
    const gifBlob = new Blob([new Uint8Array(gifData)], { type: "image/gif" });
    return { gifBlob };
  } else {
    // PNG sequence: trigger downloads directly
    const { width, height } = options.frameSize;
    onEncodingProgress?.();
    await downloadPngSequence(frames, width, height, onFrameProgress);
    return { pngCount: frames.length };
  }
}

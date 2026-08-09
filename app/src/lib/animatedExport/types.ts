// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnimatedExportOptions {
  frameSize: { width: number; height: number };
  elementProperties: Record<string, import("../../components/editor-canvas/ElementsRenderer").ElementProperties>;
  layers: import("../../context/EditorContext").LayerType[];
  fps: number;
  format: "gif" | "png-sequence";
  backgroundColor?: string;
}

export interface FrameData {
  /** RGBA pixel data (width × height × 4) */
  pixels: Uint8ClampedArray;
  /** Delay in hundredths of a second for this frame (GIF timing) */
  delay: number;
}

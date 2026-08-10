import { buildSvgString } from "./export";
import type { ElementProperties } from "../components/editor-canvas/ElementsRenderer";
import type { LayerType } from "../context/EditorContext";
import { embedFonts } from "./fontEmbed";

/**
 * Rasterize an SVG string to a PNG blob of the given dimensions.
 * Returns a Blob with MIME type "image/png".
 * When `elementProperties` is provided, fonts used by the document are inlined
 * as @font-face data URLs so the rasterized PNG keeps the editor's typography
 * (browsers block the Google Fonts @import inside SVG-as-image).
 */
export async function svgStringToPngBlob(
  svgString: string,
  width: number,
  height: number,
  scale: number = 2,
  elementProperties?: Record<string, ElementProperties>,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const scaledW = Math.round(width * scale);
  const scaledH = Math.round(height * scale);
  canvas.width = scaledW;
  canvas.height = scaledH;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2d context");

  // Inline fonts so the SVG is self-contained for <img> rasterization
  const finalSvg = elementProperties
    ? await embedFonts(svgString, elementProperties)
    : svgString;

  // Wrap in an SVG data URL so fonts/styles resolve in the same origin
  const svgBlob = new Blob([finalSvg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  return new Promise<Blob>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, scaledW, scaledH);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob returned null"));
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load SVG as image"));
    };
    img.src = url;
  });
}

/**
 * Convert an SVG string to a PNG data URL.
 */
export async function svgStringToPngDataUrl(
  svgString: string,
  width: number,
  height: number,
  scale: number = 2,
): Promise<string> {
  const blob = await svgStringToPngBlob(svgString, width, height, scale);
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Options accepted by downloadPng — mirror the Export tab controls (A12/E). */
export interface PngExportOptions {
  scale?: number;
  backgroundColor?: string;
  transparent?: boolean;
  rounded?: boolean;
  borderRadius?: number;
  showBorder?: boolean;
}

/**
 * Download a PNG rendering of the current canvas state.
 */
export async function downloadPng(
  frameSize: { width: number; height: number },
  elementProperties: Record<string, ElementProperties>,
  layers: LayerType[],
  filename: string = "banner.png",
  options: PngExportOptions = {},
): Promise<void> {
  const { scale = 2, transparent = false, backgroundColor = "#09090b", rounded, borderRadius, showBorder } = options;
  const svgString = buildSvgString({
    frameSize,
    elementProperties,
    layers,
    backgroundColor: transparent ? "transparent" : backgroundColor,
    ...(rounded !== undefined ? { rounded } : {}),
    ...(borderRadius !== undefined ? { borderRadius } : {}),
    ...(showBorder !== undefined ? { showBorder } : {}),
  });

  const blob = await svgStringToPngBlob(svgString, frameSize.width, frameSize.height, scale, elementProperties);

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

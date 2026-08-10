import type { ElementProperties } from "../../components/editor-canvas/ElementsRenderer";
import { svgStringToPngBlob } from "../exportPng";

// ─── Download helpers ─────────────────────────────────────────────────────────

export function downloadSvg(svgString: string, filename = "banner.svg"): void {
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function copySvgText(svgString: string): Promise<void> {
  return navigator.clipboard.writeText(svgString);
}

export function copyMarkdown(filename = "banner.svg"): Promise<void> {
  const md = `![banner](./${filename})`;
  return navigator.clipboard.writeText(md);
}

/**
 * Copy the current SVG as a PNG image to the clipboard.
 * Uses the Clipboard API to write a PNG blob.
 * When `elementProperties` is provided, fonts are inlined so the rasterized
 * PNG keeps the document's typography.
 */
export async function copyImageToClipboard(
  svgString: string,
  width: number,
  height: number,
  elementProperties?: Record<string, ElementProperties>,
  scale: number = 2,
): Promise<void> {
  const blob = await svgStringToPngBlob(svgString, width, height, scale, elementProperties);
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": blob }),
  ]);
}

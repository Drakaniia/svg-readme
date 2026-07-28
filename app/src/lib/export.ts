import type { TextElementProperties } from "../components/editor-canvas/ElementsRenderer";
import type { LayerType } from "../context/EditorContext";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEXT_ANCHOR_MAP: Record<string, "start" | "middle" | "end"> = {
  left: "start",
  center: "middle",
  right: "end",
};

const escXml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

// ─── Build SVG string ────────────────────────────────────────────────────────

export interface BuildSvgOptions {
  frameSize: { width: number; height: number };
  elementProperties: Record<string, TextElementProperties>;
  layers: LayerType[];
  /** Background color for the canvas (default: #09090b) */
  backgroundColor?: string;
  /** Whether to include rounded corners (default: true) */
  rounded?: boolean;
  /** Border radius in px (default: 12) */
  borderRadius?: number;
  /** Show border (default: true) */
  showBorder?: boolean;
}

export function buildSvgString(options: BuildSvgOptions): string {
  const {
    frameSize,
    elementProperties,
    layers,
    backgroundColor = "#09090b",
    rounded = true,
    borderRadius = 12,
    showBorder = true,
  } = options;

  const { width: w, height: h } = frameSize;

  // Collect visible text elements
  const textElements: string[] = [];

  for (const layer of layers) {
    if (!layer.visible) continue;

    const props = elementProperties[layer.id];
    if (!props || props.type !== "text") continue;
    if (!props.content.trim()) continue;

    const anchor = TEXT_ANCHOR_MAP[props.textAlign] ?? "start";
    const fill = props.color;
    const family = props.fontFamily;
    const size = props.fontSize;
    const weight = props.fontWeight;

    // Compute bounding box for this text (same as ElementsRenderer.getTextBoundingBox)
    const charWidth = size * 0.6;
    const textWidth =
      props.width === "auto"
        ? Math.max(props.content.length * charWidth, 20)
        : props.width;
    const textHeight = props.width === "auto" ? size * 1.4 : props.height;
    let bbX = props.x - 4;
    if (props.textAlign === "center") bbX = props.x - textWidth / 2 - 4;
    else if (props.textAlign === "right") bbX = props.x - textWidth - 4;
    const bbY = props.y - size * 0.85;
    const bbW = textWidth + 8;
    const bbH = textHeight + 4;

    // Background fill rect (when set)
    if (props.backgroundColor) {
      textElements.push(
        `    <rect x="${bbX}" y="${bbY}" width="${bbW}" height="${bbH}" fill="${props.backgroundColor}" rx="3"/>`,
      );
    }

    textElements.push(
      `    <text x="${props.x}" y="${props.y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escXml(props.content)}</text>`,
    );
  }

  // Build the SVG
  const rx = rounded ? ` rx="${borderRadius}"` : "";
  const borderStroke = showBorder
    ? ` stroke="rgba(255,255,255,0.10)" stroke-width="1"`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500;700&amp;display=swap');
      text { font-family: 'Poppins', sans-serif; }
    </style>
  </defs>
  <rect x="0" y="0" width="${w}" height="${h}" fill="${backgroundColor}"${rx}${borderStroke}/>
  <!-- Background grid pattern -->
  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#grid)" opacity="0.03"${rx === "" ? "" : ` rx="${borderRadius}"`}/>
  <defs>
    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1" fill="white"/>
    </pattern>
  </defs>
${textElements.join("\n")}
</svg>`;
}

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

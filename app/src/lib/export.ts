import type { ElementProperties, ShapeElementProperties, ImageElementProperties } from "../components/editor-canvas/ElementsRenderer";
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

// ─── Shape path helpers ───────────────────────────────────────────────────────

function trianglePath(x: number, y: number, w: number, h: number): string {
  return `M ${x + w / 2} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
}

function starPath(x: number, y: number, w: number, h: number): string {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const outerR = Math.min(w, h) / 2;
  const innerR = outerR * 0.4;
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return `M ${points.join(" L ")} Z`;
}

function hexagonPath(x: number, y: number, w: number, h: number): string {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    points.push(
      `${cx + rx * Math.cos(angle)},${cy + ry * Math.sin(angle)}`,
    );
  }
  return `M ${points.join(" L ")} Z`;
}

function renderShapeToSvgString(props: ShapeElementProperties): string {
  const { kind, x, y, width, height, fill, stroke, strokeWidth, opacity, rotation } =
    props;
  const strokeAttr = stroke ? ` stroke="${stroke}" stroke-width="${strokeWidth}"` : "";
  const opacityAttr = opacity !== 1 ? ` opacity="${opacity}"` : "";

  let el = "";
  if (kind === "rect") {
    el = `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"${strokeAttr}${opacityAttr} rx="4"/>`;
  } else if (kind === "circle") {
    const rx = width / 2;
    const ry = height / 2;
    el = `<ellipse cx="${x + rx}" cy="${y + ry}" rx="${rx}" ry="${ry}" fill="${fill}"${strokeAttr}${opacityAttr}/>`;
  } else if (kind === "triangle") {
    el = `<path d="${trianglePath(x, y, width, height)}" fill="${fill}"${strokeAttr}${opacityAttr}/>`;
  } else if (kind === "star") {
    el = `<path d="${starPath(x, y, width, height)}" fill="${fill}"${strokeAttr}${opacityAttr}/>`;
  } else if (kind === "hexagon") {
    el = `<path d="${hexagonPath(x, y, width, height)}" fill="${fill}"${strokeAttr}${opacityAttr}/>`;
  } else if (kind === "line") {
    const midY = y + height / 2;
    const lineStroke = stroke || fill;
    el = `<line x1="${x}" y1="${midY}" x2="${x + width}" y2="${midY}" stroke="${lineStroke}" stroke-width="${Math.max(strokeWidth, 2)}"${opacityAttr}/>`;
  }

  if (el && rotation) {
    const cx = x + width / 2;
    const cy = y + height / 2;
    return `    <g transform="rotate(${rotation}, ${cx}, ${cy})">\n      ${el}\n    </g>`;
  }
  return el ? `    ${el}` : "";
}

function renderImageToSvgString(props: ImageElementProperties): string {
  const { x, y, width, height, url, opacity, rotation } = props;
  const opacityAttr = opacity !== 1 ? ` opacity="${opacity}"` : "";
  const el = `<image href="${escXml(url)}" x="${x}" y="${y}" width="${width}" height="${height}"${opacityAttr} preserveAspectRatio="none"/>`;

  if (rotation) {
    const cx = x + width / 2;
    const cy = y + height / 2;
    return `    <g transform="rotate(${rotation}, ${cx}, ${cy})">\n      ${el}\n    </g>`;
  }
  return `    ${el}`;
}

// ─── Build SVG string ────────────────────────────────────────────────────────

export interface BuildSvgOptions {
  frameSize: { width: number; height: number };
  elementProperties: Record<string, ElementProperties>;
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

  // Collect visible elements (shapes first, then text on top)
  const elementStrings: string[] = [];

  for (const layer of layers) {
    if (!layer.visible) continue;

    const props = elementProperties[layer.id];
    if (!props) continue;

    if (props.type === "shape") {
      elementStrings.push(renderShapeToSvgString(props));
    } else if (props.type === "image") {
      elementStrings.push(renderImageToSvgString(props));
    } else if (props.type === "text") {
      if (!props.content.trim()) continue;

      const anchor = TEXT_ANCHOR_MAP[props.textAlign] ?? "start";
      const fill = props.color;
      const family = props.fontFamily;
      const size = props.fontSize;
      const weight = props.fontWeight;

      // Background fill rect (rendered behind text)
      if (props.backgroundColor) {
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
        elementStrings.push(
          `    <rect x="${bbX}" y="${bbY}" width="${bbW}" height="${bbH}" fill="${props.backgroundColor}" rx="3"/>`,
        );
      }

      elementStrings.push(
        `    <text x="${props.x}" y="${props.y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escXml(props.content)}</text>`,
      );
    }
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
${elementStrings.join("\n")}
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

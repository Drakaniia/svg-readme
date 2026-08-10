import type { ShapeElementProperties, ImageElementProperties, PathElementProperties } from "../../components/editor-canvas/ElementsRenderer";
import { isGradient, gradientUrl } from "../editor/gradient";
import { pointsToSvgD } from "../editor/pathUtils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const escXml = (s: string) =>
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

export function renderShapeToSvgString(props: ShapeElementProperties, layerId?: string): string {
  const { kind, x, y, width, height, fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin, strokeDashArray, cornerRadius, opacity, rotation, flipH, flipV } =
    props;
  const fillValue = isGradient(fill) && layerId ? gradientUrl(layerId) : fill;
  const cap = strokeLinecap ?? "butt";
  const join = strokeLinejoin ?? "miter";
  const dashAttr = strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : "";
  const capJoinAttr = ` stroke-linecap="${cap}" stroke-linejoin="${join}"${dashAttr}`;
  const strokeAttr = stroke ? ` stroke="${stroke}" stroke-width="${strokeWidth}"${capJoinAttr}` : "";
  const opacityAttr = opacity !== 1 ? ` opacity="${opacity}"` : "";

  let el = "";
  if (kind === "rect") {
    const rx = cornerRadius ?? 4;
    el = `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fillValue}"${strokeAttr}${opacityAttr} rx="${rx}"/>`;
  } else if (kind === "circle") {
    const rx = width / 2;
    const ry = height / 2;
    el = `<ellipse cx="${x + rx}" cy="${y + ry}" rx="${rx}" ry="${ry}" fill="${fillValue}"${strokeAttr}${opacityAttr}/>`;
  } else if (kind === "triangle") {
    el = `<path d="${trianglePath(x, y, width, height)}" fill="${fillValue}"${strokeAttr}${opacityAttr}/>`;
  } else if (kind === "star") {
    el = `<path d="${starPath(x, y, width, height)}" fill="${fillValue}"${strokeAttr}${opacityAttr}/>`;
  } else if (kind === "hexagon") {
    el = `<path d="${hexagonPath(x, y, width, height)}" fill="${fillValue}"${strokeAttr}${opacityAttr}/>`;
  } else if (kind === "line") {
    const midY = y + height / 2;
    const lineStroke = stroke || fillValue;
    el = `<line x1="${x}" y1="${midY}" x2="${x + width}" y2="${midY}" stroke="${lineStroke}" stroke-width="${Math.max(strokeWidth, 2)}" stroke-linecap="${cap}"${opacityAttr}/>`;
  }

  if (!el) return "";

  // Build transform string (rotation + flip centered correctly)
  const cx = x + width / 2;
  const cy = y + height / 2;
  const hasFlip = flipH || flipV;
  const sx = flipH ? -1 : 1;
  const sy = flipV ? -1 : 1;
  let transformStr = "";
  if (hasFlip) {
    transformStr = `translate(${cx}, ${cy}) scale(${sx}, ${sy}) translate(${-cx}, ${-cy})`;
    if (rotation) transformStr = `translate(${cx}, ${cy}) rotate(${rotation}) scale(${sx}, ${sy}) translate(${-cx}, ${-cy})`;
  } else if (rotation) {
    transformStr = `rotate(${rotation}, ${cx}, ${cy})`;
  }

  if (transformStr) {
    return `    <g transform="${transformStr}">\n      ${el}\n    </g>`;
  }
  return `    ${el}`;
}

export function renderImageToSvgString(props: ImageElementProperties): string {
  const { x, y, width, height, url, opacity, rotation, flipH, flipV } = props;
  const opacityAttr = opacity !== 1 ? ` opacity="${opacity}"` : "";
  const el = `<image href="${escXml(url)}" x="${x}" y="${y}" width="${width}" height="${height}"${opacityAttr} preserveAspectRatio="none"/>`;

  const cx = x + width / 2;
  const cy = y + height / 2;
  const hasFlip = flipH || flipV;
  const sx = flipH ? -1 : 1;
  const sy = flipV ? -1 : 1;
  let transformStr = "";
  if (hasFlip) {
    transformStr = `translate(${cx}, ${cy}) scale(${sx}, ${sy}) translate(${-cx}, ${-cy})`;
    if (rotation) transformStr = `translate(${cx}, ${cy}) rotate(${rotation}) scale(${sx}, ${sy}) translate(${-cx}, ${-cy})`;
  } else if (rotation) {
    transformStr = `rotate(${rotation}, ${cx}, ${cy})`;
  }

  if (transformStr) {
    return `    <g transform="${transformStr}">\n      ${el}\n    </g>`;
  }
  return `    ${el}`;
}

export function renderPathToSvgString(props: PathElementProperties): string {
  const { points, stroke, strokeWidth, fill, opacity, closed, rotation, x, y, width, height, subpaths } = props;
  const opacityAttr = opacity !== 1 ? ` opacity="${opacity}"` : "";
  const d = pointsToSvgD(points, closed, props.handles, subpaths);
  const fillAttr = closed ? ` fill="${fill}"` : ` fill="none"`;
  const el = `<path d="${d}"${fillAttr} stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${opacityAttr}/>`;

  if (rotation) {
    const cx = x + width / 2;
    const cy = y + height / 2;
    return `    <g transform="rotate(${rotation}, ${cx}, ${cy})">\n      ${el}\n    </g>`;
  }
  return `    ${el}`;
}

export { trianglePath, starPath, hexagonPath };

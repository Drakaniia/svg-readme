import type { LayerType } from "../context/EditorContext";
import type {
  ElementProperties,
  ShapeElementProperties,
  TextElementProperties,
  PathElementProperties,
  ImageElementProperties,
} from "../components/editor-canvas/ElementsRenderer";
import { DEFAULT_TEXT_PROPS } from "../components/editor-canvas/types";
import type { GradientFill, GradientStop } from "./editor/gradient";
import { parseColor, hexToRgba, rgbToHex } from "./color";
import { getTextAutoBox } from "./editor/textMeasure";
import { parsePathD } from "./svgImport/pathParser";
import {
  parseTransform,
  applyMatrixToPoint,
  multiplyMatrices,
  bakeBoxTransform,
  transformPoints,
  type TransformMatrix,
} from "./svgImport/transform";
import { computePointsBounds } from "./editor/pathUtils";

/** Result of parsing an SVG string into editor layers + properties. */
export interface ImportSvgResult {
  layers: LayerType[];
  elementProperties: Record<string, ElementProperties>;
}

// ─── Module state (per parse call) ───────────────────────────────────────────

interface ParseCtx {
  layers: LayerType[];
  elementProperties: Record<string, ElementProperties>;
  /** id → gradient fill (from <defs>) */
  gradients: Map<string, GradientFill>;
  /** id → referenced DOM element (for <use> dereferencing) */
  elementsById: Map<string, Element>;
  counter: number;
  /** Track <use> resolution to guard against cycles. */
  resolvingUses: Set<string>;
}

function nextId(ctx: ParseCtx, prefix: string): string {
  ctx.counter += 1;
  return `imported-${prefix}-${Date.now()}-${ctx.counter}`;
}

// ─── Number parsing ──────────────────────────────────────────────────────────

function parseNumber(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const n = parseFloat(raw);
  return isNaN(n) ? fallback : n;
}

// ─── Gradient parsing ────────────────────────────────────────────────────────

/** Parse a <linearGradient>/<radialGradient> into a GradientFill. */
function parseGradient(el: Element): GradientFill | null {
  const stops: GradientStop[] = [];
  for (const stopEl of Array.from(el.children)) {
    if (stopEl.tagName.toLowerCase() !== "stop") continue;
    const offsetRaw = stopEl.getAttribute("offset") || "0";
    const offset =
      offsetRaw.endsWith("%")
        ? parseFloat(offsetRaw) / 100
        : parseFloat(offsetRaw);
    const color = parseColor(stopEl.getAttribute("stop-color"));
    const opacity = parseNumber(stopEl.getAttribute("stop-opacity"), 1);
    if (isNaN(offset)) continue;
    // Merge stop opacity into the color (8-digit hex)
    const rgba = hexToRgba(color);
    stops.push({
      offset,
      color: rgbToHex(rgba.r, rgba.g, rgba.b, rgba.a * opacity),
    });
  }
  if (stops.length === 0) return null;

  const tag = el.tagName.toLowerCase();
  if (tag === "radialgradient") {
    return {
      type: "radial",
      cx: parseNumber(el.getAttribute("cx"), 0.5),
      cy: parseNumber(el.getAttribute("cy"), 0.5),
      stops,
    };
  }
  // Linear: compute angle from (x1,y1) → (x2,y2). Defaults 0,0 → 1,0 = 0°.
  const x1 = parseNumber(el.getAttribute("x1"), 0);
  const y1 = parseNumber(el.getAttribute("y1"), 0);
  const x2 = parseNumber(el.getAttribute("x2"), 1);
  const y2 = parseNumber(el.getAttribute("y2"), 0);
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return { type: "linear", angle, stops };
}

/** Parse `fill="url(#id)"` (optionally with a fallback color) into a gradient or hex. */
function resolveFill(raw: string | null, ctx: ParseCtx): string | GradientFill | null {
  if (!raw) return null;
  const urlMatch = raw.match(/url\(\s*#([^)\s]+)\s*\)/);
  if (urlMatch) {
    const grad = ctx.gradients.get(urlMatch[1]);
    const fallback = raw.replace(/url\([^)]*\)/, "").trim();
    if (grad) return grad;
    if (fallback) return parseColor(fallback);
    return null;
  }
  return parseColor(raw);
}

// ─── Shape building ──────────────────────────────────────────────────────────

/** Bake a shape's box through a matrix; falls back to a path on shear. */
function bakeShapeOrPath(
  ctx: ParseCtx,
  kind: ShapeElementProperties["kind"],
  box: { x: number; y: number; width: number; height: number },
  base: Omit<ShapeElementProperties, "type" | "kind" | "x" | "y" | "width" | "height">,
  matrix: TransformMatrix,
  parentId: string | null = null,
): void {
  const baked = bakeBoxTransform(matrix, box);
  const id = nextId(ctx, "shape");
  const shapeName =
    kind === "rect" ? "Rectangle" : kind === "circle" ? "Ellipse" : kind === "line" ? "Line" : "Shape";
  if (baked) {
    ctx.layers.push({
      id,
      name: shapeName,
      type: "shape",
      locked: false,
      visible: true,
      active: false,
      parentId,
    });
    const props: ShapeElementProperties = {
      type: "shape",
      kind,
      x: baked.x,
      y: baked.y,
      width: baked.width,
      height: baked.height,
      ...base,
    };
    if (Math.abs(baked.rotation) > 1e-6) props.rotation = baked.rotation;
    ctx.elementProperties[id] = props;
    return;
  }

  // Shear present — flatten the box corners into a path
  const corners = transformPoints(matrix, [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x + box.width, box.y + box.height],
    [box.x, box.y + box.height],
  ]);
  const bounds = computePointsBounds(corners);
  ctx.layers.push({
    id,
    name: "Path",
    type: "shape",
    locked: false,
    visible: true,
    active: false,
    parentId,
  });
  const pathProps: PathElementProperties = {
    type: "path",
    ...bounds,
    points: corners,
    stroke: base.stroke,
    strokeWidth: base.strokeWidth,
    fill: typeof base.fill === "string" ? base.fill : "#8b5cf6",
    opacity: base.opacity,
    closed: true,
  };
  ctx.elementProperties[id] = pathProps;
}

/** Bake a path's points + handles through a matrix. */
function bakePath(
  ctx: ParseCtx,
  points: [number, number][],
  handles: PathElementProperties["handles"],
  base: Omit<PathElementProperties, "type" | "x" | "y" | "width" | "height" | "points">,
  matrix: TransformMatrix,
  parentId: string | null = null,
): void {
  const transformed = transformPoints(matrix, points);
  const transformedHandles = handles
    ? handles.map((h) =>
        h
          ? {
              in: h.in ? applyMatrixToPoint(matrix, h.in) : undefined,
              out: h.out ? applyMatrixToPoint(matrix, h.out) : undefined,
              smooth: h.smooth,
            }
          : undefined,
      )
    : undefined;
  const bounds = computePointsBounds(transformed);
  const id = nextId(ctx, "path");
  ctx.layers.push({
    id,
    name: "Path",
    type: "shape",
    locked: false,
    visible: true,
    active: false,
    parentId,
  });
  const props: PathElementProperties = {
    type: "path",
    ...bounds,
    points: transformed,
    ...(transformedHandles ? { handles: transformedHandles } : {}),
    ...base,
  };
  ctx.elementProperties[id] = props;
}

// ─── Element parsing ─────────────────────────────────────────────────────────

/** Non-rendered SVG elements that must not become layers. */
const SKIP_TAGS = new Set([
  "defs",
  "title",
  "desc",
  "style",
  "metadata",
  "clipPath",
  "mask",
  "pattern",
  "filter",
  "marker",
  "symbol",
]);

/** Parse a single renderable element into layers (may create multiple). */
function parseElement(ctx: ParseCtx, el: Element, matrix: TransformMatrix, parentId: string | null): void {
  const tag = el.tagName.toLowerCase();
  const ownMatrix = multiplyMatrices(matrix, parseTransform(el.getAttribute("transform")));

  if (tag === "g" || tag === "svg") {
    const groupId = nextId(ctx, "group");
    ctx.layers.push({
      id: groupId,
      name: "Group",
      type: "group",
      locked: false,
      visible: true,
      active: false,
      parentId,
    });
    for (const child of Array.from(el.children)) {
      parseElement(ctx, child, ownMatrix, groupId);
    }
    return;
  }

  if (tag === "use") {
    resolveUse(ctx, el, ownMatrix, parentId);
    return;
  }

  if (tag === "rect") {
    const x = parseNumber(el.getAttribute("x"), 0);
    const y = parseNumber(el.getAttribute("y"), 0);
    const w = parseNumber(el.getAttribute("width"), 50);
    const h = parseNumber(el.getAttribute("height"), 50);
    const rx = parseNumber(el.getAttribute("rx"), 0);
    const fill = resolveFill(el.getAttribute("fill"), ctx) ?? "#8b5cf6";
    const stroke = resolveFill(el.getAttribute("stroke"), ctx) ?? "rgba(255,255,255,0.2)";
    bakeShapeOrPath(
      ctx,
      "rect",
      { x, y, width: w, height: h },
      {
        fill: fill === "none" ? "transparent" : (fill as string),
        stroke: stroke === "none" ? "" : (stroke as string),
        strokeWidth: parseNumber(el.getAttribute("stroke-width"), 1),
        opacity: parseNumber(el.getAttribute("opacity"), 1),
        cornerRadius: rx,
        ...(el.getAttribute("stroke-dasharray")
          ? { strokeDashArray: el.getAttribute("stroke-dasharray")! }
          : {}),
      },
      ownMatrix,
      parentId,
    );
    return;
  }

  if (tag === "circle" || tag === "ellipse") {
    const cx = parseNumber(el.getAttribute("cx"), 25);
    const cy = parseNumber(el.getAttribute("cy"), 25);
    const rx = parseNumber(el.getAttribute("r"), parseNumber(el.getAttribute("rx"), 25));
    const ry = parseNumber(el.getAttribute("ry"), rx);
    const fill = resolveFill(el.getAttribute("fill"), ctx) ?? "#8b5cf6";
    const stroke = resolveFill(el.getAttribute("stroke"), ctx) ?? "rgba(255,255,255,0.2)";
    bakeShapeOrPath(
      ctx,
      "circle",
      { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 },
      {
        fill: fill === "none" ? "transparent" : (fill as string),
        stroke: stroke === "none" ? "" : (stroke as string),
        strokeWidth: parseNumber(el.getAttribute("stroke-width"), 1),
        opacity: parseNumber(el.getAttribute("opacity"), 1),
      },
      ownMatrix,
      parentId,
    );
    return;
  }

  if (tag === "line") {
    const x1 = parseNumber(el.getAttribute("x1"), 0);
    const y1 = parseNumber(el.getAttribute("y1"), 0);
    const x2 = parseNumber(el.getAttribute("x2"), 50);
    const y2 = parseNumber(el.getAttribute("y2"), 0);
    const stroke = resolveFill(el.getAttribute("stroke"), ctx) ?? "#ffffff";
    const strokeWidth = parseNumber(el.getAttribute("stroke-width"), 2);
    const opacity = parseNumber(el.getAttribute("opacity"), 1);
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    bakeShapeOrPath(
      ctx,
      "line",
      { x: minX, y: minY, width: Math.max(w, 10), height: Math.max(h, 12) },
      {
        fill: "transparent",
        stroke: stroke === "none" ? "" : (stroke as string),
        strokeWidth,
        opacity,
        ...(el.getAttribute("stroke-dasharray")
          ? { strokeDashArray: el.getAttribute("stroke-dasharray")! }
          : {}),
      },
      ownMatrix,
      parentId,
    );
    return;
  }

  if (tag === "polyline" || tag === "polygon") {
    const pointsAttr = el.getAttribute("points");
    if (!pointsAttr) return;
    const stroke = resolveFill(el.getAttribute("stroke"), ctx);
    const fill = resolveFill(el.getAttribute("fill"), ctx);
    const points = parsePoints(pointsAttr);
    if (points.length < 2) return;
    bakePath(
      ctx,
      points,
      undefined,
      {
        stroke: stroke === "none" ? "" : ((stroke as string) ?? "#3b82f6"),
        strokeWidth: parseNumber(el.getAttribute("stroke-width"), 2),
        fill: fill === "none" ? "transparent" : ((fill as string) ?? "rgba(59,130,246,0.15)"),
        opacity: parseNumber(el.getAttribute("opacity"), 1),
        closed: tag === "polygon",
      },
      ownMatrix,
      parentId,
    );
    return;
  }

  if (tag === "path") {
    const d = el.getAttribute("d");
    if (!d) return;
    const subpaths = parsePathD(d);
    if (subpaths.length === 0) return;
    const stroke = resolveFill(el.getAttribute("stroke"), ctx);
    const fill = resolveFill(el.getAttribute("fill"), ctx);
    const base = {
      stroke: stroke === "none" ? "" : ((stroke as string) ?? "#3b82f6"),
      strokeWidth: parseNumber(el.getAttribute("stroke-width"), 2),
      fill: fill === "none" ? "transparent" : ((fill as string) ?? "rgba(59,130,246,0.15)"),
      opacity: parseNumber(el.getAttribute("opacity"), 1),
    };
    for (const sub of subpaths) {
      bakePath(ctx, sub.points, sub.handles, { ...base, closed: sub.closed }, ownMatrix, parentId);
    }
    return;
  }

  if (tag === "text") {
    parseText(ctx, el, ownMatrix, parentId);
    return;
  }

  if (tag === "image") {
    const x = parseNumber(el.getAttribute("x"), 0);
    const y = parseNumber(el.getAttribute("y"), 0);
    const w = parseNumber(el.getAttribute("width"), 160);
    const h = parseNumber(el.getAttribute("height"), 160);
    const href = el.getAttribute("href") || el.getAttribute("xlink:href") || "";
    const opacity = parseNumber(el.getAttribute("opacity"), 1);
    const baked = bakeBoxTransform(ownMatrix, { x, y, width: w, height: h });
    const id = nextId(ctx, "image");
    ctx.layers.push({
      id,
      name: "Image",
      type: "image",
      locked: false,
      visible: true,
      active: false,
      parentId,
    });
    const props: ImageElementProperties = {
      type: "image",
      x: baked ? baked.x : x,
      y: baked ? baked.y : y,
      width: baked ? baked.width : w,
      height: baked ? baked.height : h,
      url: href,
      opacity,
    };
    if (baked && Math.abs(baked.rotation) > 1e-6) props.rotation = baked.rotation;
    ctx.elementProperties[id] = props;
    return;
  }
}

function resolveUse(ctx: ParseCtx, el: Element, matrix: TransformMatrix, parentId: string | null): void {
  const href = el.getAttribute("href") || el.getAttribute("xlink:href") || "";
  const id = href.replace(/^#/, "");
  if (!id) return;
  if (ctx.resolvingUses.has(id)) return; // cycle guard
  const target = ctx.elementsById.get(id);
  if (!target) return;

  // <use x/y> offset the referenced content; then the use's own transform applies
  const x = parseNumber(el.getAttribute("x"), 0);
  const y = parseNumber(el.getAttribute("y"), 0);
  const offsetMatrix = multiplyMatrices(matrix, {
    a: 1, b: 0, c: 0, d: 1, e: x, f: y,
  });

  ctx.resolvingUses.add(id);
  parseElement(ctx, target, offsetMatrix, parentId);
  ctx.resolvingUses.delete(id);
}

function parseText(ctx: ParseCtx, el: Element, matrix: TransformMatrix, parentId: string | null): void {
  const svgX = parseNumber(el.getAttribute("x"), 0);
  const svgY = parseNumber(el.getAttribute("y"), 16);
  const content = el.textContent || "";
  const fill = resolveFill(el.getAttribute("fill"), ctx) ?? "#ffffff";
  const fontSize = parseNumber(el.getAttribute("font-size"), 14);
  const fontFamily = el.getAttribute("font-family") || "Inter";
  const fontWeight = parseNumber(el.getAttribute("font-weight"), 400);
  const textAnchor = (el.getAttribute("text-anchor") || "start") as "start" | "middle" | "end";
  const align =
    textAnchor === "middle" ? "center" : textAnchor === "end" ? "right" : "left";
  const dominantBaseline = el.getAttribute("dominant-baseline") || "";
  const alignVertical =
    dominantBaseline === "middle" || dominantBaseline === "central"
      ? "center"
      : dominantBaseline === "text-after-edge" || dominantBaseline === "text-bottom"
        ? "bottom"
        : "top";

  // Estimate width for text-anchor box conversion via the shared measurement
  // (A11) — anchor centering uses the same box width the renderer/export use.
  const estWidth = getTextAutoBox(
    {
      width: "auto",
      height: 0,
      fontFamily,
      fontSize,
      fontWeight,
      italic: false,
      letterSpacing: 0,
      textCase: "ORIGINAL",
    },
    content,
  ).width;
  let boxX = svgX;
  if (textAnchor === "middle") boxX = svgX - estWidth / 2;
  else if (textAnchor === "end") boxX = svgX - estWidth;
  const boxY = svgY - fontSize;

  // Bake transform into the box position + font size (rotation not representable
  // on text nodes — position/scale are preserved)
  const [bx, by] = applyMatrixToPoint(matrix, [boxX, boxY]);
  const scale = Math.hypot(matrix.a, matrix.b) || 1;
  const scaledFontSize = Math.max(fontSize * scale, 1);

  const id = nextId(ctx, "text");
  ctx.layers.push({
    id,
    name: "Text",
    type: "text",
    locked: false,
    visible: true,
    active: false,
    parentId,
  });
  const props: TextElementProperties = {
    ...DEFAULT_TEXT_PROPS,
    x: bx,
    y: by,
    width: "auto",
    height: scaledFontSize * 1.4,
    content,
    fontFamily,
    fontSize: scaledFontSize,
    fontWeight,
    color: (fill as string) || "#ffffff",
    textAlign: align,
    textAlignVertical: alignVertical,
  };
  ctx.elementProperties[id] = props;
}

// ─── Main entry ──────────────────────────────────────────────────────────────

/**
 * Parse an SVG markup string into editor layers and element properties.
 * Handles rect, circle, ellipse, line, polyline, polygon, path (full curve
 * grammar), text, image, use, and preserves groups with parentId nesting.
 * Transforms are baked into geometry; gradients from <defs> map to GradientFill.
 */
export function parseSvgMarkup(svgString: string): ImportSvgResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");
  const root = doc.documentElement;

  const ctx: ParseCtx = {
    layers: [],
    elementProperties: {},
    gradients: new Map(),
    elementsById: new Map(),
    counter: 0,
    resolvingUses: new Set(),
  };

  // Pass 1: collect defs (gradients + id → element for <use>)
  const allElements = root.getElementsByTagName("*");
  for (const el of Array.from(allElements)) {
    const tag = el.tagName.toLowerCase();
    const id = el.getAttribute("id");
    if (id) ctx.elementsById.set(id, el);
    if (tag === "lineargradient" || tag === "radialgradient") {
      const grad = parseGradient(el);
      if (grad && id) ctx.gradients.set(id, grad);
    }
  }

  // Root transform: viewBox min-x/min-y → zero-based coordinates
  let rootMatrix: TransformMatrix = parseTransform(root.getAttribute("transform"));
  const viewBox = root.getAttribute("viewBox");
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(parseFloat);
    if (parts.length === 4 && !parts.some(isNaN)) {
      const [, , , , minX = 0, minY = 0] = [0, 0, 0, 0, parts[0], parts[1]];
      rootMatrix = multiplyMatrices(rootMatrix, {
        a: 1, b: 0, c: 0, d: 1, e: -minX, f: -minY,
      });
    }
  }

  // Pass 2: walk renderable children of the root
  for (const child of Array.from(root.children)) {
    const tag = child.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) continue;
    parseElement(ctx, child, rootMatrix, null);
  }

  return { layers: ctx.layers, elementProperties: ctx.elementProperties };
}

// ─── Helpers ────────────────────────────────────────────────────────────

/** Parse "x1,y1 x2,y2 ..." format into points array. */
function parsePoints(attr: string): [number, number][] {
  return attr
    .trim()
    .split(/[\s,]+/)
    .reduce<[number, number][]>((acc, val, i) => {
      if (i % 2 === 0) acc.push([parseFloat(val), 0]);
      else acc[acc.length - 1][1] = parseFloat(val);
      return acc;
    }, []);
}

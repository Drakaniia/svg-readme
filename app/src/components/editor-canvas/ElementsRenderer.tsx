import { memo } from "react";
import type { LayerType } from "../../context/EditorContext";
import { type GradientFill, gradientId, gradientUrl, isGradient } from "../../lib/editor/gradient";
import { TEXT_ANCHOR_MAP, getTextVerticalOffset, getTextXWithinBox } from "../../lib/editor/textAlign";
import { getTextLines, getLineHeight, getTextBlockHeight, getTextBlockWidth, getTextAutoBox } from "../../lib/editor/textMeasure";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Animation configuration for a layer, embedded in the exported SVG as CSS @keyframes. */
export interface AnimationConfig {
  /** CSS @keyframes identifier (e.g. "fadeIn", "slideUp", or a custom name). */
  name: string;
  /** Duration in seconds. */
  duration: number;
  /** Delay in seconds before the animation starts. */
  delay: number;
  /** Number of iterations or "infinite". */
  iterationCount: number | "infinite";
  /** CSS animation-timing-function. */
  timingFunction: string;
  /** CSS animation-direction. */
  direction: "normal" | "reverse" | "alternate" | "alternate-reverse";
  /** CSS animation-fill-mode. */
  fillMode: "none" | "forwards" | "backwards" | "both";
  /** Optional raw @keyframes CSS block. When provided, this is used in the export
   *  instead of looking up the preset by name. Lets users define fully custom animations. */
  customKeyframes?: string;
  /** Optional keyframe timeline markers for the visual timeline editor.
   *  Each entry maps to a percentage point (0-100) with an optional easing hint. */
  keyframes?: { percent: number; easing?: string }[];
}

/** Pre-built animation presets — maps a display name to its @keyframes CSS and default config. */
export const ANIMATION_PRESETS: Record<
  string,
  { keyframesCSS: string; defaults: Partial<AnimationConfig> }
> = {
  "Fade In": {
    keyframesCSS: `@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}`,
    defaults: { name: "fadeIn", duration: 0.8, delay: 0, iterationCount: 1, timingFunction: "ease", direction: "normal", fillMode: "forwards" },
  },
  "Slide Up": {
    keyframesCSS: `@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}`,
    defaults: { name: "slideUp", duration: 0.6, delay: 0, iterationCount: 1, timingFunction: "ease-out", direction: "normal", fillMode: "forwards" },
  },
  "Pulse": {
    keyframesCSS: `@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.05); }
}`,
    defaults: { name: "pulse", duration: 1.6, delay: 0, iterationCount: "infinite", timingFunction: "ease-in-out", direction: "normal", fillMode: "none" },
  },
  "Bounce": {
    keyframesCSS: `@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-10px); }
}`,
    defaults: { name: "bounce", duration: 0.7, delay: 0, iterationCount: "infinite", timingFunction: "ease-in-out", direction: "normal", fillMode: "none" },
  },
  "Slide In Left": {
    keyframesCSS: `@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-30px); }
  to   { opacity: 1; transform: translateX(0); }
}`,
    defaults: { name: "slideInLeft", duration: 0.6, delay: 0, iterationCount: 1, timingFunction: "ease-out", direction: "normal", fillMode: "forwards" },
  },
  "Slide In Right": {
    keyframesCSS: `@keyframes slideInRight {
  from { opacity: 0; transform: translateX(30px); }
  to   { opacity: 1; transform: translateX(0); }
}`,
    defaults: { name: "slideInRight", duration: 0.6, delay: 0, iterationCount: 1, timingFunction: "ease-out", direction: "normal", fillMode: "forwards" },
  },
  "Zoom In": {
    keyframesCSS: `@keyframes zoomIn {
  from { opacity: 0; transform: scale(0.5); }
  to   { opacity: 1; transform: scale(1); }
}`,
    defaults: { name: "zoomIn", duration: 0.5, delay: 0, iterationCount: 1, timingFunction: "ease-out", direction: "normal", fillMode: "forwards" },
  },
  "Rotate": {
    keyframesCSS: `@keyframes rotate {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}`,
    defaults: { name: "rotate", duration: 2, delay: 0, iterationCount: "infinite", timingFunction: "linear", direction: "normal", fillMode: "none" },
  },
};

/** Builds the CSS animation shorthand from an AnimationConfig. */
export function buildAnimationCSS(cfg: AnimationConfig): string {
  return `${cfg.name} ${cfg.duration}s ${cfg.timingFunction} ${cfg.delay}s ${cfg.iterationCount} ${cfg.direction} ${cfg.fillMode}`;
}

export interface TextElementProperties {
  type: "text";
  x: number;
  y: number;
  width: number | "auto";
  height: number;
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  /** Text foreground color (hex). Maps to SVG <text fill="...">. */
  color: string;
  /** Text box background fill (hex). When set, renders a filled rect behind the text.
   *  Undefined or empty string means no background. Open-pencil equivalent: fills on a rect. */
  backgroundColor?: string;
  /** Horizontal alignment — matches open-pencil's textAlignHorizontal (JUSTIFIED renders start-anchored for single-line text). */
  textAlign: "left" | "center" | "right" | "justify";
  /** Vertical alignment inside the text box — matches open-pencil's textAlignVertical. */
  textAlignVertical: "top" | "center" | "bottom";
  /** Text box resizing behavior — matches open-pencil's textAutoResize.
   *  WIDTH_AND_HEIGHT: box hugs content (auto width). HEIGHT: width fixed, height hugs lines.
   *  NONE: fixed box (resize via handles). */
  textAutoResize?: "NONE" | "HEIGHT" | "WIDTH_AND_HEIGHT";
  /** Line height in px. Defaults to fontSize * 1.4 when unset. */
  lineHeight?: number;
  /** Letter spacing in px (open-pencil uses %, but px maps cleanly to SVG). */
  letterSpacing?: number;
  /** Italic text (font-style). */
  italic?: boolean;
  /** Text decoration — matches open-pencil's textDecoration. */
  textDecoration?: "NONE" | "UNDERLINE" | "STRIKETHROUGH";
  /** Text case transform — matches open-pencil's textCase. */
  textCase?: "ORIGINAL" | "UPPER" | "LOWER" | "TITLE";
  /** CSS animation applied to this text element. Embedded as @keyframes in exported SVG. */
  animation?: AnimationConfig;
}

export type ShapeKind = "rect" | "circle" | "triangle" | "star" | "hexagon" | "line";

export interface ShapeElementProperties {
  type: "shape";
  kind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeLinecap?: "butt" | "round" | "square";
  strokeLinejoin?: "miter" | "round" | "bevel";
  /** Stroke dash array (e.g. "6 3" = 6px dash, 3px gap). Open Pencil-style dash pattern. */
  strokeDashArray?: string;
  /** Corner radius for rect shapes. Defaults to 4 when unset. 0 = sharp corners. */
  cornerRadius?: number;
  opacity: number;
  /** Rotation in degrees around the shape's own center (0–360). */
  rotation?: number;
  /** Flip horizontally (mirror across Y axis). */
  flipH?: boolean;
  /** Flip vertically (mirror across X axis). */
  flipV?: boolean;
  /** CSS animation applied to this shape. Embedded as @keyframes in exported SVG. */
  animation?: AnimationConfig;
}

export interface ImageElementProperties {
  type: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  /** Base64 data URL or external URL */
  url: string;
  opacity: number;
  /** Rotation in degrees around the image's own center (0–360). */
  rotation?: number;
  /** Flip horizontally (mirror across Y axis). */
  flipH?: boolean;
  /** Flip vertically (mirror across X axis). */
  flipV?: boolean;
  /** CSS animation applied to this image. Embedded as @keyframes in exported SVG. */
  animation?: AnimationConfig;
}

export interface PathElementProperties {
  type: "path";
  /** Bounding-box x (min x of all points) */
  x: number;
  /** Bounding-box y (min y of all points) */
  y: number;
  /** Bounding-box width (max x - min x) */
  width: number;
  /** Bounding-box height (max y - min y) */
  height: number;
  /** Absolute canvas-space points [[x,y], [x,y], ...] */
  points: [number, number][];
  /** Optional per-vertex bezier handles (parallel to `points`). Absent → all-straight.
   *  A segment i→i+1 is a cubic curve when either endpoint carries a handle. */
  handles?: (PathVertexHandle | undefined)[];
  /** Additional closed loops (holes / extra components) produced by boolean ops.
   *  Rendered as extra subpaths of the same path element; winding is consistent
   *  with the nonzero fill rule (holes are opposite to the outer loop). */
  subpaths?: [number, number][][];
  stroke: string;
  strokeWidth: number;
  fill: string;
  opacity: number;
  /** Whether the path should be closed (connect last point back to first). */
  closed: boolean;
  /** Rotation in degrees around the path's center (0–360). */
  rotation?: number;
  /** CSS animation applied to this path. Embedded as @keyframes in exported SVG. */
  animation?: AnimationConfig;
}

/** Union of all element property types */
export type ElementProperties = TextElementProperties | ShapeElementProperties | ImageElementProperties | PathElementProperties;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a bounding box rect for a text element in absolute world coordinates.
 * x,y is the top-left corner of the textbox (matches Open Pencil's node position).
 * This is used for rubber-band selection and snap guides.
 *
 * Box geometry comes from getTextAutoBox (measured via canvas when available,
 * heuristic fallback otherwise) so selection/snap agree with the rendered text
 * (A11).
 */
function getTextBoundingBox(props: TextElementProperties) {
  const { width: boxWidth, height: boxHeight } = getTextAutoBox(props, props.content);
  return {
    x: props.x - 2,
    y: props.y - 2,
    width: boxWidth + 4,
    height: boxHeight + 4,
  };
}

/** Bounding box for a shape element (same coords as the shape itself). */
function getShapeBoundingBox(props: ShapeElementProperties) {
  return { x: props.x, y: props.y, width: props.width, height: props.height };
}

/** Bounding box for an image element (same coords as the image itself). */
function getImageBoundingBox(props: ImageElementProperties) {
  return { x: props.x, y: props.y, width: props.width, height: props.height };
}

/** Bounding box for a path element (same coords as the path itself). */
function getPathBoundingBox(props: PathElementProperties) {
  return { x: props.x, y: props.y, width: props.width, height: props.height };
}

/** Compute bounding box from raw points array. Used when creating a new path. */
export function computePathBounds(points: [number, number][]): { x: number; y: number; width: number; height: number } {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [px, py] of points) {
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Returns bounding box for any element type — used for rubber-band selection */
export function getElementBoundingBox(props: ElementProperties) {
  if (props.type === "text") return getTextBoundingBox(props);
  if (props.type === "image") return getImageBoundingBox(props);
  if (props.type === "path") return getPathBoundingBox(props);
  return getShapeBoundingBox(props);
}

// ── Triangle path helper ────────────────────────────────────────────────────
function trianglePath(x: number, y: number, w: number, h: number): string {
  return `M ${x + w / 2} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
}

// ── Star path helper (5-pointed star) ──────────────────────────────────────
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

// ── Hexagon path helper ─────────────────────────────────────────────────────
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

// ─── Element Renderers ───────────────────────────────────────────────────────

const TextElement = memo(function TextElement({
  properties,
  isSelected,
  isRubberBandHighlighted,
  suppressSelectionOutline,
  isEditing,
}: {
  properties: TextElementProperties;
  isSelected: boolean;
  isRubberBandHighlighted?: boolean;
  suppressSelectionOutline?: boolean;
  isEditing?: boolean;
}) {
  const anchor = TEXT_ANCHOR_MAP[properties.textAlign] ?? "start";
  const boxHeight = properties.height;

  // Multi-line layout: split + wrap lines, then position the whole block.
  // Box width is measured through getTextAutoBox so the rendered box agrees
  // with the measured text (A11).
  const isAutoWidth = properties.width === "auto";
  const resize = properties.textAutoResize ?? "NONE";
  const wrapWidth =
    isAutoWidth || resize === "WIDTH_AND_HEIGHT"
      ? 0
      : (properties.width as number);
  const lines = getTextLines(properties.content, properties, wrapWidth);
  const boxWidth: number = isAutoWidth
    ? Math.max(getTextBlockWidth(lines), 20)
    : (properties.width as number);
  const lineHeight = getLineHeight(properties);
  const blockHeight = getTextBlockHeight(lines, properties);
  const blockOffsetY = getTextVerticalOffset(boxHeight, blockHeight, properties.textAlignVertical);

  // Per-line x position: auto-width boxes anchor lines at the left edge;
  // fixed boxes use the alignment anchor against the box width (Open Pencil).
  const lineX = isAutoWidth || resize === "WIDTH_AND_HEIGHT"
    ? 0
    : getTextXWithinBox(properties, boxWidth);
  const lineAnchor = isAutoWidth || resize === "WIDTH_AND_HEIGHT" ? "start" : anchor;

  const showHighlight = (isSelected && !suppressSelectionOutline) || isRubberBandHighlighted;

  return (
    <g
      className="canvas-element"
      data-layer-type="text"
      transform={`translate(${properties.x}, ${properties.y})`}
    >
      {/* Background fill rect — relative to box origin (0,0), matching Open Pencil's <g transform> pattern */}
      {properties.backgroundColor && (
        <rect
          x={0}
          y={0}
          width={boxWidth}
          height={boxHeight}
          fill={properties.backgroundColor}
          rx={3}
          className="pointer-events-none"
        />
      )}
      {showHighlight && (
        <rect
          x={-2}
          y={-2}
          width={boxWidth + 4}
          height={boxHeight + 4}
          fill={
            isRubberBandHighlighted && !isSelected
              ? "rgba(59,130,246,0.08)"
              : "none"
          }
          stroke={
            isRubberBandHighlighted && !isSelected ? "#60a5fa" : "#3b82f6"
          }
          strokeWidth={1}
          strokeDasharray={
            isRubberBandHighlighted && !isSelected ? "3 2" : undefined
          }
          rx={2}
          className="pointer-events-none"
        />
      )}
      {/* Hide the SVG text while editing — TextOverlay handles display */}
      {!isEditing && (
        <>
          {lines.map((line, i) => {
            // Each line's baseline sits ~fontSize below the block top (glyph
            // tops ~0.2em below the box top); vertical alignment is handled by
            // shifting the whole block with blockOffsetY.
            const lineY = blockOffsetY + properties.fontSize + i * lineHeight;
            const decoration = properties.textDecoration ?? "NONE";
            const decorationY =
              decoration === "UNDERLINE"
                ? lineY + 2
                : lineY - properties.fontSize * 0.4;
            return (
              <g key={i} className="pointer-events-none">
                <text
                  x={lineX}
                  y={lineY}
                  fontFamily={properties.fontFamily}
                  fontSize={properties.fontSize}
                  fontWeight={properties.fontWeight}
                  fontStyle={properties.italic ? "italic" : "normal"}
                  fill={properties.color}
                  letterSpacing={properties.letterSpacing ? String(properties.letterSpacing) : undefined}
                  textAnchor={lineAnchor}
                >
                  {line.text}
                </text>
                {decoration !== "NONE" && line.text.length > 0 && (
                  <line
                    x1={lineAnchor === "end" ? boxWidth - line.width : lineX}
                    x2={lineAnchor === "end" ? boxWidth : lineAnchor === "middle" ? lineX + line.width / 2 : lineX + line.width}
                    y1={decorationY}
                    y2={decorationY}
                    stroke={properties.color}
                    strokeWidth={Math.max(1, properties.fontSize * 0.06)}
                  />
                )}
              </g>
            );
          })}
          {/* Invisible hit area for easier selection — covers the full box */}
          <rect
            x={0}
            y={0}
            width={boxWidth}
            height={boxHeight}
            fill="transparent"
          />
        </>
      )}
    </g>
  );
});

const ShapeElement = memo(function ShapeElement({
  properties,
  isSelected,
  isRubberBandHighlighted,
  suppressSelectionOutline,
  layerId,
}: {
  properties: ShapeElementProperties;
  isSelected: boolean;
  isRubberBandHighlighted?: boolean;
  suppressSelectionOutline?: boolean;
  layerId?: string;
}) {
  const { kind, x, y, width, height, fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin, strokeDashArray, cornerRadius, opacity, rotation, flipH, flipV } =
    properties;
  // Resolve fill: if it's a gradient object, use the gradient URL
  const fillValue = isGradient(fill) && layerId ? gradientUrl(layerId) : (fill as string);
  const showHighlight = (isSelected && !suppressSelectionOutline) || isRubberBandHighlighted;

  const selectionStroke = isRubberBandHighlighted && !isSelected ? "#60a5fa" : "#3b82f6";
  const selectionDash = isRubberBandHighlighted && !isSelected ? "3 2" : undefined;
  const selectionFill = isRubberBandHighlighted && !isSelected ? "rgba(59,130,246,0.08)" : "none";

  // Center of the bounding box — used as the rotation/flip origin
  const cx = x + width / 2;
  const cy = y + height / 2;
  // Build correct transform: flip must be centered via translate(cx,cy) scale(sx,sy) translate(-cx,-cy)
  const hasFlip = flipH || flipV;
  const sx = flipH ? -1 : 1;
  const sy = flipV ? -1 : 1;
  let combinedTransform: string | undefined;
  if (hasFlip) {
    combinedTransform = `translate(${cx}, ${cy}) scale(${sx}, ${sy}) translate(${-cx}, ${-cy})`;
    if (rotation) combinedTransform = `translate(${cx}, ${cy}) rotate(${rotation}) scale(${sx}, ${sy}) translate(${-cx}, ${-cy})`;
  } else if (rotation) {
    combinedTransform = `rotate(${rotation}, ${cx}, ${cy})`;
  }

  const cap = strokeLinecap ?? "butt";
  const join = strokeLinejoin ?? "miter";

  // Render the actual shape
  let shapeEl: React.ReactNode;
  let hitEl: React.ReactNode;

  if (kind === "rect") {
    shapeEl = (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fillValue}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap={cap}
        strokeLinejoin={join}
        strokeDasharray={strokeDashArray || undefined}
        opacity={opacity}
        rx={cornerRadius ?? 4}
      />
    );
    hitEl = <rect x={x} y={y} width={width} height={height} fill="transparent" />;
  } else if (kind === "circle") {
    const rx = width / 2;
    const ry = height / 2;
    shapeEl = (
      <ellipse
        cx={x + rx}
        cy={y + ry}
        rx={rx}
        ry={ry}
        fill={fillValue}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap={cap}
        strokeLinejoin={join}
        opacity={opacity}
      />
    );
    hitEl = <rect x={x} y={y} width={width} height={height} fill="transparent" />;
  } else if (kind === "triangle") {
    shapeEl = (
      <path
        d={trianglePath(x, y, width, height)}
        fill={fillValue}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap={cap}
        strokeLinejoin={join}
        opacity={opacity}
      />
    );
    hitEl = <rect x={x} y={y} width={width} height={height} fill="transparent" />;
  } else if (kind === "star") {
    shapeEl = (
      <path
        d={starPath(x, y, width, height)}
        fill={fillValue}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap={cap}
        strokeLinejoin={join}
        opacity={opacity}
      />
    );
    hitEl = <rect x={x} y={y} width={width} height={height} fill="transparent" />;
  } else if (kind === "hexagon") {
    shapeEl = (
      <path
        d={hexagonPath(x, y, width, height)}
        fill={fillValue}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap={cap}
        strokeLinejoin={join}
        opacity={opacity}
      />
    );
    hitEl = <rect x={x} y={y} width={width} height={height} fill="transparent" />;
  } else if (kind === "line") {
    const midY = y + height / 2;
    shapeEl = (
      <line
        x1={x}
        y1={midY}
        x2={x + width}
        y2={midY}
        stroke={stroke || fillValue}
        strokeWidth={Math.max(strokeWidth, 2)}
        strokeLinecap={cap}
        strokeDasharray={strokeDashArray || undefined}
        opacity={opacity}
      />
    );
    hitEl = (
      <rect
        x={x}
        y={midY - 6}
        width={width}
        height={12}
        fill="transparent"
      />
    );
  } else {
    shapeEl = null;
    hitEl = null;
  }

  return (
    <g
      className="canvas-element"
      data-layer-type="shape"
      transform={combinedTransform}
    >
      {shapeEl}
      {hitEl}
      {showHighlight && (
        <rect
          x={x - 2}
          y={y - 2}
          width={width + 4}
          height={height + 4}
          fill={selectionFill}
          stroke={selectionStroke}
          strokeWidth={1}
          strokeDasharray={selectionDash}
          rx={2}
          className="pointer-events-none"
        />
      )}
    </g>
  );
});

const ImageElement = memo(function ImageElement({
  properties,
  isSelected,
  isRubberBandHighlighted,
  suppressSelectionOutline,
}: {
  properties: ImageElementProperties;
  isSelected: boolean;
  isRubberBandHighlighted?: boolean;
  suppressSelectionOutline?: boolean;
}) {
  const { x, y, width, height, url, opacity, rotation, flipH, flipV } = properties;
  const showHighlight = (isSelected && !suppressSelectionOutline) || isRubberBandHighlighted;

  const selectionStroke =
    isRubberBandHighlighted && !isSelected ? "#60a5fa" : "#3b82f6";
  const selectionDash =
    isRubberBandHighlighted && !isSelected ? "3 2" : undefined;
  const selectionFill =
    isRubberBandHighlighted && !isSelected
      ? "rgba(59,130,246,0.08)"
      : "none";

  const cx = x + width / 2;
  const cy = y + height / 2;
  // Build correct transform: flip must be centered via translate(cx,cy) scale(sx,sy) translate(-cx,-cy)
  const hasFlip = flipH || flipV;
  const sx = flipH ? -1 : 1;
  const sy = flipV ? -1 : 1;
  let combinedTransform: string | undefined;
  if (hasFlip) {
    combinedTransform = `translate(${cx}, ${cy}) scale(${sx}, ${sy}) translate(${-cx}, ${-cy})`;
    if (rotation) combinedTransform = `translate(${cx}, ${cy}) rotate(${rotation}) scale(${sx}, ${sy}) translate(${-cx}, ${-cy})`;
  } else if (rotation) {
    combinedTransform = `rotate(${rotation}, ${cx}, ${cy})`;
  }

  return (
    <g
      className="canvas-element"
      data-layer-type="image"
      transform={combinedTransform}
    >
      <image
        href={url}
        x={x}
        y={y}
        width={width}
        height={height}
        opacity={opacity}
        preserveAspectRatio="none"
      />
      {/* Invisible hit area for easier selection */}
      <rect x={x} y={y} width={width} height={height} fill="transparent" />
      {showHighlight && (
        <rect
          x={x - 2}
          y={y - 2}
          width={width + 4}
          height={height + 4}
          fill={selectionFill}
          stroke={selectionStroke}
          strokeWidth={1}
          strokeDasharray={selectionDash}
          rx={2}
          className="pointer-events-none"
        />
      )}
    </g>
  );
});

import { pointsToSvgD, segmentMidpoint } from "../../lib/editor/pathUtils";
import type { PathVertexHandle } from "../../lib/editor/pathUtils";

const PathElement = memo(function PathElement({
  properties,
  isSelected,
  isRubberBandHighlighted,
  suppressSelectionOutline,
  showEditPoints,
  showMidpointTargets,
  selectedVertexIndex,
  layerId,
}: {
  properties: PathElementProperties;
  isSelected: boolean;
  isRubberBandHighlighted?: boolean;
  suppressSelectionOutline?: boolean;
  showEditPoints?: boolean;
  showMidpointTargets?: boolean;
  selectedVertexIndex?: number | null;
  layerId?: string;
}) {
  const { points, stroke, strokeWidth, fill, opacity, closed, x, y, width, height, rotation, handles, subpaths } = properties;
  const showHighlight = (isSelected && !suppressSelectionOutline) || isRubberBandHighlighted;

  const selectionStroke = isRubberBandHighlighted && !isSelected ? "#60a5fa" : "#3b82f6";
  const selectionDash = isRubberBandHighlighted && !isSelected ? "3 2" : undefined;
  const selectionFill = isRubberBandHighlighted && !isSelected ? "rgba(59,130,246,0.08)" : "none";

  const cx = x + width / 2;
  const cy = y + height / 2;
  const rotateTransform = rotation ? `rotate(${rotation}, ${cx}, ${cy})` : undefined;

  const d = pointsToSvgD(points, closed, handles, subpaths);

  const selectedIndex =
    selectedVertexIndex != null &&
    selectedVertexIndex >= 0 &&
    selectedVertexIndex < points.length
      ? selectedVertexIndex
      : null;

  // Segment midpoint targets for node insertion (Figma-style, shown on hover).
  const segmentCount = closed ? points.length : Math.max(points.length - 1, 0);
  const midpoints = showMidpointTargets
    ? Array.from({ length: segmentCount }, (_, i) => ({
        point: segmentMidpoint(points, handles, i, closed),
        index: i,
      }))
    : [];

  // Bezier handle dots of the selected vertex (with their guide lines).
  const selectedHandles =
    showEditPoints && selectedIndex != null
      ? (() => {
          const h = handles?.[selectedIndex];
          const [ax, ay] = points[selectedIndex];
          const renderSide = (side: "in" | "out") => {
            const hp = side === "in" ? h?.in : h?.out;
            if (!hp) return null;
            return (
              <g key={side}>
                <line
                  x1={ax}
                  y1={ay}
                  x2={hp[0]}
                  y2={hp[1]}
                  stroke="#60a5fa"
                  strokeWidth={1}
                  className="pointer-events-none"
                />
                <circle
                  cx={hp[0]}
                  cy={hp[1]}
                  r={3.5}
                  fill="white"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  style={{ cursor: "pointer" }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(
                      new CustomEvent("path-handle-mousedown", {
                        detail: { layerId, vertexIndex: selectedIndex, side },
                      }),
                    );
                  }}
                />
              </g>
            );
          };
          return (
            <g>
              {renderSide("in")}
              {renderSide("out")}
            </g>
          );
        })()
      : null;

  return (
    <g
      className="canvas-element"
      data-layer-type="path"
      transform={rotateTransform}
    >
      <path
        d={d}
        fill={closed ? fill : "none"}
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={opacity}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Invisible hit area for easier selection */}
      <rect x={x} y={y} width={width} height={height} fill="transparent" />
      {showHighlight && (
        <rect
          x={x - 2}
          y={y - 2}
          width={width + 4}
          height={height + 4}
          fill={selectionFill}
          stroke={selectionStroke}
          strokeWidth={1}
          strokeDasharray={selectionDash}
          rx={2}
          className="pointer-events-none"
        />
      )}
      {/* Show edit point handles when selected and in move tool */}
      {showEditPoints && isSelected && (
        <g>
          {selectedHandles}
          {points.map(([px, py], i) => {
            const isSel = selectedIndex === i;
            return (
              <circle
                key={i}
                cx={px}
                cy={py}
                r={isSel ? 5 : 4}
                fill={isSel ? "#3b82f6" : "white"}
                stroke={isSel ? "white" : "#3b82f6"}
                strokeWidth={1.5}
                style={{ cursor: "pointer" }}
                data-vertex-index={i}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  // Alt-click toggles corner ↔ smooth.
                  if (e.altKey) {
                    window.dispatchEvent(
                      new CustomEvent("path-vertex-convert", {
                        detail: { layerId, vertexIndex: i },
                      }),
                    );
                    return;
                  }
                  // Dispatch custom event for vertex drag start
                  window.dispatchEvent(
                    new CustomEvent("path-vertex-mousedown", {
                      detail: { layerId, vertexIndex: i },
                    }),
                  );
                }}
                onDoubleClick={(e) => {
                  // Double-click an anchor toggles corner ↔ smooth too.
                  e.stopPropagation();
                  window.dispatchEvent(
                    new CustomEvent("path-vertex-convert", {
                      detail: { layerId, vertexIndex: i },
                    }),
                  );
                }}
              />
            );
          })}
          {/* Segment midpoint targets — click to insert a node */}
          {midpoints.map(({ point, index }) => (
            <g
              key={`mid-${index}`}
              style={{ cursor: "pointer" }}
              onMouseDown={(e) => {
                e.stopPropagation();
                window.dispatchEvent(
                  new CustomEvent("path-node-add", {
                    detail: { layerId, segmentIndex: index },
                  }),
                );
              }}
            >
              <circle cx={point[0]} cy={point[1]} r={9} fill="transparent" />
              <circle
                cx={point[0]}
                cy={point[1]}
                r={3}
                fill="#a78bfa"
                stroke="white"
                strokeWidth={1}
                className="pointer-events-none"
              />
            </g>
          ))}
        </g>
      )}
    </g>
  );
});

// ─── Gradient Defs ──────────────────────────────────────────────────────────

const GradientDef = memo(function GradientDef({
  layerId,
  gradient,
}: {
  layerId: string;
  gradient: GradientFill;
}) {
  const id = gradientId(layerId);
  const stops = gradient.stops.map((s) => (
    <stop
      key={s.offset}
      offset={`${(s.offset * 100).toFixed(0)}%`}
      stopColor={s.color}
    />
  ));

  if (gradient.type === "radial") {
    return (
      <radialGradient id={id} cx={String(gradient.cx)} cy={String(gradient.cy)} r="0.7">
        {stops}
      </radialGradient>
    );
  }

  const angleRad = (gradient.angle * Math.PI) / 180;
  const x1 = `${((1 - Math.cos(angleRad)) / 2 * 100).toFixed(0)}%`;
  const y1 = `${((1 - Math.sin(angleRad)) / 2 * 100).toFixed(0)}%`;
  const x2 = `${((1 + Math.cos(angleRad)) / 2 * 100).toFixed(0)}%`;
  const y2 = `${((1 + Math.sin(angleRad)) / 2 * 100).toFixed(0)}%`;

  return (
    <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
      {stops}
    </linearGradient>
  );
});

// ─── Main Renderer ───────────────────────────────────────────────────────────

/** Build a lookup map: parentId → children ids (sorted by their order in layers array) */
export function buildGroupChildrenMap(layers: LayerType[]): Map<string | null, string[]> {
  const map = new Map<string | null, string[]>();
  for (const layer of layers) {
    const parentKey = layer.parentId ?? null;
    if (!map.has(parentKey)) map.set(parentKey, []);
    map.get(parentKey)!.push(layer.id);
  }
  return map;
}

/** Get direct children of a group layer (or root null), in their layers-order */
export function getGroupChildren(layers: LayerType[], groupId: string | null): LayerType[] {
  return layers.filter((l) => (l.parentId ?? null) === groupId);
}

interface ElementsRendererProps {
  layers: LayerType[];
  elementProperties: Record<string, ElementProperties>;
  /** Single selected layer ID (legacy — prefer selectedLayerIds) */
  selectedLayerId?: string | null;
  /** Multi-selection: all selected layer IDs.
   *  When provided, each layer whose ID is in this array gets a selection highlight.
   *  Falls back to selectedLayerId for backward compatibility. */
  selectedLayerIds?: string[];
  /** Currently being edited — hide selection overlay for this one */
  editingLayerId?: string | null;
  /** IDs of layers highlighted during an active rubber-band selection. */
  rubberBandHighlightedIds?: string[];
  /** Layer ID currently being hovered — shows a dotted highlight outline. */
  hoveredLayerId?: string | null;
  /** When set, the element with this ID skips its per-element selection outline.
   *  Used when the resize/rotate overlay (Canvas) already draws the selection box. */
  hideSelectionOutlineForId?: string | null;
  /** Whether to show path edit point handles (active in move tool when a path is selected). */
  showEditPoints?: boolean;
  /** Currently selected path node — renders its bezier handles + highlights the anchor. */
  selectedVertex?: { layerId: string; index: number } | null;
  /** When true, applies CSS animations to elements that have an animation config. */
  previewAnimation?: boolean;
  /** When set, pauses animation and uses negative delay to show the animation at this point (scrub mode). */
  scrubTime?: number | null;
  /** Frame dimensions — used to center empty group placeholders on the canvas. */
  frameSize: { width: number; height: number };
  /** Called when an element is mousedown'd for selection/drag */
  onElementMouseDown: (e: React.MouseEvent, layerId: string) => void;
  /** Called when an element is mousedown'd for text editing */
  onElementDoubleClick?: (e: React.MouseEvent, layerId: string) => void;
  /** Called when hovering over an element */
  onElementHover?: (layerId: string | null) => void;
}

export default function ElementsRenderer({
  layers,
  elementProperties,
  selectedLayerId,
  selectedLayerIds,
  editingLayerId,
  rubberBandHighlightedIds,
  hoveredLayerId,
  hideSelectionOutlineForId = null,
  showEditPoints = false,
  selectedVertex = null,
  previewAnimation = false,
  scrubTime = null,
  frameSize,
  onElementMouseDown,
  onElementDoubleClick,
  onElementHover,
}: ElementsRendererProps) {
  // Compute the set of selected IDs — prefer selectedLayerIds if provided,
  // otherwise fall back to the legacy single selectedLayerId
  const selectedSet = new Set(
    selectedLayerIds ?? (selectedLayerId ? [selectedLayerId] : []),
  );

  // Compute the set of rubber-band highlighted IDs
  const rubberBandSet = new Set(rubberBandHighlightedIds ?? []);

  /** Clip shape for a masked layer (used as the group's clipPath geometry). */
  function renderMaskClipContent(child: LayerType): React.ReactNode {
    const props = elementProperties[child.id];
    if (!props) return null;
    if (props.type === "shape") {
      const { kind, x, y, width, height, cornerRadius } = props;
      if (kind === "rect") {
        return <rect x={x} y={y} width={width} height={height} rx={cornerRadius ?? 4} />;
      }
      if (kind === "circle") {
        return (
          <ellipse cx={x + width / 2} cy={y + height / 2} rx={width / 2} ry={height / 2} />
        );
      }
      if (kind === "triangle") {
        return <path d={trianglePath(x, y, width, height)} />;
      }
      if (kind === "star") {
        return <path d={starPath(x, y, width, height)} />;
      }
      if (kind === "hexagon") {
        return <path d={hexagonPath(x, y, width, height)} />;
      }
      return null; // lines have no area — cannot mask
    }
    if (props.type === "path") {
      return (
        <path d={pointsToSvgD(props.points, props.closed, props.handles, props.subpaths)} />
      );
    }
    if (props.type === "text") {
      return (
        <text
          x={props.x}
          y={props.y + props.fontSize}
          fontFamily={props.fontFamily}
          fontSize={props.fontSize}
          fontWeight={props.fontWeight}
        >
          {props.content}
        </text>
      );
    }
    return null; // image masks unsupported
  }

  // Mask clip paths collected in a pre-pass (the defs block renders before the
  // recursive layer render, so they can't be collected during it).
  const maskClipPaths: React.ReactNode[] = [];
  for (const layer of layers) {
    if (layer.type !== "group") continue;
    const maskChild = getGroupChildren(layers, layer.id).find((k) => k.masked);
    if (!maskChild) continue;
    maskClipPaths.push(
      <clipPath key={layer.id} id={`mask-${layer.id}`}>
        {renderMaskClipContent(maskChild)}
      </clipPath>,
    );
  }

  /** Compute the bounding box of all children of a group (for selection highlight). */
  function computeGroupChildrenBounds(groupId: string): { x: number; y: number; width: number; height: number } | null {
    const kids = getGroupChildren(layers, groupId).filter((l) => l.visible);
    if (kids.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const kid of kids) {
      const props = elementProperties[kid.id];
      if (!props) continue;
      const box = getElementBoundingBox(props);
      // Account for rotation by inflating the bounding box slightly
      const rotation = (props as { rotation?: number }).rotation ?? 0;
      if (rotation !== 0) {
        // Simple conservative inflation for rotated elements
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const rad = Math.abs(rotation) * Math.PI / 180;
        const inflatedW = Math.abs(box.width * Math.cos(rad)) + Math.abs(box.height * Math.sin(rad));
        const inflatedH = Math.abs(box.width * Math.sin(rad)) + Math.abs(box.height * Math.cos(rad));
        minX = Math.min(minX, cx - inflatedW / 2);
        minY = Math.min(minY, cy - inflatedH / 2);
        maxX = Math.max(maxX, cx + inflatedW / 2);
        maxY = Math.max(maxY, cy + inflatedH / 2);
      } else {
        minX = Math.min(minX, box.x);
        minY = Math.min(minY, box.y);
        maxX = Math.max(maxX, box.x + box.width);
        maxY = Math.max(maxY, box.y + box.height);
      }
    }
    if (!isFinite(minX)) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  /** Recursively render a set of layers that share the same parentId */
  function renderLayerGroup(parentId: string | null): React.ReactNode[] {
    return getGroupChildren(layers, parentId)
      .filter((l) => l.visible)
      .map((layer) => renderChild(layer));
  }

  /** Render a single layer — group children are nested; masked children clip the rest. */
  function renderChild(layer: LayerType): React.ReactNode {
    // Groups: render a <g> wrapper and recurse into children. When a child is
    // marked as a mask, the remaining children are clipped to its geometry.
    // Empty groups (no children) render a dashed placeholder box on the canvas.
    if (layer.type === "group") {
      const kids = getGroupChildren(layers, layer.id).filter((l) => l.visible);
      const maskChild = kids.find((k) => k.masked);
      const rest = maskChild ? kids.filter((k) => !k.masked) : kids;
      const isSelected = selectedSet.has(layer.id) && editingLayerId !== layer.id;
      const isRubberBandHighlighted = rubberBandSet.has(layer.id) && !selectedSet.has(layer.id);
      const showHighlight = isSelected || isRubberBandHighlighted;
      const isEmpty = kids.length === 0;

      // Compute bounding rect of all children for group selection highlight
      const childrenBounds = computeGroupChildrenBounds(layer.id);

      return (
        <g
          key={layer.id}
          data-layer-id={layer.id}
          data-layer-type="group"
          className="canvas-element"
          onMouseDown={(e) => onElementMouseDown(e, layer.id)}
        >
          {/* Empty group placeholder — centered on canvas, dashed box so users can find it */}
          {isEmpty && (() => {
            const pw = 140;
            const ph = 100;
            // Stagger multiple empty groups so they don't perfectly overlap
            const emptyGroupCount = layers.filter((l) => l.type === "group" && getGroupChildren(layers, l.id).filter((k) => k.visible).length === 0).length;
            const emptyGroupIdx = layers.filter((l) => l.type === "group" && getGroupChildren(layers, l.id).filter((k) => k.visible).length === 0).findIndex((l) => l.id === layer.id);
            const staggerOffset = emptyGroupCount > 1 ? (emptyGroupIdx - (emptyGroupCount - 1) / 2) * 24 : 0;
            const px = Math.round((frameSize.width - pw) / 2) + staggerOffset;
            const py = Math.round((frameSize.height - ph) / 2) + staggerOffset;
            return (
            <g>
              {showHighlight ? (
                <rect
                  x={px}
                  y={py}
                  width={pw}
                  height={ph}
                  fill="rgba(59,130,246,0.06)"
                  stroke="#3b82f6"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  rx={4}
                  className="pointer-events-none"
                />
              ) : (
                <>
                  {/* Ghost outline */}
                  <rect
                    x={px}
                    y={py}
                    width={pw}
                    height={ph}
                    fill="transparent"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                    rx={4}
                    className="pointer-events-none"
                  />
                  {/* Group label */}
                  <text
                    x={px + pw / 2}
                    y={py + ph / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="rgba(255,255,255,0.12)"
                    fontSize={9}
                    fontFamily="JetBrains Mono, monospace"
                    className="pointer-events-none"
                  >
                    {layer.name}
                  </text>
                </>
              )}
              {/* Invisible hit area for selection */}
              <rect
                x={px}
                y={py}
                width={pw}
                height={ph}
                fill="transparent"
              />
            </g>
            );
          })()}
          {maskChild ? (
            <>
              {rest.length > 0 && (
                <g clipPath={`url(#mask-${layer.id})`}>
                  {rest.map((kid) => renderChild(kid))}
                </g>
              )}
              {/* The mask layer itself renders normally (Figma shows its fill) */}
              {renderChild(maskChild)}
            </>
          ) : (
            kids.map((kid) => renderChild(kid))
          )}
          {showHighlight && !isEmpty && childrenBounds && (
            <rect
              x={childrenBounds.x - 2}
              y={childrenBounds.y - 2}
              width={childrenBounds.width + 4}
              height={childrenBounds.height + 4}
              fill="none"
              stroke={isRubberBandHighlighted ? "#60a5fa" : "#3b82f6"}
              strokeWidth={1}
              strokeDasharray={isRubberBandHighlighted ? "3 2" : undefined}
              rx={2}
              className="pointer-events-none"
            />
          )}
        </g>
      );
    }

    // Leaf elements: require properties to render
    const props = elementProperties[layer.id];
    if (!props) return null;

    const isSelected = selectedSet.has(layer.id) && editingLayerId !== layer.id;
    const isRubberBandHighlighted = rubberBandSet.has(layer.id) && !selectedSet.has(layer.id);
    const suppressSelectionOutline = layer.id === hideSelectionOutlineForId;
    const isEditing = editingLayerId === layer.id;
    // Figma-style hover preview: dashed outline while hovering under the move tool.
    const isHovered =
      hoveredLayerId === layer.id &&
      !isSelected &&
      !isRubberBandHighlighted &&
      !isEditing;
    const hoverBox = isHovered ? getElementBoundingBox(props) : null;

    const animStyle = getAnimStyle(layer.id);
    const animDelay = getAnimDelay(layer.id);
    return (
      <g
        key={layer.id}
        data-layer-id={layer.id}
        onMouseDown={(e) => onElementMouseDown(e, layer.id)}
        onDoubleClick={(e) => onElementDoubleClick?.(e, layer.id)}
        onMouseEnter={() => onElementHover?.(layer.id)}
        onMouseLeave={() => onElementHover?.(null)}
        style={{
          pointerEvents: isEditing ? "none" : undefined,
          animation: animStyle ?? undefined,
          animationDelay: animDelay ?? undefined,
          animationPlayState: scrubTime != null ? "paused" : undefined,
        }}
      >
        {props.type === "text" ? (
          <TextElement
            properties={props}
            isSelected={isSelected}
            isRubberBandHighlighted={isRubberBandHighlighted}
            suppressSelectionOutline={suppressSelectionOutline}
            isEditing={isEditing}
          />
        ) : props.type === "image" ? (
          <ImageElement
            properties={props}
            isSelected={isSelected}
            isRubberBandHighlighted={isRubberBandHighlighted}
            suppressSelectionOutline={suppressSelectionOutline}
          />
        ) : props.type === "path" ? (
          <PathElement
            properties={props}
            isSelected={isSelected}
            isRubberBandHighlighted={isRubberBandHighlighted}
            suppressSelectionOutline={suppressSelectionOutline}
            showEditPoints={showEditPoints}
            showMidpointTargets={showEditPoints && hoveredLayerId === layer.id}
            selectedVertexIndex={
              selectedVertex?.layerId === layer.id ? selectedVertex.index : null
            }
            layerId={layer.id}
          />
        ) : (
          <ShapeElement
            properties={props}
            isSelected={isSelected}
            isRubberBandHighlighted={isRubberBandHighlighted}
            suppressSelectionOutline={suppressSelectionOutline}
            layerId={layer.id}
          />
        )}
        {hoverBox && (
          <rect
            x={hoverBox.x}
            y={hoverBox.y}
            width={hoverBox.width}
            height={hoverBox.height}
            fill="none"
            stroke="#60a5fa"
            strokeWidth={1}
            strokeDasharray="3 3"
            rx={2}
            className="pointer-events-none"
          />
        )}
      </g>
    );
  }

  // Collect gradient defs for all layers using gradients
  const gradientDefs: React.ReactNode[] = [];
  for (const layer of layers) {
    const props = elementProperties[layer.id];
    if (!props || (props.type !== "shape" && props.type !== "image")) continue;
    // Only shapes can carry a gradient fill; images have no fill property.
    // ShapeElementProperties.fill is typed as string but may hold a GradientFill
    // (assigned via the gradient editor) — isGradient narrows it safely.
    const fill: string | GradientFill = props.type === "shape" ? props.fill : "";
    if (isGradient(fill)) {
      gradientDefs.push(
        <GradientDef key={layer.id} layerId={layer.id} gradient={fill} />,
      );
    }
  }

  // Collect animation @keyframes CSS for preview mode
  const animationKeyframesCSS: string[] = [];
  const animatedLayerIds = new Set<string>();
  if (previewAnimation) {
    const seenNames = new Set<string>();
    for (const layer of layers) {
      if (!layer.visible) continue;
      const props = elementProperties[layer.id];
      const anim = props?.animation;
      if (anim && !seenNames.has(anim.name)) {
        seenNames.add(anim.name);
        if (anim.customKeyframes) {
          // Use user-defined custom @keyframes block
          animationKeyframesCSS.push(anim.customKeyframes);
        } else {
          // Find the preset keyframes CSS for this animation name
          const preset = Object.entries(ANIMATION_PRESETS).find(
            ([, p]) => p.defaults.name === anim.name,
          );
          if (preset) {
            animationKeyframesCSS.push(preset[1].keyframesCSS);
          }
        }
      }
      if (anim) {
        animatedLayerIds.add(layer.id);
      }
    }
  }

  // Build CSS animation string for a layer
  const getAnimStyle = (layerId: string): string | undefined => {
    const props = elementProperties[layerId];
    const anim = props?.animation;
    if (!anim || !previewAnimation) return undefined;
    const base = buildAnimationCSS(anim);
    if (scrubTime != null) {
      // Scrub mode: pause animation at exact position using negative delay
      return `${base} paused`;
    }
    return base;
  };

  // Build negative delay for scrub mode
  const getAnimDelay = (layerId: string): string | undefined => {
    if (scrubTime == null) return undefined;
    const props = elementProperties[layerId];
    const anim = props?.animation;
    if (!anim || !previewAnimation) return undefined;
    return `${-scrubTime}s`;
  };

  return (
    <>
      {(gradientDefs.length > 0 || animationKeyframesCSS.length > 0 || maskClipPaths.length > 0) && (
        <defs>
          {gradientDefs}
          {maskClipPaths}
          {animationKeyframesCSS.length > 0 && (
            <style>{`\n${animationKeyframesCSS.join("\n")}\n`}</style>
          )}
        </defs>
      )}
      {renderLayerGroup(null)}
    </>
  );
}

export { getTextBoundingBox, getShapeBoundingBox, getImageBoundingBox, getPathBoundingBox };

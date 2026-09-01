import { memo } from "react";
import type { LayerType } from "../../context/EditorContext";
import { type GradientFill, gradientId, gradientUrl, isGradient } from "../../lib/editor/gradient";
import { TEXT_ANCHOR_MAP, getTextVerticalOffset, getTextXWithinBox } from "../../lib/editor/textAlign";
import { getTextLines, getLineHeight, getTextBlockHeight, getTextBlockWidth } from "../../lib/editor/textMeasure";
import { pointsToSvgD, segmentMidpoint } from "../../lib/editor/pathUtils";

// ── Re-export extracted modules for backward compatibility ────────────────────
export type { AnimationConfig } from "./animationPresets";
export { ANIMATION_PRESETS, buildAnimationCSS } from "./animationPresets";
export type { TextElementProperties, ShapeElementProperties, ImageElementProperties, PathElementProperties, ElementProperties, ShapeKind } from "./elementTypes";
export { getTextBoundingBox, getShapeBoundingBox, getImageBoundingBox, getPathBoundingBox, computePathBounds, getElementBoundingBox } from "./boundingBox";
export { trianglePath, starPath, hexagonPath } from "./shapeHelpers";

// ── Internal imports from extracted modules ───────────────────────────────────
import type { TextElementProperties, ShapeElementProperties, ImageElementProperties, PathElementProperties, ElementProperties } from "./elementTypes";
import { getElementBoundingBox } from "./boundingBox";
import { trianglePath, starPath, hexagonPath } from "./shapeHelpers";
import { ANIMATION_PRESETS, buildAnimationCSS } from "./animationPresets";

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
      {properties.backgroundColor && (
        <rect
          x={0} y={0} width={boxWidth} height={boxHeight}
          fill={properties.backgroundColor} rx={3}
          className="pointer-events-none"
        />
      )}
      {showHighlight && (
        <rect
          x={-2} y={-2} width={boxWidth + 4} height={boxHeight + 4}
          fill={isRubberBandHighlighted && !isSelected ? "rgba(59,130,246,0.08)" : "none"}
          stroke={isRubberBandHighlighted && !isSelected ? "#60a5fa" : "#3b82f6"}
          strokeWidth={1}
          strokeDasharray={isRubberBandHighlighted && !isSelected ? "3 2" : undefined}
          rx={2} className="pointer-events-none"
        />
      )}
      {!isEditing && (
        <>
          {lines.map((line, i) => {
            const lineY = blockOffsetY + properties.fontSize + i * lineHeight;
            const decoration = properties.textDecoration ?? "NONE";
            const decorationY = decoration === "UNDERLINE" ? lineY + 2 : lineY - properties.fontSize * 0.4;
            return (
              <g key={i} className="pointer-events-none">
                <text
                  x={lineX} y={lineY}
                  fontFamily={properties.fontFamily} fontSize={properties.fontSize}
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
                    y1={decorationY} y2={decorationY}
                    stroke={properties.color}
                    strokeWidth={Math.max(1, properties.fontSize * 0.06)}
                  />
                )}
              </g>
            );
          })}
          <rect x={0} y={0} width={boxWidth} height={boxHeight} fill="transparent" />
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
  const { kind, x, y, width, height, fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin, strokeDashArray, cornerRadius, opacity, rotation, flipH, flipV } = properties;
  const fillValue = isGradient(fill) && layerId ? gradientUrl(layerId) : (fill as string);
  const showHighlight = (isSelected && !suppressSelectionOutline) || isRubberBandHighlighted;

  const selectionStroke = isRubberBandHighlighted && !isSelected ? "#60a5fa" : "#3b82f6";
  const selectionDash = isRubberBandHighlighted && !isSelected ? "3 2" : undefined;
  const selectionFill = isRubberBandHighlighted && !isSelected ? "rgba(59,130,246,0.08)" : "none";

  const cx = x + width / 2;
  const cy = y + height / 2;
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

  let shapeEl: React.ReactNode;
  let hitEl: React.ReactNode;

  if (kind === "rect") {
    shapeEl = <rect x={x} y={y} width={width} height={height} fill={fillValue} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={cap} strokeLinejoin={join} strokeDasharray={strokeDashArray || undefined} opacity={opacity} rx={cornerRadius ?? 4} />;
    hitEl = <rect x={x} y={y} width={width} height={height} fill="transparent" />;
  } else if (kind === "circle") {
    const rx = width / 2;
    const ry = height / 2;
    shapeEl = <ellipse cx={x + rx} cy={y + ry} rx={rx} ry={ry} fill={fillValue} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={cap} strokeLinejoin={join} opacity={opacity} />;
    hitEl = <rect x={x} y={y} width={width} height={height} fill="transparent" />;
  } else if (kind === "triangle") {
    shapeEl = <path d={trianglePath(x, y, width, height)} fill={fillValue} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={cap} strokeLinejoin={join} opacity={opacity} />;
    hitEl = <rect x={x} y={y} width={width} height={height} fill="transparent" />;
  } else if (kind === "star") {
    shapeEl = <path d={starPath(x, y, width, height)} fill={fillValue} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={cap} strokeLinejoin={join} opacity={opacity} />;
    hitEl = <rect x={x} y={y} width={width} height={height} fill="transparent" />;
  } else if (kind === "hexagon") {
    shapeEl = <path d={hexagonPath(x, y, width, height)} fill={fillValue} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={cap} strokeLinejoin={join} opacity={opacity} />;
    hitEl = <rect x={x} y={y} width={width} height={height} fill="transparent" />;
  } else if (kind === "line") {
    const midY = y + height / 2;
    shapeEl = <line x1={x} y1={midY} x2={x + width} y2={midY} stroke={stroke || fillValue} strokeWidth={Math.max(strokeWidth, 2)} strokeLinecap={cap} strokeDasharray={strokeDashArray || undefined} opacity={opacity} />;
    hitEl = <rect x={x} y={midY - 6} width={width} height={12} fill="transparent" />;
  } else {
    shapeEl = null;
    hitEl = null;
  }

  return (
    <g className="canvas-element" data-layer-type="shape" transform={combinedTransform}>
      {shapeEl}
      {hitEl}
      {showHighlight && (
        <rect x={x - 2} y={y - 2} width={width + 4} height={height + 4} fill={selectionFill} stroke={selectionStroke} strokeWidth={1} strokeDasharray={selectionDash} rx={2} className="pointer-events-none" />
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

  const selectionStroke = isRubberBandHighlighted && !isSelected ? "#60a5fa" : "#3b82f6";
  const selectionDash = isRubberBandHighlighted && !isSelected ? "3 2" : undefined;
  const selectionFill = isRubberBandHighlighted && !isSelected ? "rgba(59,130,246,0.08)" : "none";

  const cx = x + width / 2;
  const cy = y + height / 2;
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
    <g className="canvas-element" data-layer-type="image" transform={combinedTransform}>
      <image href={url} x={x} y={y} width={width} height={height} opacity={opacity} preserveAspectRatio="none" />
      <rect x={x} y={y} width={width} height={height} fill="transparent" />
      {showHighlight && (
        <rect x={x - 2} y={y - 2} width={width + 4} height={height + 4} fill={selectionFill} stroke={selectionStroke} strokeWidth={1} strokeDasharray={selectionDash} rx={2} className="pointer-events-none" />
      )}
    </g>
  );
});

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
    selectedVertexIndex != null && selectedVertexIndex >= 0 && selectedVertexIndex < points.length
      ? selectedVertexIndex
      : null;

  const segmentCount = closed ? points.length : Math.max(points.length - 1, 0);
  const midpoints = showMidpointTargets
    ? Array.from({ length: segmentCount }, (_, i) => ({
        point: segmentMidpoint(points, handles, i, closed),
        index: i,
      }))
    : [];

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
                <line x1={ax} y1={ay} x2={hp[0]} y2={hp[1]} stroke="#60a5fa" strokeWidth={1} className="pointer-events-none" />
                <circle cx={hp[0]} cy={hp[1]} r={3.5} fill="white" stroke="#3b82f6" strokeWidth={1.5} style={{ cursor: "pointer" }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent("path-handle-mousedown", { detail: { layerId, vertexIndex: selectedIndex, side } }));
                  }}
                />
              </g>
            );
          };
          return <g>{renderSide("in")}{renderSide("out")}</g>;
        })()
      : null;

  return (
    <g className="canvas-element" data-layer-type="path" transform={rotateTransform}>
      <path d={d} fill={closed ? fill : "none"} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} strokeLinecap="round" strokeLinejoin="round" />
      <rect x={x} y={y} width={width} height={height} fill="transparent" />
      {showHighlight && (
        <rect x={x - 2} y={y - 2} width={width + 4} height={height + 4} fill={selectionFill} stroke={selectionStroke} strokeWidth={1} strokeDasharray={selectionDash} rx={2} className="pointer-events-none" />
      )}
      {showEditPoints && isSelected && (
        <g>
          {selectedHandles}
          {points.map(([px, py], i) => {
            const isSel = selectedIndex === i;
            return (
              <circle
                key={i} cx={px} cy={py} r={isSel ? 5 : 4}
                fill={isSel ? "#3b82f6" : "white"}
                stroke={isSel ? "white" : "#3b82f6"}
                strokeWidth={1.5} style={{ cursor: "pointer" }}
                data-vertex-index={i}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  if (e.altKey) {
                    window.dispatchEvent(new CustomEvent("path-vertex-convert", { detail: { layerId, vertexIndex: i } }));
                    return;
                  }
                  window.dispatchEvent(new CustomEvent("path-vertex-mousedown", { detail: { layerId, vertexIndex: i } }));
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent("path-vertex-convert", { detail: { layerId, vertexIndex: i } }));
                }}
              />
            );
          })}
          {midpoints.map(({ point, index }) => (
            <g key={`mid-${index}`} style={{ cursor: "pointer" }}
              onMouseDown={(e) => {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent("path-node-add", { detail: { layerId, segmentIndex: index } }));
              }}
            >
              <circle cx={point[0]} cy={point[1]} r={9} fill="transparent" />
              <circle cx={point[0]} cy={point[1]} r={3} fill="#a78bfa" stroke="white" strokeWidth={1} className="pointer-events-none" />
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
    <stop key={s.offset} offset={`${(s.offset * 100).toFixed(0)}%`} stopColor={s.color} />
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
  selectedLayerId?: string | null;
  selectedLayerIds?: string[];
  editingLayerId?: string | null;
  rubberBandHighlightedIds?: string[];
  hoveredLayerId?: string | null;
  hideSelectionOutlineForId?: string | null;
  showEditPoints?: boolean;
  selectedVertex?: { layerId: string; index: number } | null;
  previewAnimation?: boolean;
  scrubTime?: number | null;
  frameSize: { width: number; height: number };
  onElementMouseDown: (e: React.MouseEvent, layerId: string) => void;
  onElementDoubleClick?: (e: React.MouseEvent, layerId: string) => void;
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
  const selectedSet = new Set(selectedLayerIds ?? (selectedLayerId ? [selectedLayerId] : []));
  const rubberBandSet = new Set(rubberBandHighlightedIds ?? []);

  function renderMaskClipContent(child: LayerType): React.ReactNode {
    const props = elementProperties[child.id];
    if (!props) return null;
    if (props.type === "shape") {
      const { kind, x, y, width, height, cornerRadius } = props;
      if (kind === "rect") return <rect x={x} y={y} width={width} height={height} rx={cornerRadius ?? 4} />;
      if (kind === "circle") return <ellipse cx={x + width / 2} cy={y + height / 2} rx={width / 2} ry={height / 2} />;
      if (kind === "triangle") return <path d={trianglePath(x, y, width, height)} />;
      if (kind === "star") return <path d={starPath(x, y, width, height)} />;
      if (kind === "hexagon") return <path d={hexagonPath(x, y, width, height)} />;
      return null;
    }
    if (props.type === "path") {
      return <path d={pointsToSvgD(props.points, props.closed, props.handles, props.subpaths)} />;
    }
    if (props.type === "text") {
      return <text x={props.x} y={props.y + props.fontSize} fontFamily={props.fontFamily} fontSize={props.fontSize} fontWeight={props.fontWeight}>{props.content}</text>;
    }
    return null;
  }

  const maskClipPaths: React.ReactNode[] = [];
  for (const layer of layers) {
    if (layer.type !== "group") continue;
    const maskChild = getGroupChildren(layers, layer.id).find((k) => k.masked);
    if (!maskChild) continue;
    maskClipPaths.push(
      <clipPath key={layer.id} id={`mask-${layer.id}`}>{renderMaskClipContent(maskChild)}</clipPath>,
    );
  }

  function computeGroupChildrenBounds(groupId: string): { x: number; y: number; width: number; height: number } | null {
    const kids = getGroupChildren(layers, groupId).filter((l) => l.visible);
    if (kids.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const kid of kids) {
      const props = elementProperties[kid.id];
      if (!props) continue;
      const box = getElementBoundingBox(props);
      const rotation = (props as { rotation?: number }).rotation ?? 0;
      if (rotation !== 0) {
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

  function renderLayerGroup(parentId: string | null): React.ReactNode[] {
    return getGroupChildren(layers, parentId)
      .filter((l) => l.visible)
      .map((layer) => renderChild(layer));
  }

  function renderChild(layer: LayerType): React.ReactNode {
    if (layer.type === "group") {
      const kids = getGroupChildren(layers, layer.id).filter((l) => l.visible);
      const maskChild = kids.find((k) => k.masked);
      const rest = maskChild ? kids.filter((k) => !k.masked) : kids;
      const isSelected = selectedSet.has(layer.id) && editingLayerId !== layer.id;
      const isRubberBandHighlighted = rubberBandSet.has(layer.id) && !selectedSet.has(layer.id);
      const showHighlight = isSelected || isRubberBandHighlighted;
      const isEmpty = kids.length === 0;
      const childrenBounds = computeGroupChildrenBounds(layer.id);

      return (
        <g key={layer.id} data-layer-id={layer.id} data-layer-type="group" className="canvas-element" onMouseDown={(e) => onElementMouseDown(e, layer.id)}>
          {isEmpty && (() => {
            const pw = 140;
            const ph = 100;
            const emptyGroupCount = layers.filter((l) => l.type === "group" && getGroupChildren(layers, l.id).filter((k) => k.visible).length === 0).length;
            const emptyGroupIdx = layers.filter((l) => l.type === "group" && getGroupChildren(layers, l.id).filter((k) => k.visible).length === 0).findIndex((l) => l.id === layer.id);
            const staggerOffset = emptyGroupCount > 1 ? (emptyGroupIdx - (emptyGroupCount - 1) / 2) * 24 : 0;
            const px = Math.round((frameSize.width - pw) / 2) + staggerOffset;
            const py = Math.round((frameSize.height - ph) / 2) + staggerOffset;
            return (
              <g>
                {showHighlight ? (
                  <rect x={px} y={py} width={pw} height={ph} fill="rgba(59,130,246,0.06)" stroke="#3b82f6" strokeWidth={1} strokeDasharray="4 3" rx={4} className="pointer-events-none" />
                ) : (
                  <>
                    <rect x={px} y={py} width={pw} height={ph} fill="transparent" stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeDasharray="4 3" rx={4} className="pointer-events-none" />
                    <text x={px + pw / 2} y={py + ph / 2} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.12)" fontSize={9} fontFamily="JetBrains Mono, monospace" className="pointer-events-none">{layer.name}</text>
                  </>
                )}
                <rect x={px} y={py} width={pw} height={ph} fill="transparent" />
              </g>
            );
          })()}
          {maskChild ? (
            <>
              {rest.length > 0 && <g clipPath={`url(#mask-${layer.id})`}>{rest.map((kid) => renderChild(kid))}</g>}
              {renderChild(maskChild)}
            </>
          ) : (
            kids.map((kid) => renderChild(kid))
          )}
          {showHighlight && !isEmpty && childrenBounds && (
            <rect x={childrenBounds.x - 2} y={childrenBounds.y - 2} width={childrenBounds.width + 4} height={childrenBounds.height + 4} fill="none" stroke={isRubberBandHighlighted ? "#60a5fa" : "#3b82f6"} strokeWidth={1} strokeDasharray={isRubberBandHighlighted ? "3 2" : undefined} rx={2} className="pointer-events-none" />
          )}
        </g>
      );
    }

    const props = elementProperties[layer.id];
    if (!props) return null;

    const isSelected = selectedSet.has(layer.id) && editingLayerId !== layer.id;
    const isRubberBandHighlighted = rubberBandSet.has(layer.id) && !selectedSet.has(layer.id);
    const suppressSelectionOutline = layer.id === hideSelectionOutlineForId;
    const isEditing = editingLayerId === layer.id;
    const isHovered = hoveredLayerId === layer.id && !isSelected && !isRubberBandHighlighted && !isEditing;
    const hoverBox = isHovered ? getElementBoundingBox(props) : null;
    const hoverTransform = (() => {
      if (!hoverBox || !isHovered) return undefined;
      const rotation = (props as { rotation?: number }).rotation ?? 0;
      const flipH = (props as { flipH?: boolean }).flipH;
      const flipV = (props as { flipV?: boolean }).flipV;
      if (!rotation && !flipH && !flipV) return undefined;
      const cx = hoverBox.x + hoverBox.width / 2;
      const cy = hoverBox.y + hoverBox.height / 2;
      const sx = flipH ? -1 : 1;
      const sy = flipV ? -1 : 1;
      if (flipH || flipV) {
        if (rotation) return `translate(${cx}, ${cy}) rotate(${rotation}) scale(${sx}, ${sy}) translate(${-cx}, ${-cy})`;
        return `translate(${cx}, ${cy}) scale(${sx}, ${sy}) translate(${-cx}, ${-cy})`;
      }
      return `rotate(${rotation}, ${cx}, ${cy})`;
    })();

    const animStyle = getAnimStyle(layer.id);
    const animDelay = getAnimDelay(layer.id);
    return (
      <g
        key={layer.id} data-layer-id={layer.id}
        onMouseDown={(e) => onElementMouseDown(e, layer.id)}
        onDoubleClick={(e) => onElementDoubleClick?.(e, layer.id)}
        onMouseEnter={() => onElementHover?.(layer.id)}
        onMouseLeave={() => onElementHover?.(null)}
        style={{ pointerEvents: isEditing ? "none" : undefined, animation: animStyle ?? undefined, animationDelay: animDelay ?? undefined, animationPlayState: scrubTime != null ? "paused" : undefined }}
      >
        {props.type === "text" ? (
          <TextElement properties={props} isSelected={isSelected} isRubberBandHighlighted={isRubberBandHighlighted} suppressSelectionOutline={suppressSelectionOutline} isEditing={isEditing} />
        ) : props.type === "image" ? (
          <ImageElement properties={props} isSelected={isSelected} isRubberBandHighlighted={isRubberBandHighlighted} suppressSelectionOutline={suppressSelectionOutline} />
        ) : props.type === "path" ? (
          <PathElement properties={props} isSelected={isSelected} isRubberBandHighlighted={isRubberBandHighlighted} suppressSelectionOutline={suppressSelectionOutline} showEditPoints={showEditPoints} showMidpointTargets={showEditPoints && hoveredLayerId === layer.id} selectedVertexIndex={selectedVertex?.layerId === layer.id ? selectedVertex.index : null} layerId={layer.id} />
        ) : (
          <ShapeElement properties={props} isSelected={isSelected} isRubberBandHighlighted={isRubberBandHighlighted} suppressSelectionOutline={suppressSelectionOutline} layerId={layer.id} />
        )}
        {hoverBox && (
          <g transform={hoverTransform} className="pointer-events-none">
            <rect x={hoverBox.x} y={hoverBox.y} width={hoverBox.width} height={hoverBox.height} fill="none" stroke="#60a5fa" strokeWidth={1} strokeDasharray="3 3" rx={2} />
          </g>
        )}
      </g>
    );
  }

  const gradientDefs: React.ReactNode[] = [];
  for (const layer of layers) {
    const props = elementProperties[layer.id];
    if (!props || (props.type !== "shape" && props.type !== "image")) continue;
    const fill: string | GradientFill = props.type === "shape" ? props.fill : "";
    if (isGradient(fill)) {
      gradientDefs.push(<GradientDef key={layer.id} layerId={layer.id} gradient={fill} />);
    }
  }

  const animationKeyframesCSS: string[] = [];
  if (previewAnimation) {
    const seenNames = new Set<string>();
    for (const layer of layers) {
      if (!layer.visible) continue;
      const props = elementProperties[layer.id];
      const anim = props?.animation;
      if (anim && !seenNames.has(anim.name)) {
        seenNames.add(anim.name);
        if (anim.customKeyframes) {
          animationKeyframesCSS.push(anim.customKeyframes);
        } else {
          const preset = Object.entries(ANIMATION_PRESETS).find(([, p]) => p.defaults.name === anim.name);
          if (preset) animationKeyframesCSS.push(preset[1].keyframesCSS);
        }
      }
    }
  }

  const getAnimStyle = (layerId: string): string | undefined => {
    const props = elementProperties[layerId];
    const anim = props?.animation;
    if (!anim || !previewAnimation) return undefined;
    const base = buildAnimationCSS(anim);
    if (scrubTime != null) return `${base} paused`;
    return base;
  };

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
          {animationKeyframesCSS.length > 0 && <style>{`\n${animationKeyframesCSS.join("\n")}\n`}</style>}
        </defs>
      )}
      {renderLayerGroup(null)}
    </>
  );
}

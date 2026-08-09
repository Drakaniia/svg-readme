import type { LayerType } from "../../../context/EditorContext";
import type { ElementProperties, ShapeElementProperties, PathElementProperties, ShapeKind } from "../../../components/editor-canvas/ElementsRenderer";
import { polygonBoolean, type BooleanOp, type Pt } from "../booleanGeometry";
import { computePointsBounds } from "../pathUtils";

export { type BooleanOp };

/**
 * Sample a shape/path element's outline as a polygon (absolute canvas coords),
 * with rotation baked in. Returns null when the element has no area (lines,
 * open paths) so boolean ops skip it.
 */
export function shapeToPolygon(
  props: ShapeElementProperties | PathElementProperties,
): Pt[] | null {
  let pts: Pt[] | null = null;
  const { x, y, width, height } = props;

  if (props.type === "path") {
    if (!props.closed || props.points.length < 3) return null;
    pts = props.points.map(([px, py]) => [px, py]);
  } else {
    const kind: ShapeKind = props.kind;
    switch (kind) {
      case "rect": {
        pts = [
          [x, y],
          [x + width, y],
          [x + width, y + height],
          [x, y + height],
        ];
        break;
      }
      case "circle": {
        const cx = x + width / 2;
        const cy = y + height / 2;
        const rx = width / 2;
        const ry = height / 2;
        pts = Array.from({ length: 64 }, (_, i) => {
          const a = (i / 64) * Math.PI * 2;
          return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as Pt;
        });
        break;
      }
      case "triangle": {
        pts = [
          [x + width / 2, y],
          [x + width, y + height],
          [x, y + height],
        ];
        break;
      }
      case "star": {
        const cx = x + width / 2;
        const cy = y + height / 2;
        const outerR = Math.min(width, height) / 2;
        const innerR = outerR * 0.4;
        pts = [];
        for (let i = 0; i < 10; i++) {
          const angle = (Math.PI / 5) * i - Math.PI / 2;
          const r = i % 2 === 0 ? outerR : innerR;
          pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
        }
        break;
      }
      case "hexagon": {
        const cx = x + width / 2;
        const cy = y + height / 2;
        const rx = width / 2;
        const ry = height / 2;
        pts = [];
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          pts.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
        }
        break;
      }
      case "line":
        return null;
    }
  }

  if (!pts || pts.length < 3) return null;

  // Bake rotation around the element center (renderer applies it via transform,
  // so the boolean geometry must operate in rotated space too).
  const rotation = props.type === "path" ? props.rotation : props.rotation;
  if (rotation) {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    pts = pts.map(([px, py]) => {
      const dx = px - cx;
      const dy = py - cy;
      return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos] as Pt;
    });
  }
  return pts;
}

/**
 * Apply a boolean operation on two selected shape layers using real polygon
 * geometry (Greiner–Hormann). The result is a new path element; holes and
 * disjoint components are preserved as extra subpaths (nonzero fill rule).
 * Returns null when the inputs can't produce a single-path result (degenerate
 * shapes, disjoint union, failed trace) — in that case the original shapes are
 * left untouched (non-destructive).
 */
export function applyBooleanOp(
  layers: LayerType[],
  elementProperties: Record<string, ElementProperties>,
  selectedLayerIds: string[],
  op: BooleanOp,
): { updatedLayers: LayerType[]; updatedProperties: Record<string, ElementProperties>; resultId: string } | null {
  if (selectedLayerIds.length < 2) return null;

  const shapeIds = selectedLayerIds.filter((id) => {
    const props = elementProperties[id];
    return props && (props.type === "shape" || props.type === "path");
  });
  if (shapeIds.length < 2) return null;

  const targetId = shapeIds[0];
  const operandId = shapeIds[1];

  const rawTargetProps = elementProperties[targetId];
  const rawOperandProps = elementProperties[operandId];
  if (!rawTargetProps || !rawOperandProps) return null;

  const targetProps = rawTargetProps as ShapeElementProperties | PathElementProperties;
  const operandProps = rawOperandProps as ShapeElementProperties | PathElementProperties;

  const targetPoly = shapeToPolygon(targetProps);
  const operandPoly = shapeToPolygon(operandProps);
  if (!targetPoly || !operandPoly) return null;

  const loops = polygonBoolean(targetPoly, operandPoly, op);
  if (!loops || loops.length === 0) return null;

  const bounds = computePointsBounds(loops.flat());

  const resultId = `boolean-${Date.now()}`;
  const resultLayer: LayerType = {
    id: resultId,
    name: op.charAt(0).toUpperCase() + op.slice(1),
    type: "shape",
    locked: false,
    visible: true,
    parentId: layers.find((l) => l.id === targetId)?.parentId ?? null,
  };

  const resultProps: PathElementProperties = {
    type: "path",
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    points: loops[0],
    subpaths: loops.length > 1 ? loops.slice(1) : undefined,
    stroke: targetProps.stroke ?? "rgba(255,255,255,0.2)",
    strokeWidth: targetProps.strokeWidth ?? 1,
    fill: targetProps.fill ?? "#8b5cf6",
    opacity: targetProps.opacity ?? 1,
    closed: true,
  };

  // Remove the original shapes and add the result
  const removedIds = new Set([targetId, operandId]);
  const updatedLayers = layers.filter((l) => !removedIds.has(l.id));
  updatedLayers.push(resultLayer);

  const updatedProperties = { ...elementProperties };
  delete updatedProperties[targetId];
  delete updatedProperties[operandId];
  updatedProperties[resultId] = resultProps;

  return { updatedLayers, updatedProperties, resultId };
}

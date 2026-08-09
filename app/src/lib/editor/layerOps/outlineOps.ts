import type { LayerType } from "../../../context/EditorContext";
import type { ElementProperties, PathElementProperties } from "../../../components/editor-canvas/ElementsRenderer";
import { getTextAutoBox } from "../textMeasure";

/**
 * Convert a text layer to a path outline. Creates a new path layer from the
 * text element's bounding box as a simplified outline representation.
 */
export function outlineText(
  layers: LayerType[],
  elementProperties: Record<string, ElementProperties>,
  textLayerId: string,
): { updatedLayers: LayerType[]; updatedProperties: Record<string, ElementProperties>; pathId: string } | null {
  const textLayer = layers.find((l) => l.id === textLayerId);
  const textProps = elementProperties[textLayerId];

  if (!textLayer || !textProps || textProps.type !== "text") return null;

  const pathId = `outline-${Date.now()}`;
  const pathLayer: LayerType = {
    id: pathId,
    name: `${textLayer.name} (Outline)`,
    type: "shape",
    locked: false,
    visible: true,
    parentId: textLayer.parentId ?? null,
  };

  // Create a rectangular path representing the text outline — the box width
  // goes through the shared measurement (A11) when the text is auto-width.
  const boxWidth =
    typeof textProps.width === "number"
      ? textProps.width
      : getTextAutoBox(textProps, textProps.content).width;
  const boxHeight = textProps.height;

  const pathProps: PathElementProperties = {
    type: "path",
    x: textProps.x,
    y: textProps.y,
    width: boxWidth,
    height: boxHeight,
    points: [
      [textProps.x, textProps.y],
      [textProps.x + boxWidth, textProps.y],
      [textProps.x + boxWidth, textProps.y + boxHeight],
      [textProps.x, textProps.y + boxHeight],
    ],
    stroke: textProps.color,
    strokeWidth: 1,
    fill: textProps.color,
    opacity: 1,
    closed: true,
  };

  // Replace text layer with the outline path
  const updatedLayers = layers.map((l) =>
    l.id === textLayerId ? pathLayer : l,
  );
  const updatedProperties = { ...elementProperties };
  delete updatedProperties[textLayerId];
  updatedProperties[pathId] = pathProps;

  return { updatedLayers, updatedProperties, pathId };
}

/**
 * Convert a shape's stroke to a filled path outline. Creates a new path layer
 * from the stroke of a shape element.
 */
export function outlineStroke(
  layers: LayerType[],
  elementProperties: Record<string, ElementProperties>,
  shapeLayerId: string,
): { updatedLayers: LayerType[]; updatedProperties: Record<string, ElementProperties>; pathId: string } | null {
  const shapeLayer = layers.find((l) => l.id === shapeLayerId);
  const shapeProps = elementProperties[shapeLayerId];

  if (!shapeLayer || !shapeProps || (shapeProps.type !== "shape" && shapeProps.type !== "path")) return null;

  const pathId = `outline-stroke-${Date.now()}`;
  const pathLayer: LayerType = {
    id: pathId,
    name: `${shapeLayer.name} (Outline)`,
    type: "shape",
    locked: false,
    visible: true,
    parentId: shapeLayer.parentId ?? null,
  };

  // Create a path representing the stroke outline (shapeProps is narrowed to
  // shape|path here, both of which carry strokeWidth/stroke/opacity).
  const sw = shapeProps.strokeWidth ?? 2;
  const halfSw = sw / 2;

  const pathProps: PathElementProperties = {
    type: "path",
    x: shapeProps.x - halfSw,
    y: shapeProps.y - halfSw,
    width: shapeProps.width + sw,
    height: shapeProps.height + sw,
    points: [
      [shapeProps.x - halfSw, shapeProps.y - halfSw],
      [shapeProps.x + shapeProps.width + halfSw, shapeProps.y - halfSw],
      [shapeProps.x + shapeProps.width + halfSw, shapeProps.y + shapeProps.height + halfSw],
      [shapeProps.x - halfSw, shapeProps.y + shapeProps.height + halfSw],
    ],
    stroke: "none",
    strokeWidth: 0,
    fill: shapeProps.stroke,
    opacity: shapeProps.opacity ?? 1,
    closed: true,
  };

  // Add the outline as a new layer
  const updatedLayers = [...layers, pathLayer];
  const updatedProperties = { ...elementProperties, [pathId]: pathProps };

  return { updatedLayers, updatedProperties, pathId };
}

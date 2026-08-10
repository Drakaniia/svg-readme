export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GeometryItem {
  id: string;
  x: number;
  y: number;
  bounds: Bounds;
}

export type Alignment =
  | "left"
  | "center-horizontal"
  | "right"
  | "top"
  | "center-vertical"
  | "bottom";

export type Distribution = "horizontal" | "vertical";

export interface Position {
  x: number;
  y: number;
}

export interface SnapGuide {
  x?: number;
  y?: number;
}

export interface SnapOptions {
  gridSize?: number;
  guides?: SnapGuide[];
  threshold?: number;
}

export interface Viewport {
  zoom: number;
  panX: number;
  panY: number;
}

export interface Point {
  x: number;
  y: number;
}

export function getSelectionBounds(items: GeometryItem[]): Bounds | null {
  if (items.length === 0) return null;
  const left = Math.min(...items.map((item) => item.bounds.x));
  const top = Math.min(...items.map((item) => item.bounds.y));
  const right = Math.max(...items.map((item) => item.bounds.x + item.bounds.width));
  const bottom = Math.max(...items.map((item) => item.bounds.y + item.bounds.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function alignItems(
  items: GeometryItem[],
  alignment: Alignment,
): Record<string, Position> {
  const selection = getSelectionBounds(items);
  if (!selection) return {};

  return Object.fromEntries(items.map((item) => {
    const { bounds } = item;
    let x = item.x;
    let y = item.y;
    switch (alignment) {
      case "left": x += selection.x - bounds.x; break;
      case "center-horizontal": x += selection.x + selection.width / 2 - (bounds.x + bounds.width / 2); break;
      case "right": x += selection.x + selection.width - (bounds.x + bounds.width); break;
      case "top": y += selection.y - bounds.y; break;
      case "center-vertical": y += selection.y + selection.height / 2 - (bounds.y + bounds.height / 2); break;
      case "bottom": y += selection.y + selection.height - (bounds.y + bounds.height); break;
    }
    return [item.id, { x, y }];
  }));
}

export function distributeItems(
  items: GeometryItem[],
  direction: Distribution,
): Record<string, Position> {
  if (items.length < 3) {
    return Object.fromEntries(items.map((item) => [item.id, { x: item.x, y: item.y }]));
  }

  const sorted = [...items].sort((a, b) => direction === "horizontal"
    ? a.bounds.x - b.bounds.x
    : a.bounds.y - b.bounds.y);
  const selection = getSelectionBounds(sorted)!;
  const start = direction === "horizontal" ? selection.x : selection.y;
  const end = direction === "horizontal"
    ? selection.x + selection.width
    : selection.y + selection.height;
  const totalSize = sorted.reduce(
    (sum, item) => sum + (direction === "horizontal" ? item.bounds.width : item.bounds.height),
    0,
  );
  const gap = (end - start - totalSize) / (sorted.length - 1);
  let cursor = start;

  return Object.fromEntries(sorted.map((item) => {
    const size = direction === "horizontal" ? item.bounds.width : item.bounds.height;
    const currentStart = direction === "horizontal" ? item.bounds.x : item.bounds.y;
    const delta = cursor - currentStart;
    const position = direction === "horizontal"
      ? { x: item.x + delta, y: item.y }
      : { x: item.x, y: item.y + delta };
    cursor += size + gap;
    return [item.id, position];
  }));
}

/**
 * Distribute items with an exact, user-specified gap between their bounding
 * boxes (B7 — "distribute with spacing"). The outermost items stay in place
 * and the ones between them are repositioned so every adjacent pair is exactly
 * `gap` px apart along the given axis.
 */
export function distributeItemsWithSpacing(
  items: GeometryItem[],
  direction: Distribution,
  gap: number,
): Record<string, Position> {
  if (items.length < 3) {
    return Object.fromEntries(items.map((item) => [item.id, { x: item.x, y: item.y }]));
  }

  const sorted = [...items].sort((a, b) => direction === "horizontal"
    ? a.bounds.x - b.bounds.x
    : a.bounds.y - b.bounds.y);
  const n = sorted.length;
  const startOf = (item: GeometryItem) =>
    direction === "horizontal" ? item.bounds.x : item.bounds.y;
  const sizeOf = (item: GeometryItem) =>
    direction === "horizontal" ? item.bounds.width : item.bounds.height;

  // Anchor the FIRST and LAST items in place; slide the ones between them so
  // every adjacent pair is exactly `gap` px apart (B7).
  let cursor = startOf(sorted[0]);
  return Object.fromEntries(sorted.map((item, i) => {
    const size = sizeOf(item);
    const currentStart = startOf(item);
    const delta = i === 0 || i === n - 1 ? 0 : cursor - currentStart;
    const position = direction === "horizontal"
      ? { x: item.x + delta, y: item.y }
      : { x: item.x, y: item.y + delta };
    if (i < n - 1) cursor += size + gap;
    return [item.id, position];
  }));
}

/**
 * Proportionally remap element boxes through a bounds change — used when
 * resizing a multi-selection as a unit (B3). Each box is mapped with the same
 * ratio as the old selection bounds → new selection bounds; the result keeps
 * relative sizes and positions. Boxes outside the bounds collapse onto the
 * new origin edge (mirrors rescalePoints behavior for degenerate bounds).
 */
export function remapBoxesThroughBounds(
  boxes: Record<string, { x: number; y: number; width: number; height: number }>,
  oldBounds: Bounds,
  newBounds: Bounds,
): Record<string, Bounds> {
  const result: Record<string, Bounds> = {};
  for (const [id, box] of Object.entries(boxes)) {
    const nx =
      oldBounds.width > 0
        ? newBounds.x + ((box.x - oldBounds.x) / oldBounds.width) * newBounds.width
        : newBounds.x;
    const ny =
      oldBounds.height > 0
        ? newBounds.y + ((box.y - oldBounds.y) / oldBounds.height) * newBounds.height
        : newBounds.y;
    const nw =
      oldBounds.width > 0
        ? (box.width / oldBounds.width) * newBounds.width
        : newBounds.width;
    const nh =
      oldBounds.height > 0
        ? (box.height / oldBounds.height) * newBounds.height
        : newBounds.height;
    result[id] = { x: nx, y: ny, width: nw, height: nh };
  }
  return result;
}

/**
 * Align items relative to a fixed frame/artboard instead of the selection
 * bounds (B7 — align a single layer to the canvas). Each item is aligned
 * against `frame`, which is expressed as a Bounds in the same coordinate space.
 */
export function alignItemsToFrame(
  items: GeometryItem[],
  alignment: Alignment,
  frame: Bounds,
): Record<string, Position> {
  return Object.fromEntries(items.map((item) => {
    const { bounds } = item;
    let x = item.x;
    let y = item.y;
    switch (alignment) {
      case "left": x += frame.x - bounds.x; break;
      case "center-horizontal": x += frame.x + frame.width / 2 - (bounds.x + bounds.width / 2); break;
      case "right": x += frame.x + frame.width - (bounds.x + bounds.width); break;
      case "top": y += frame.y - bounds.y; break;
      case "center-vertical": y += frame.y + frame.height / 2 - (bounds.y + bounds.height / 2); break;
      case "bottom": y += frame.y + frame.height - (bounds.y + bounds.height); break;
    }
    return [item.id, { x, y }];
  }));
}
export function snapPosition(
  position: Position,
  options: SnapOptions = {},
): Position {
  const { gridSize = 0, guides = [], threshold = 6 } = options;
  const snap = (value: number, axis: "x" | "y") => {
    const gridValue = gridSize > 0 ? Math.round(value / gridSize) * gridSize : value;
    const guideValue = guides
      .map((guide) => guide[axis])
      .filter((guide): guide is number => guide !== undefined)
      .find((guide) => Math.abs(guide - value) <= threshold);
    return guideValue === undefined ? gridValue : guideValue;
  };
  return { x: snap(position.x, "x"), y: snap(position.y, "y") };
}

export function clampZoom(zoom: number, min = 0.1, max = 4): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(max, Math.max(min, zoom));
}

export function screenToWorld(point: Point, viewport: Viewport): Point {
  const zoom = clampZoom(viewport.zoom);
  return { x: (point.x - viewport.panX) / zoom, y: (point.y - viewport.panY) / zoom };
}

export function worldToScreen(point: Point, viewport: Viewport): Point {
  const zoom = clampZoom(viewport.zoom);
  return { x: point.x * zoom + viewport.panX, y: point.y * zoom + viewport.panY };
}

export function zoomAtPoint(viewport: Viewport, point: Point, requestedZoom: number): Viewport {
  const currentZoom = clampZoom(viewport.zoom);
  const zoom = clampZoom(requestedZoom);
  const worldPoint = screenToWorld(point, { ...viewport, zoom: currentZoom });
  return { zoom, panX: point.x - worldPoint.x * zoom, panY: point.y - worldPoint.y * zoom };
}

// ─── Hierarchical coordinate helpers for groups ──────────────────────────────

/**
 * Compute the absolute (canvas-space) bounding box of a layer considering group nesting.
 * Currently a pass-through since coordinates are stored in canvas space.
 * Returns null if the layer has no element properties and is not a group.
 */
export interface HierarchicalLayer {
  id: string;
  parentId?: string | null;
  type?: string;
}

export interface ElementWithBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Get all descendant leaf layer IDs of a group (recursive).
 */
export function getDescendantLeafIds(
  layers: HierarchicalLayer[],
  groupId: string,
): string[] {
  const result: string[] = [];
  for (const layer of layers) {
    if ((layer.parentId ?? null) === groupId) {
      if (layer.type === "group") {
        result.push(...getDescendantLeafIds(layers, layer.id));
      } else {
        result.push(layer.id);
      }
    }
  }
  return result;
}

/**
 * Compute the combined bounding box of a group by unioning all descendant element bounds.
 * Accepts the app's ElementProperties structurally (text widths may be "auto").
 */
export function getGroupBounds(
  layers: HierarchicalLayer[],
  elementProperties: Record<string, { x: number; y: number; width: number | "auto"; height: number }>,
  groupId: string,
): Bounds | null {
  const leafIds = getDescendantLeafIds(layers, groupId);
  if (leafIds.length === 0) return { x: 0, y: 0, width: 100, height: 100 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const id of leafIds) {
    const props = elementProperties[id];
    if (!props) continue;
    const w = typeof props.width === "number" ? props.width : 0;
    minX = Math.min(minX, props.x);
    minY = Math.min(minY, props.y);
    maxX = Math.max(maxX, props.x + w);
    maxY = Math.max(maxY, props.y + props.height);
  }

  if (!isFinite(minX)) return { x: 0, y: 0, width: 100, height: 100 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// ─── Smart Guides (alignment snap lines) ─────────────────────────────────────

/** A single alignment guide line to render on the canvas. */
export interface SnapGuideLine {
  /** "vertical" lines run from top to bottom at a given x; "horizontal" lines run left to right at a given y. */
  orientation: "vertical" | "horizontal";
  /** The x (vertical) or y (horizontal) coordinate of the guide line. */
  value: number;
  /** Start coordinate along the line (y for vertical, x for horizontal). */
  from: number;
  /** End coordinate along the line (y for vertical, x for horizontal). */
  to: number;
}

/** A snap result: the adjusted position and the guides that caused the snap. */
export interface SnapResult {
  position: Position;
  guides: SnapGuideLine[];
}

/** Edge keys for alignment detection. */
type EdgeKey = "left" | "centerX" | "right" | "top" | "centerY" | "bottom";

interface EdgeInfo {
  key: EdgeKey;
  value: number;
  orientation: "vertical" | "horizontal";
}

function getEdges(bounds: Bounds): EdgeInfo[] {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  return [
    { key: "left", value: bounds.x, orientation: "vertical" },
    { key: "centerX", value: cx, orientation: "vertical" },
    { key: "right", value: bounds.x + bounds.width, orientation: "vertical" },
    { key: "top", value: bounds.y, orientation: "horizontal" },
    { key: "centerY", value: cy, orientation: "horizontal" },
    { key: "bottom", value: bounds.y + bounds.height, orientation: "horizontal" },
  ];
}

/**
 * Compute smart alignment guides between a dragged element's bounds and
 * a set of sibling bounds. Returns the guide lines and the snap offset.
 */
export function computeSnapGuides(
  draggedBounds: Bounds,
  siblingBounds: Bounds[],
  threshold: number = 5,
): SnapResult {
  const draggedEdges = getEdges(draggedBounds);
  const guides: SnapGuideLine[] = [];
  let bestDx = 0;
  let bestDy = 0;
  let bestDistX = Infinity;
  let bestDistY = Infinity;

  for (const sibling of siblingBounds) {
    const siblingEdges = getEdges(sibling);

    for (const dEdge of draggedEdges) {
      for (const sEdge of siblingEdges) {
        // Only snap edges of the same orientation
        if (dEdge.orientation !== sEdge.orientation) continue;

        const dist = Math.abs(dEdge.value - sEdge.value);
        if (dist > threshold) continue;

        // Record this guide line
        if (dEdge.orientation === "vertical") {
          const from = Math.min(draggedBounds.y, sibling.y);
          const to = Math.max(draggedBounds.y + draggedBounds.height, sibling.y + sibling.height);
          guides.push({ orientation: "vertical", value: sEdge.value, from, to });
        } else {
          const from = Math.min(draggedBounds.x, sibling.x);
          const to = Math.max(draggedBounds.x + draggedBounds.width, sibling.x + sibling.width);
          guides.push({ orientation: "horizontal", value: sEdge.value, from, to });
        }

        // Track the best snap offset (closest alignment wins per axis)
        const offset = sEdge.value - dEdge.value;
        if (dEdge.orientation === "vertical" && dist < bestDistX) {
          bestDistX = dist;
          bestDx = offset;
        } else if (dEdge.orientation === "horizontal" && dist < bestDistY) {
          bestDistY = dist;
          bestDy = offset;
        }
      }
    }
  }

  // Deduplicate guides (same orientation + value)
  const seen = new Set<string>();
  const uniqueGuides = guides.filter((g) => {
    const k = `${g.orientation}:${g.value.toFixed(1)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    position: { x: draggedBounds.x + bestDx, y: draggedBounds.y + bestDy },
    guides: uniqueGuides,
  };
}

/**
 * Compute snap guides for a resize operation by checking alignment of
 * the resized element's edges against sibling edges.
 */
export function computeResizeSnapGuides(
  resizedBounds: Bounds,
  siblingBounds: Bounds[],
  threshold: number = 5,
): SnapResult {
  return computeSnapGuides(resizedBounds, siblingBounds, threshold);
}

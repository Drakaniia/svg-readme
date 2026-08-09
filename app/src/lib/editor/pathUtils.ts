/**
 * Vector-path utilities.
 *
 * Paths are stored as absolute anchor points (`points`) plus an optional
 * parallel `handles` array (one entry per anchor, may be `undefined`).
 * A segment between anchors i → i+1 becomes a cubic bezier (`C`) when either
 * endpoint carries a control handle — Figma's per-vertex handle model.
 *
 * Pure module — used by ElementsRenderer (rendering), export.ts (serialization),
 * PenTool (building) and EditorInner (node editing).
 */

/** Bezier handle data for one anchor point (parallel to `points`). */
export interface PathVertexHandle {
  /** Incoming control point (absolute) for the curve from the previous anchor. */
  in?: [number, number];
  /** Outgoing control point (absolute) for the curve to the next anchor. */
  out?: [number, number];
  /** Smooth point: `in`/`out` are mirrored across the anchor; dragging one mirrors the other. */
  smooth?: boolean;
}

export type PathHandles = (PathVertexHandle | undefined)[] | undefined;

/** Mirror a point across an anchor (2·anchor − p) — used for smooth handles. */
export function mirrorPoint(
  p: [number, number],
  anchor: [number, number],
): [number, number] {
  return [2 * anchor[0] - p[0], 2 * anchor[1] - p[1]];
}

/** Linear interpolation between two points. */
function lerp(
  a: [number, number],
  b: [number, number],
  t: number,
): [number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
  ];
}

/**
 * Build an SVG path `d` attribute from a points array.
 *
 * When `handles` is provided, segments whose endpoints carry control handles
 * are emitted as cubic bezier (`C`) commands; otherwise straight `L` commands
 * are used. Missing handles default to the anchor position, which supports
 * one-sided handles (a curve that starts or ends straight).
 */
export function pointsToSvgD(
  points: [number, number][],
  closed: boolean,
  handles?: PathHandles,
  subpaths?: [number, number][][],
): string {
  if (points.length === 0) return "";
  const n = points.length;
  const parts: string[] = [`M ${points[0][0]} ${points[0][1]}`];
  // Interior segments 0→1 … n-2→n-1. The closing segment of a closed path is
  // drawn by `Z` (straight) or as an explicit curve when it carries handles.
  for (let i = 0; i < n - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    const out = handles?.[i]?.out;
    const inn = handles?.[i + 1]?.in;
    if (out || inn) {
      const c1 = out ?? from;
      const c2 = inn ?? to;
      parts.push(`C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${to[0]} ${to[1]}`);
    } else {
      parts.push(`L ${to[0]} ${to[1]}`);
    }
  }
  if (closed) {
    // Curved closing segment (last anchor → first) when the wrap carries handles.
    if (n > 1) {
      const from = points[n - 1];
      const to = points[0];
      const out = handles?.[n - 1]?.out;
      const inn = handles?.[0]?.in;
      if (out || inn) {
        const c1 = out ?? from;
        const c2 = inn ?? to;
        parts.push(`C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${to[0]} ${to[1]}`);
      }
    }
    if (points.length > 2) parts.push("Z");
  }
  // Extra loops from boolean ops (holes / disjoint components) — straight edges.
  if (subpaths && subpaths.length > 0) {
    for (const loop of subpaths) {
      if (loop.length < 2) continue;
      parts.push(`M ${loop[0][0]} ${loop[0][1]}`);
      for (let i = 1; i < loop.length; i++) {
        parts.push(`L ${loop[i][0]} ${loop[i][1]}`);
      }
      if (closed && loop.length > 2) parts.push("Z");
    }
  }
  return parts.join(" ");
}

/**
 * Control points (and curvature flag) for one segment.
 * Segment `i` runs from `points[i]` to `points[(i + 1) % n]` (wrap for closed).
 */
export function getSegmentControlPoints(
  points: [number, number][],
  handles: PathHandles,
  segmentIndex: number,
  _closed: boolean,
): { c1: [number, number]; c2: [number, number]; curved: boolean } {
  const n = points.length;
  if (n === 0) return { c1: [0, 0], c2: [0, 0], curved: false };
  const i = segmentIndex;
  const from = points[i];
  const to = points[(i + 1) % n];
  const out = handles?.[i]?.out;
  const inn = handles?.[(i + 1) % n]?.in;
  return { c1: out ?? from, c2: inn ?? to, curved: Boolean(out || inn) };
}

/** Midpoint of a segment at t = 0.5 (de Casteljau for curves). */
export function segmentMidpoint(
  points: [number, number][],
  handles: PathHandles,
  segmentIndex: number,
  closed: boolean,
): [number, number] {
  const n = points.length;
  if (n === 0) return [0, 0];
  const i = segmentIndex;
  const from = points[i];
  const to = points[(i + 1) % n];
  const { c1, c2, curved } = getSegmentControlPoints(points, handles, i, closed);
  if (!curved) return [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const a = lerp(from, c1, 0.5);
  const b = lerp(c1, c2, 0.5);
  const c = lerp(c2, to, 0.5);
  const d = lerp(a, b, 0.5);
  const e = lerp(b, c, 0.5);
  return lerp(d, e, 0.5);
}

/**
 * Split a segment at t = 0.5, inserting a new anchor at the midpoint.
 * Curved segments are split with de Casteljau so both halves keep the exact
 * curve shape; the new anchor is created as a smooth point with mirrored
 * handles. Straight segments get a plain corner anchor.
 */
export function splitSegment(
  points: [number, number][],
  handles: PathHandles,
  segmentIndex: number,
  closed: boolean,
): { points: [number, number][]; handles: PathHandles } {
  const n = points.length;
  if (n === 0) return { points: [...points], handles };
  const i = segmentIndex;
  const from = points[i];
  const to = points[(i + 1) % n];
  const { c1, c2, curved } = getSegmentControlPoints(points, handles, i, closed);

  const insertAt = i + 1;

  if (!curved) {
    // Straight segment: insert a plain corner anchor at the chord midpoint.
    const nextPoints = [...points];
    nextPoints.splice(insertAt, 0, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]);
    return { points: nextPoints, handles };
  }

  // de Casteljau subdivision at t = 0.5 — the inserted anchor sits on the curve.
  const a = lerp(from, c1, 0.5);
  const b = lerp(c1, c2, 0.5);
  const c = lerp(c2, to, 0.5);
  const d = lerp(a, b, 0.5);
  const e = lerp(b, c, 0.5);
  const mid = lerp(d, e, 0.5);

  const nextPoints = [...points];
  nextPoints.splice(insertAt, 0, mid);

  const out = handles?.[i]?.out;
  const inn = handles?.[(i + 1) % n]?.in;
  const nextHandles: PathVertexHandle[] = handles
    ? handles.map((h) => (h ? { ...h } : undefined))
    : new Array(points.length).fill(undefined);

  // Left half: outgoing handle of segment start is retracted to `a`.
  nextHandles[i] = { ...(nextHandles[i] ?? {}), ...(out ? { out: a } : {}) };
  // Right half: incoming handle of segment end is retracted to `c`.
  const endIndex = (i + 1) % n;
  nextHandles[endIndex] = {
    ...(nextHandles[endIndex] ?? {}),
    ...(inn ? { in: c } : {}),
  };
  // New anchor: mirrors the split point so both halves stay smooth.
  nextHandles.splice(insertAt, 0, { in: d, out: e, smooth: true });

  return { points: nextPoints, handles: nextHandles };
}

/**
 * Remove an anchor and its handles, reconnecting the adjacent segments.
 * Adjacent out/in handles (owned by the surviving anchors) naturally describe
 * the merged segment. No-op when 2 or fewer anchors remain.
 */
export function deleteVertex(
  points: [number, number][],
  handles: PathHandles,
  index: number,
): { points: [number, number][]; handles: PathHandles } {
  if (points.length <= 2) return { points: points.slice(), handles };
  if (index < 0 || index >= points.length) return { points: points.slice(), handles };
  const next = points.filter((_, i) => i !== index);
  const nextHandles = handles
    ? handles.filter((_, i) => i !== index)
    : undefined;
  return { points: next, handles: nextHandles };
}

/**
 * Toggle a vertex between corner and smooth.
 *
 * Corner → smooth: mirror an existing handle across the anchor; if the vertex
 * has no handles yet, synthesize a mirrored pair along the path direction.
 * Smooth → corner: keep handle positions but unlock the mirror constraint.
 */
export function toggleVertexSmooth(
  points: [number, number][],
  handles: PathHandles,
  index: number,
): PathHandles {
  if (index < 0 || index >= points.length) return handles;
  const anchor = points[index];
  const current = handles?.[index];
  const next: PathVertexHandle[] = handles
    ? handles.map((h) => (h ? { ...h } : undefined))
    : new Array(points.length).fill(undefined);

  if (current?.smooth) {
    next[index] = { in: current.in, out: current.out, smooth: false };
    return next;
  }

  let inn = current?.in;
  let out = current?.out;
  if (inn && !out) {
    out = mirrorPoint(inn, anchor);
  } else if (out && !inn) {
    inn = mirrorPoint(out, anchor);
  } else if (!inn && !out) {
    // No handles: synthesize a pair along the local path direction.
    const prev = points[(index - 1 + points.length) % points.length];
    const nextPt = points[(index + 1) % points.length];
    const dx = nextPt[0] - prev[0];
    const dy = nextPt[1] - prev[1];
    const len = Math.hypot(dx, dy) || 1;
    const dist = Math.min(len * 0.25, 40);
    const ux = dx / len;
    const uy = dy / len;
    out = [anchor[0] + ux * dist, anchor[1] + uy * dist];
    inn = [anchor[0] - ux * dist, anchor[1] - uy * dist];
  }
  next[index] = { in: inn, out, smooth: true };
  return next;
}

/**
 * Shift the handles attached to a vertex by (dx, dy) — used when dragging an
 * anchor so its control handles travel with it (Figma behavior).
 */
export function shiftVertexHandles(
  handles: PathHandles,
  index: number,
  dx: number,
  dy: number,
): PathHandles {
  if (!handles || !handles[index]) return handles;
  const next = handles.map((h) => (h ? { ...h } : undefined));
  const h = next[index];
  if (!h) return next;
  if (h.in) h.in = [h.in[0] + dx, h.in[1] + dy];
  if (h.out) h.out = [h.out[0] + dx, h.out[1] + dy];
  return next;
}

/**
 * Compute the bounding box of a set of points (min x/y, max x/y).
 * Mirrors computePathBounds in ElementsRenderer so path geometry transforms
 * can stay in this pure-utility module without a circular import.
 */
export function computePointsBounds(
  points: [number, number][],
): { x: number; y: number; width: number; height: number } {
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

/**
 * Translate every point (and optional handles + subpaths) by (dx, dy) and
 * recompute the bounding box. Path points are stored in absolute canvas
 * coordinates, so moving a path element requires shifting the points — not
 * just its x/y box.
 */
export function translatePoints(
  points: [number, number][],
  dx: number,
  dy: number,
  handles?: PathHandles,
  subpaths?: [number, number][][],
): {
  points: [number, number][];
  bounds: { x: number; y: number; width: number; height: number };
  handles: PathHandles;
  subpaths: [number, number][][];
} {
  const next = points.map(([px, py]) => [px + dx, py + dy] as [number, number]);
  const nextSubpaths = (subpaths ?? []).map((loop) =>
    loop.map(([px, py]) => [px + dx, py + dy] as [number, number]),
  );
  const nextHandles = handles?.map((h) =>
    h
      ? {
          in: h.in ? ([h.in[0] + dx, h.in[1] + dy] as [number, number]) : undefined,
          out: h.out ? ([h.out[0] + dx, h.out[1] + dy] as [number, number]) : undefined,
          smooth: h.smooth,
        }
      : undefined,
  );
  const all = [next, ...nextSubpaths];
  return {
    points: next,
    bounds: computePointsBounds(all.flat()),
    handles: nextHandles,
    subpaths: nextSubpaths,
  };
}

/**
 * Proportionally map every point (and optional handles) from an old bounding
 * box into a new one, then recompute the bounding box. Used when resizing a
 * path element: the box (x/y/width/height) alone is not enough, the absolute
 * points must be scaled to match. Zero-size dimensions map onto the new box's
 * origin edge.
 */
export function rescalePoints(
  points: [number, number][],
  oldBounds: { x: number; y: number; width: number; height: number },
  newBounds: { x: number; y: number; width: number; height: number },
  handles?: PathHandles,
  subpaths?: [number, number][][],
): {
  points: [number, number][];
  bounds: { x: number; y: number; width: number; height: number };
  handles: PathHandles;
  subpaths: [number, number][][];
} {
  const map = (p: [number, number]): [number, number] => {
    const nx =
      oldBounds.width > 0
        ? newBounds.x + ((p[0] - oldBounds.x) / oldBounds.width) * newBounds.width
        : newBounds.x;
    const ny =
      oldBounds.height > 0
        ? newBounds.y + ((p[1] - oldBounds.y) / oldBounds.height) * newBounds.height
        : newBounds.y;
    return [nx, ny];
  };
  const next = points.map(map);
  const nextSubpaths = (subpaths ?? []).map((loop) => loop.map(map));
  const nextHandles = handles?.map((h) =>
    h
      ? {
          in: h.in ? map(h.in) : undefined,
          out: h.out ? map(h.out) : undefined,
          smooth: h.smooth,
        }
      : undefined,
  );
  const all = [next, ...nextSubpaths];
  return {
    points: next,
    bounds: computePointsBounds(all.flat()),
    handles: nextHandles,
    subpaths: nextSubpaths,
  };
}

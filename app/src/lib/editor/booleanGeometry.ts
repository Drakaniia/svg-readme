/**
 * Polygon boolean operations — union / intersect / subtract / exclude.
 *
 * Implements the Greiner–Hormann clipping algorithm on simple (non
 * self-intersecting) polygons. Proper crossings are used: intersections that
 * land exactly on a vertex or on a coincident edge are ignored, so touching /
 * edge-sharing inputs produce no result (callers treat that as a no-op rather
 * than emitting a wrong shape).
 *
 * Pure module — no DOM/React dependencies, unit-tested directly.
 *
 * Reference: Greiner, Hormann — "Efficient clipping of arbitrary polygons"
 * (ACM TOG 1998). Open-pencil parity: packages/core/src/vector/regions.ts
 * operates on the same vector-region concept.
 */

export type Pt = [number, number];

export type BooleanOp = "union" | "intersect" | "subtract" | "exclude";

const EPS = 1e-9;

/** Signed area — positive = counter-clockwise winding. */
function signedArea(poly: Pt[]): number {
  let area = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % n];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

/** Normalize winding to counter-clockwise (GH assumes consistent orientation). */
function toCCW(poly: Pt[]): Pt[] {
  return signedArea(poly) >= 0 ? poly : poly.slice().reverse();
}

/** Cross product of (a-o) × (b-o). */
function cross(o: Pt, a: Pt, b: Pt): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/**
 * Segment-segment intersection — returns the crossing point for *proper*
 * crossings only (strictly interior to both segments). Returns null for
 * endpoint touches, collinear overlaps, and parallels, which keeps the
 * algorithm well-behaved.
 */
function segIntersect(a1: Pt, a2: Pt, b1: Pt, b2: Pt): Pt | null {
  const d1 = cross(b1, b2, a1);
  const d2 = cross(b1, b2, a2);
  const d3 = cross(a1, a2, b1);
  const d4 = cross(a1, a2, b2);
  const proper =
    ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) &&
    ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS));
  if (!proper) return null;
  const t = d1 / (d1 - d2); // parametric position along a1→a2
  return [a1[0] + t * (a2[0] - a1[0]), a1[1] + t * (a2[1] - a1[1])];
}

/** Ray-casting point-in-polygon test. */
function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersects =
      yi > p[1] !== yj > p[1] &&
      p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Distance along an edge for a point, measured on the dominant axis. */
function edgeAlpha(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx === 0 ? 0 : (p[0] - a[0]) / dx;
  }
  return dy === 0 ? 0 : (p[1] - a[1]) / dy;
}

// ─── Doubly-linked circular node ─────────────────────────────────────────────

interface GHNode {
  x: number;
  y: number;
  next: GHNode;
  prev: GHNode;
  /** True when this node is an inserted intersection. */
  isIntersection: boolean;
  /** Position along the original edge (for stable insertion order). */
  alpha?: number;
  /** Matching intersection node on the other polygon. */
  neighbor?: GHNode;
  /** Whether this intersection is an entry point on its own polygon. */
  entry?: boolean;
  processed?: boolean;
}

function makeNodes(poly: Pt[]): GHNode[] {
  const nodes: GHNode[] = poly.map(([x, y]) => ({
    x,
    y,
    next: null as unknown as GHNode,
    prev: null as unknown as GHNode,
    isIntersection: false,
  }));
  const n = nodes.length;
  for (let i = 0; i < n; i++) {
    nodes[i].next = nodes[(i + 1) % n];
    nodes[i].prev = nodes[(i - 1 + n) % n];
  }
  return nodes;
}

interface RawIntersection {
  point: Pt;
  alpha: number;
  aEdge: number;
  bEdge: number;
}

/**
 * Compute all proper crossings between polyA and polyB edges.
 * Returns per-edge intersection lists for both polygons.
 */
function findIntersections(
  polyA: Pt[],
  polyB: Pt[],
): { perEdgeA: RawIntersection[][]; perEdgeB: RawIntersection[][]; all: RawIntersection[] } {
  const perEdgeA = polyA.map(() => [] as RawIntersection[]);
  const perEdgeB = polyB.map(() => [] as RawIntersection[]);
  const all: RawIntersection[] = [];
  const nA = polyA.length;
  const nB = polyB.length;
  for (let i = 0; i < nA; i++) {
    const a1 = polyA[i];
    const a2 = polyA[(i + 1) % nA];
    for (let j = 0; j < nB; j++) {
      const b1 = polyB[j];
      const b2 = polyB[(j + 1) % nB];
      const point = segIntersect(a1, a2, b1, b2);
      if (!point) continue;
      const raw: RawIntersection = {
        point,
        alpha: edgeAlpha(point, a1, a2),
        aEdge: i,
        bEdge: j,
      };
      perEdgeA[i].push(raw);
      perEdgeB[j].push(raw);
      all.push(raw);
    }
  }
  for (const list of perEdgeA) list.sort((p, q) => p.alpha - q.alpha);
  for (const list of perEdgeB) list.sort((p, q) => p.alpha - q.alpha);
  return { perEdgeA, perEdgeB, all };
}

/** Splice intersection nodes into both node lists (sorted by alpha per edge). */
function insertIntersections(
  nodes: GHNode[],
  perEdge: RawIntersection[][],
): GHNode[] {
  for (let edge = 0; edge < nodes.length; edge++) {
    const raw = perEdge[edge];
    if (raw.length === 0) continue;
    let anchor = nodes[edge];
    for (const r of raw) {
      const node: GHNode = {
        x: r.point[0],
        y: r.point[1],
        next: null as unknown as GHNode,
        prev: null as unknown as GHNode,
        isIntersection: true,
        alpha: r.alpha,
      };
      node.next = anchor.next;
      node.prev = anchor;
      anchor.next.prev = node;
      anchor.next = node;
      anchor = node;
    }
  }
  return nodes;
}

/** Build the doubly-linked lists with intersections spliced in and neighbors linked. */
function buildClippedLists(
  polyA: Pt[],
  polyB: Pt[],
): { listA: GHNode[]; listB: GHNode[] } {
  const nodesA = makeNodes(polyA);
  const nodesB = makeNodes(polyB);
  const { perEdgeA, perEdgeB, all } = findIntersections(polyA, polyB);
  if (all.length === 0) return { listA: nodesA, listB: nodesB };

  insertIntersections(nodesA, perEdgeA);
  insertIntersections(nodesB, perEdgeB);

  // Link neighbors + classify entry/exit. Classification: the segment AFTER the
  // intersection (toward the next node) decides — if its midpoint lies inside
  // the other polygon, this polygon is entering it (entry), else exiting.
  for (const r of all) {
    const aNode = findNodeAt(nodesA, r.aEdge, r.alpha);
    const bNode = findNodeAt(nodesB, r.bEdge, r.alpha);
    if (!aNode || !bNode) continue;
    aNode.neighbor = bNode;
    bNode.neighbor = aNode;
    const aNext = aNode.next;
    const bNext = bNode.next;
    const aMid: Pt = [(aNode.x + aNext.x) / 2, (aNode.y + aNext.y) / 2];
    const bMid: Pt = [(bNode.x + bNext.x) / 2, (bNode.y + bNext.y) / 2];
    aNode.entry = pointInPolygon(aMid, polyB);
    bNode.entry = pointInPolygon(bMid, polyA);
  }
  return { listA: nodesA, listB: nodesB };
}

/**
 * Locate the intersection node on edge `edge` at parametric position `alpha`.
 * Intersections are inserted sorted by alpha, so the first node on that edge
 * whose alpha matches wins.
 */
function findNodeAt(
  nodes: GHNode[],
  edge: number,
  alpha: number,
): GHNode | undefined {
  let cur = nodes[edge];
  const startEdge = cur;
  // Walk the edge (until we return to the origin vertex), skipping the origin.
  let guard = 0;
  cur = cur.next;
  while (cur !== startEdge && guard++ < nodes.length * 2) {
    if (cur.isIntersection && Math.abs((cur.alpha ?? 0) - alpha) < 1e-6) {
      return cur;
    }
    cur = cur.next;
  }
  return undefined;
}

/**
 * Trace result loops from the clipped lists.
 *
 * Traversal rules (from Greiner–Hormann):
 * - union:     follow forward, switch to the other polygon at ENTRY points.
 * - intersect: follow forward, switch at EXIT points.
 * - subtract:  follow A forward, switch to B at A's ENTRY points and traverse
 *              B in reverse, switching back at B's ENTRY points.
 * - exclude:   follow forward, switch at EVERY intersection (entry and exit).
 */
function traceLoops(
  listA: GHNode[],
  listB: GHNode[],
  op: BooleanOp,
): Pt[][] {
  const results: Pt[][] = [];
  const maxSteps = (listA.length + listB.length) * 8 + 200;

  // Gather intersection start nodes by walking the linked list — intersection
  // nodes are spliced into the chain but not the backing array.
  const startNodes: GHNode[] = [];
  {
    const head = listA[0];
    let cur = head;
    let guard = 0;
    do {
      if (cur.isIntersection) startNodes.push(cur);
      cur = cur.next;
    } while (cur !== head && guard++ < listA.length * 8);
  }

  for (const start of startNodes) {
    if (start.processed) continue;

    const loop: Pt[] = [];
    let cur = start;
    let onA = true;
    let steps = 0;
    let closed = false;

    while (steps++ < maxSteps) {
      // Closing condition: returning to the start node (whether by advancing
      // or by switching onto it) completes the loop.
      if (loop.length > 0 && cur === start) {
        closed = true;
        break;
      }

      // Push the point (skip duplicates — e.g. switching onto a node that was
      // already emitted as an intersection coordinate).
      if (loop.length === 0) {
        loop.push([cur.x, cur.y]);
      } else {
        const last = loop[loop.length - 1];
        if (Math.hypot(last[0] - cur.x, last[1] - cur.y) > EPS) {
          loop.push([cur.x, cur.y]);
        }
      }

      if (cur.isIntersection) {
        cur.processed = true;
        if (cur.neighbor) cur.neighbor.processed = true;
        const isEntry = cur.entry === true;
        let shouldSwitch = false;
        if (op === "union") shouldSwitch = isEntry;
        else if (op === "intersect") shouldSwitch = !isEntry;
        else if (op === "subtract") shouldSwitch = isEntry; // B is traversed reversed
        else if (op === "exclude") shouldSwitch = true;

        if (shouldSwitch && cur.neighbor) {
          cur = cur.neighbor;
          onA = !onA;
          // A switch may land exactly on the start node (e.g. intersect traces
          // that close by returning via the other polygon).
          if (cur === start && loop.length > 0) {
            closed = true;
            break;
          }
        }
      }

      // Advance. On A always forward; on B forward for all ops except
      // subtract, where B is traversed in reverse.
      cur = onA || op !== "subtract" ? cur.next : cur.prev;
    }

    if (closed && loop.length >= 3) {
      // Drop a trailing point that duplicates the start.
      const first = loop[0];
      const last = loop[loop.length - 1];
      if (Math.hypot(last[0] - first[0], last[1] - first[1]) < EPS) loop.pop();
      if (loop.length >= 3) results.push(loop);
    }
  }

  return results;
}

/** Clean a loop: remove consecutive duplicate points (within epsilon). */
function cleanLoop(loop: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of loop) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > EPS) out.push(p);
  }
  if (out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) < EPS) out.pop();
  }
  return out;
}

/**
 * Boolean operation on two simple polygons.
 * Returns an array of result loops (first loop is the outer boundary, any
 * additional loops are holes / additional components with consistent winding
 * for the nonzero fill rule). Returns [] when there is no intersection and
 * the op cannot produce a result (e.g. intersect of disjoint shapes), and
 * null when the inputs are degenerate / the algorithm bails out.
 */
export function polygonBoolean(
  subject: Pt[],
  clip: Pt[],
  op: BooleanOp,
): Pt[][] | null {
  if (subject.length < 3 || clip.length < 3) return null;
  const A = toCCW(subject);
  const B = toCCW(clip);

  // Fast path: no crossings at all — pure containment or disjoint. Must check
  // EVERY vertex: with zero crossings the polygons are either fully disjoint,
  // fully nested, or share only tangential contact, so a single sample point
  // is not enough to decide containment.
  const allIn = (poly: Pt[], other: Pt[]): boolean =>
    poly.length > 0 && poly.every((p) => pointInPolygon(p, other));
  const { all } = findIntersections(A, B);
  if (all.length === 0) {
    const aInB = allIn(A, B);
    const bInA = allIn(B, A);
    if (op === "union") {
      // Disjoint (or one strictly inside the other) — union is the outer set.
      if (aInB) return [B];
      if (bInA) return [A];
      return null; // disjoint union can't be one path — caller keeps both
    }
    if (op === "intersect") {
      if (aInB) return [A];
      if (bInA) return [B];
      return []; // disjoint
    }
    if (op === "subtract") {
      if (aInB) return []; // A fully inside B — nothing left
      if (bInA) return [A, B.slice().reverse()]; // B inside A — frame (outer + CW hole)
      return [A]; // disjoint — nothing removed
    }
    if (op === "exclude") {
      if (aInB) return [B];
      if (bInA) return [A, B.slice().reverse()]; // A minus B keeps a hole
      return null; // disjoint — both stay
    }
  }

  const { listA, listB } = buildClippedLists(A, B);
  const loops = traceLoops(listA, listB, op);
  return loops.map(cleanLoop).filter((l) => l.length >= 3);
}

/**
 * SVG path `d` attribute parser.
 *
 * Converts the full path grammar (M/L/H/V/C/S/Q/T/A/Z, absolute + relative)
 * into the editor's vertex model: an array of anchor `points` plus a parallel
 * `handles` array of `PathVertexHandle` (see lib/editor/pathUtils.ts), so
 * imported curves stay editable (Figma-style bezier handles).
 *
 * Curves (C/S/Q/T) map to cubic handles on the shared vertex model:
 *   - C  → from.out = c1, to.in = c2
 *   - S  → reflect previous control across the start point, then C
 *   - Q  → quadratic → cubic conversion (exact)
 *   - T  → reflect previous quadratic control, then Q conversion
 *   - A  → arc → series of cubic segments (standard endpoint→center algorithm)
 */

import type { PathVertexHandle } from "../editor/pathUtils";

export interface ParsedSubpath {
  points: [number, number][];
  /** Parallel to points; may be undefined when the whole subpath is straight. */
  handles?: (PathVertexHandle | undefined)[];
  closed: boolean;
}

// ─── Tokenizer ───────────────────────────────────────────────────────────────

type Token = { kind: "cmd"; value: string } | { kind: "num"; value: number };

/** Tokenize a path `d` string into commands + numbers. */
function tokenize(d: string): Token[] {
  const tokens: Token[] = [];
  const re = /[a-zA-Z]|[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(d)) !== null) {
    const t = match[0];
    if (t.length === 1 && /[a-zA-Z]/.test(t)) {
      tokens.push({ kind: "cmd", value: t });
    } else {
      tokens.push({ kind: "num", value: parseFloat(t) });
    }
  }
  return tokens;
}

// ─── Arc → cubic conversion (SVG spec endpoint parameterization) ─────────────

interface CubicSeg {
  c1: [number, number];
  c2: [number, number];
  end: [number, number];
}

function arcToCubics(
  x0: number,
  y0: number,
  rx: number,
  ry: number,
  xAxisRot: number,
  largeArc: boolean,
  sweep: boolean,
  x1: number,
  y1: number,
): CubicSeg[] {
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  if (rx === 0 || ry === 0) {
    return [{ c1: [x1, y1], c2: [x1, y1], end: [x1, y1] }];
  }
  const phi = (xAxisRot * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // Step 1: compute (x1', y1')
  const dx = (x0 - x1) / 2;
  const dy = (y0 - y1) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  // Correct out-of-range radii
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }

  // Step 2: compute center'
  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const x1p2 = x1p * x1p;
  const y1p2 = y1p * y1p;
  let radicand = (rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2) / (rx2 * y1p2 + ry2 * x1p2);
  radicand = Math.max(0, radicand);
  const coef = (largeArc === sweep ? -1 : 1) * Math.sqrt(radicand);
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (coef * -ry * x1p) / rx;

  // Step 3: center in original coords
  const cx = cosPhi * cxp - sinPhi * cyp + (x0 + x1) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y0 + y1) / 2;

  // Step 4: start/end angles
  const ux = (x1p - cxp) / rx;
  const uy = (y1p - cyp) / ry;
  const vx = (-x1p - cxp) / rx;
  const vy = (-y1p - cyp) / ry;
  const theta1 = Math.atan2(uy, ux);
  let dTheta = Math.atan2(vy, vx) - theta1;
  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  else if (sweep && dTheta < 0) dTheta += 2 * Math.PI;

  // Split into ≤90° segments
  const segments = Math.max(1, Math.ceil(Math.abs(dTheta) / (Math.PI / 2)));
  const delta = dTheta / segments;
  const result: CubicSeg[] = [];
  const k = (4 / 3) * Math.tan(delta / 4);

  let theta = theta1;
  for (let i = 0; i < segments; i++) {
    const thetaEnd = theta + delta;
    // Control points in ellipse frame
    const c1x = cx + rx * Math.cos(theta) - k * rx * Math.sin(theta);
    const c1y = cy + ry * Math.sin(theta) + k * ry * Math.cos(theta);
    const c2x = cx + rx * Math.cos(thetaEnd) + k * rx * Math.sin(thetaEnd);
    const c2y = cy + ry * Math.sin(thetaEnd) - k * ry * Math.cos(thetaEnd);
    const ex = cx + rx * Math.cos(thetaEnd);
    const ey = cy + ry * Math.sin(thetaEnd);
    // Rotate back by phi
    result.push({
      c1: [cosPhi * c1x - sinPhi * c1y, sinPhi * c1x + cosPhi * c1y],
      c2: [cosPhi * c2x - sinPhi * c2y, sinPhi * c2x + cosPhi * c2y],
      end: [cosPhi * ex - sinPhi * ey, sinPhi * ex + cosPhi * ey],
    });
    theta = thetaEnd;
  }
  // Edge case: degenerate arc (start === end) produces a zero-length segment
  if (result.length === 0) {
    result.push({ c1: [x1, y1], c2: [x1, y1], end: [x1, y1] });
  }
  return result;
}

// ─── Main parser ─────────────────────────────────────────────────────────────

interface BuildState {
  points: [number, number][];
  handles: (PathVertexHandle | undefined)[];
  closed: boolean;
  /** Current pen position (absolute). */
  cur: [number, number];
  /** Start of the current subpath (absolute) — for relative Z. */
  subpathStart: [number, number];
  /** Last quadratic control point (absolute) — for T. */
  lastQControl: [number, number] | null;
  /** Last cubic control point (absolute) — for S. */
  lastCControl: [number, number] | null;
  /** Whether the previous segment was a curve (affects S/T reflection). */
  lastWasCurve: boolean;
}

function newState(): BuildState {
  return {
    points: [],
    handles: [],
    closed: false,
    cur: [0, 0],
    subpathStart: [0, 0],
    lastQControl: null,
    lastCControl: null,
    lastWasCurve: false,
  };
}

function addVertex(state: BuildState, p: [number, number], handle?: PathVertexHandle) {
  state.points.push(p);
  state.handles.push(handle);
  state.cur = p;
}

function addCurvedSegment(
  state: BuildState,
  end: [number, number],
  c1: [number, number],
  c2: [number, number],
  smooth: boolean,
) {
  const fromIndex = state.points.length - 1;
  // Attach outgoing handle to the current anchor (from)
  const fromHandle: PathVertexHandle = { ...(state.handles[fromIndex] ?? {}) };
  fromHandle.out = c1;
  if (smooth) fromHandle.smooth = true;
  state.handles[fromIndex] = fromHandle;
  // Push the end anchor with its incoming handle
  const toHandle: PathVertexHandle = { in: c2, ...(smooth ? { smooth: true } : {}) };
  addVertex(state, end, toHandle);
  state.lastCControl = c2;
  // Per SVG spec, a T following a cubic/arc uses the current point as its
  // quadratic control (no reflection), so clear the quadratic control here.
  // Q/T set it explicitly after calling this helper.
  state.lastQControl = null;
  state.lastWasCurve = true;
}

function addLine(state: BuildState, end: [number, number]) {
  addVertex(state, end);
  state.lastWasCurve = false;
  state.lastQControl = null;
  state.lastCControl = null;
}

/**
 * Parse a path `d` attribute into subpaths.
 * Returns an array (one entry per `M` subpath).
 */
export function parsePathD(d: string): ParsedSubpath[] {
  if (!d) return [];
  const tokens = tokenize(d);
  const subpaths: ParsedSubpath[] = [];
  let state = newState();
  let i = 0;
  let cmd = "M"; // SVG: path must begin with moveto

  const readNumber = (): number | null => {
    if (i < tokens.length && tokens[i].kind === "num") {
      return (tokens[i++] as { value: number }).value;
    }
    return null;
  };

  const readFlag = (): boolean => {
    if (i < tokens.length && tokens[i].kind === "num") {
      const v = (tokens[i++] as { value: number }).value;
      return v !== 0;
    }
    return false;
  };

  const readPair = (): [number, number] | null => {
    const x = readNumber();
    const y = readNumber();
    if (x === null || y === null) return null;
    return [x, y];
  };

  const flush = () => {
    if (state.points.length >= 2) {
      // Only emit handles when at least one vertex actually carries a control point
      const hasHandles = state.handles.some(
        (h) => h && (h.in || h.out),
      );
      subpaths.push({
        points: state.points,
        handles: hasHandles ? state.handles : undefined,
        closed: state.closed,
      });
    }
  };

  const finishSubpath = () => {
    flush();
    state = newState();
  };

  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok.kind === "cmd") {
      cmd = tok.value;
      i++;
    }

    const isRelative = cmd === cmd.toLowerCase() && cmd !== "z";
    const absCmd = cmd.toUpperCase();

    switch (absCmd) {
      case "M": {
        let p = readPair();
        if (!p) break;
        // Absolute: first point moves the pen; subsequent pairs are implicit L
        if (!isRelative) {
          if (state.points.length > 0) {
            finishSubpath();
            // Reset handles/curve memory for the new subpath
            state.subpathStart = [0, 0];
            state.lastQControl = null;
            state.lastCControl = null;
          }
          state.cur = [p[0], p[1]];
          state.subpathStart = [p[0], p[1]];
          addVertex(state, p);
        } else {
          // Relative moveto
          const np: [number, number] = [state.cur[0] + p[0], state.cur[1] + p[1]];
          if (state.points.length > 0) {
            finishSubpath();
            state.cur = [0, 0];
            state.subpathStart = [0, 0];
            state.lastQControl = null;
            state.lastCControl = null;
          }
          state.cur = np;
          state.subpathStart = np;
          addVertex(state, np);
        }
        state.lastWasCurve = false;
        state.lastQControl = null;
        state.lastCControl = null;
        // Implicit lineto pairs
        while ((p = readPair()) !== null) {
          const np: [number, number] = isRelative
            ? [state.cur[0] + p[0], state.cur[1] + p[1]]
            : p;
          addLine(state, np);
        }
        break;
      }
      case "L": {
        let p = readPair();
        while (p !== null) {
          const np: [number, number] = isRelative
            ? [state.cur[0] + p[0], state.cur[1] + p[1]]
            : p;
          addLine(state, np);
          p = readPair();
        }
        break;
      }
      case "H": {
        let x = readNumber();
        while (x !== null) {
          const np: [number, number] = isRelative
            ? [state.cur[0] + x, state.cur[1]]
            : [x, state.cur[1]];
          addLine(state, np);
          x = readNumber();
        }
        break;
      }
      case "V": {
        let y = readNumber();
        while (y !== null) {
          const np: [number, number] = isRelative
            ? [state.cur[0], state.cur[1] + y]
            : [state.cur[0], y];
          addLine(state, np);
          y = readNumber();
        }
        break;
      }
      case "C": {
        // c1 c2 end (three pairs); repeatable
        for (;;) {
          const c1 = readPair();
          const c2 = readPair();
          const end = readPair();
          if (!c1 || !c2 || !end) break;
          const rc1: [number, number] = isRelative
            ? [state.cur[0] + c1[0], state.cur[1] + c1[1]]
            : c1;
          const rc2: [number, number] = isRelative
            ? [state.cur[0] + c2[0], state.cur[1] + c2[1]]
            : c2;
          const rend: [number, number] = isRelative
            ? [state.cur[0] + end[0], state.cur[1] + end[1]]
            : end;
          addCurvedSegment(state, rend, rc1, rc2, false);
        }
        break;
      }
      case "S": {
        for (;;) {
          const c2 = readPair();
          const end = readPair();
          if (!c2 || !end) break;
          // First control = reflection of previous c2 across the start point
          const start = state.cur;
          const prev = state.lastCControl ?? start;
          const c1: [number, number] = [
            2 * start[0] - prev[0],
            2 * start[1] - prev[1],
          ];
          const rc2: [number, number] = isRelative
            ? [state.cur[0] + c2[0], state.cur[1] + c2[1]]
            : c2;
          const rend: [number, number] = isRelative
            ? [state.cur[0] + end[0], state.cur[1] + end[1]]
            : end;
          addCurvedSegment(state, rend, c1, rc2, true);
        }
        break;
      }
      case "Q": {
        for (;;) {
          const q = readPair();
          const end = readPair();
          if (!q || !end) break;
          const rq: [number, number] = isRelative
            ? [state.cur[0] + q[0], state.cur[1] + q[1]]
            : q;
          const rend: [number, number] = isRelative
            ? [state.cur[0] + end[0], state.cur[1] + end[1]]
            : end;
          const start = state.cur;
          // Quadratic → cubic (exact): c1 = p0 + 2/3(q - p0), c2 = p1 + 2/3(q - p1)
          const c1: [number, number] = [
            start[0] + (2 / 3) * (rq[0] - start[0]),
            start[1] + (2 / 3) * (rq[1] - start[1]),
          ];
          const c2: [number, number] = [
            rend[0] + (2 / 3) * (rq[0] - rend[0]),
            rend[1] + (2 / 3) * (rq[1] - rend[1]),
          ];
          addCurvedSegment(state, rend, c1, c2, false);
          state.lastQControl = rq;
        }
        break;
      }
      case "T": {
        for (;;) {
          const end = readPair();
          if (!end) break;
          const rend: [number, number] = isRelative
            ? [state.cur[0] + end[0], state.cur[1] + end[1]]
            : end;
          const start = state.cur;
          const prevQ = state.lastQControl ?? start;
          // Reflect previous Q control across start
          const rq: [number, number] = [
            2 * start[0] - prevQ[0],
            2 * start[1] - prevQ[1],
          ];
          const c1: [number, number] = [
            start[0] + (2 / 3) * (rq[0] - start[0]),
            start[1] + (2 / 3) * (rq[1] - start[1]),
          ];
          const c2: [number, number] = [
            rend[0] + (2 / 3) * (rq[0] - rend[0]),
            rend[1] + (2 / 3) * (rq[1] - rend[1]),
          ];
          addCurvedSegment(state, rend, c1, c2, true);
          state.lastQControl = rq;
        }
        break;
      }
      case "A": {
        for (;;) {
          const rx = readNumber();
          const ry = readNumber();
          const rot = readNumber();
          if (rx === null || ry === null || rot === null) break;
          const largeArc = readFlag();
          const sweep = readFlag();
          const end = readPair();
          if (!end) break;
          const rend: [number, number] = isRelative
            ? [state.cur[0] + end[0], state.cur[1] + end[1]]
            : end;
          const start = state.cur;
          const cubics = arcToCubics(
            start[0],
            start[1],
            rx,
            ry,
            rot,
            largeArc,
            sweep,
            rend[0],
            rend[1],
          );
          for (const seg of cubics) {
            addCurvedSegment(state, seg.end, seg.c1, seg.c2, false);
          }
          state.lastWasCurve = true;
        }
        break;
      }
      case "Z": {
        state.closed = true;
        // Return the pen to the subpath start (closed path)
        state.cur = state.subpathStart;
        state.lastWasCurve = false;
        state.lastQControl = null;
        state.lastCControl = null;
        finishSubpath();
        break;
      }
      default:
        // Unknown command — skip to next command token
        while (i < tokens.length && tokens[i].kind === "num") i++;
        break;
    }
  }

  flush();
  return subpaths;
}

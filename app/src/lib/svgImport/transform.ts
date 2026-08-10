/**
 * SVG transform parsing + matrix helpers for the SVG importer.
 *
 * SVG `transform` attributes compose as matrix multiplication with the
 * rightmost function applied to points first (SVG spec §7.6). We parse the
 * attribute into a single affine matrix, then either:
 *   - bake it into point arrays directly (paths), or
 *   - decompose it into translate/scale/rotation/skew so shapes can keep their
 *     kind and store rotation in the editor's `rotation` property.
 */

export interface TransformMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export const IDENTITY_MATRIX: TransformMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** Multiply m1·m2 (m2 applied to points first). */
export function multiplyMatrices(m1: TransformMatrix, m2: TransformMatrix): TransformMatrix {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    e: m1.a * m2.e + m1.c * m2.f + m1.e,
    f: m1.b * m2.e + m1.d * m2.f + m1.f,
  };
}

/** Apply a matrix to a point (column-vector convention). */
export function applyMatrixToPoint(
  m: TransformMatrix,
  [x, y]: [number, number],
): [number, number] {
  return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
}

export function isIdentity(m: TransformMatrix): boolean {
  const EPS = 1e-9;
  return (
    Math.abs(m.a - 1) < EPS &&
    Math.abs(m.b) < EPS &&
    Math.abs(m.c) < EPS &&
    Math.abs(m.d - 1) < EPS &&
    Math.abs(m.e) < EPS &&
    Math.abs(m.f) < EPS
  );
}

const DEG = Math.PI / 180;

/** Parse a single transform function's argument list. */
function parseArgs(inner: string): number[] {
  const nums = inner
    .split(/[\s,]+/)
    .filter((s) => s.length > 0)
    .map((s) => parseFloat(s));
  return nums.filter((n) => !isNaN(n));
}

const FN_RE = /([a-zA-Z]+)\s*\(([^)]*)\)/g;

/**
 * Parse an SVG transform attribute value into a matrix.
 * Order semantics: functions compose left-to-right as matrix products
 * (rightmost is applied to points first — matches the SVG spec).
 */
export function parseTransform(attr: string | null | undefined): TransformMatrix {
  if (!attr) return IDENTITY_MATRIX;
  let result = IDENTITY_MATRIX;
  let match: RegExpExecArray | null;
  FN_RE.lastIndex = 0;
  while ((match = FN_RE.exec(attr)) !== null) {
    const fn = match[1].toLowerCase();
    const args = parseArgs(match[2]);
    let m: TransformMatrix;
    switch (fn) {
      case "translate": {
        const tx = args[0] ?? 0;
        const ty = args[1] ?? 0;
        m = { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty };
        break;
      }
      case "scale": {
        const sx = args[0] ?? 1;
        const sy = args[1] ?? sx;
        m = { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 };
        break;
      }
      case "rotate": {
        const angle = args[0] ?? 0;
        const rad = angle * DEG;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rot: TransformMatrix = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
        if (args.length >= 3 && (args[1] !== 0 || args[2] !== 0)) {
          const cx = args[1];
          const cy = args[2];
          // rotate(a, cx, cy) = translate(cx,cy) · rotate(a) · translate(-cx,-cy)
          const tIn: TransformMatrix = { a: 1, b: 0, c: 0, d: 1, e: -cx, f: -cy };
          const tOut: TransformMatrix = { a: 1, b: 0, c: 0, d: 1, e: cx, f: cy };
          m = multiplyMatrices(tOut, multiplyMatrices(rot, tIn));
        } else {
          m = rot;
        }
        break;
      }
      case "skewx": {
        const rad = (args[0] ?? 0) * DEG;
        const tan = Math.tan(rad);
        m = { a: 1, b: 0, c: tan, d: 1, e: 0, f: 0 };
        break;
      }
      case "skewy": {
        const rad = (args[0] ?? 0) * DEG;
        const tan = Math.tan(rad);
        m = { a: 1, b: tan, c: 0, d: 1, e: 0, f: 0 };
        break;
      }
      case "matrix": {
        m = {
          a: args[0] ?? 1,
          b: args[1] ?? 0,
          c: args[2] ?? 0,
          d: args[3] ?? 1,
          e: args[4] ?? 0,
          f: args[5] ?? 0,
        };
        break;
      }
      default:
        m = IDENTITY_MATRIX;
    }
    result = multiplyMatrices(result, m);
  }
  return result;
}

export interface MatrixDecomposition {
  translateX: number;
  translateY: number;
  scaleX: number;
  scaleY: number;
  rotationDeg: number;
  /** Shear angle in degrees; 0 when the matrix is a pure translate·rotate·scale. */
  skewDeg: number;
}

/**
 * Decompose a 2D affine matrix into translate / rotate / scale / skew.
 * Columns are orthogonal when the matrix is pure T·R·S, so the dot product
 * of the two basis vectors measures the shear.
 */
export function decomposeMatrix(m: TransformMatrix): MatrixDecomposition {
  const { a, b, c, d, e, f } = m;
  const scaleX = Math.sqrt(a * a + b * b);
  const rotationDeg = (Math.atan2(b, a) * 180) / Math.PI;
  const det = a * d - b * c;
  const scaleY = scaleX === 0 ? Math.sqrt(c * c + d * d) : det / scaleX;
  // For T·R·S matrices the basis vectors are orthogonal: a*c + b*d = 0.
  const skewRad = Math.atan2(a * c + b * d, det);
  return {
    translateX: e,
    translateY: f,
    scaleX,
    scaleY,
    rotationDeg,
    skewDeg: (skewRad * 180) / Math.PI,
  };
}

/** Whether a matrix contains meaningful shear (cannot be a plain rotated box). */
export function hasSkew(m: TransformMatrix): boolean {
  const d = decomposeMatrix(m);
  return Math.abs(d.skewDeg) > 1e-6;
}

export interface BakedBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/**
 * Bake a translate/rotate/scale matrix into a shape box (x, y, w, h) that the
 * editor can render with its center-based `rotation` property.
 * Returns null when the matrix contains shear (caller should convert to path).
 */
export function bakeBoxTransform(
  m: TransformMatrix,
  box: { x: number; y: number; width: number; height: number },
): BakedBox | null {
  if (hasSkew(m)) return null;
  const d = decomposeMatrix(m);
  const center = applyMatrixToPoint(m, [
    box.x + box.width / 2,
    box.y + box.height / 2,
  ]);
  const newW = box.width * Math.abs(d.scaleX);
  const newH = box.height * Math.abs(d.scaleY);
  return {
    x: center[0] - newW / 2,
    y: center[1] - newH / 2,
    width: newW,
    height: newH,
    rotation: d.rotationDeg,
  };
}

/**
 * Apply a matrix to a box, returning the exact axis-aligned bounding box of the
 * transformed corners. Used for shapes that must be flattened to paths.
 */
export function boxToPoints(box: { x: number; y: number; width: number; height: number }): [number, number][] {
  const { x, y, width, height } = box;
  return [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ];
}

/** Transform a set of points by a matrix. */
export function transformPoints(m: TransformMatrix, points: [number, number][]): [number, number][] {
  return points.map((p) => applyMatrixToPoint(m, p));
}

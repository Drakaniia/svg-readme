/**
 * Ramer–Douglas–Peucker algorithm for simplifying a polyline.
 *
 * Reduces the number of points in a path while preserving its general shape
 * within a given epsilon (perpendicular distance) tolerance.
 *
 * @param points  Array of [x, y] points.
 * @param epsilon Maximum perpendicular distance allowed between the original
 *                curve and the simplified curve. Higher = more aggressive
 *                simplification. Default 1.5.
 * @returns A new simplified array of [x, y] points.
 */
export function simplifyPath(
  points: [number, number][],
  epsilon: number = 1.5,
): [number, number][] {
  if (points.length <= 2) return points.slice();

  // Find the point with the maximum perpendicular distance from the line
  // between the first and last points.
  let maxDist = 0;
  let maxIndex = 0;
  const first = points[0];
  const last = points[points.length - 1];

  const dx = last[0] - first[0];
  const dy = last[1] - first[1];
  const lineLengthSq = dx * dx + dy * dy;

  for (let i = 1; i < points.length - 1; i++) {
    const dist = lineLengthSq === 0
      ? pointDistance(first, points[i])
      : perpendicularDistance(points[i], first, last, lineLengthSq);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDist > epsilon) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), epsilon);
    const right = simplifyPath(points.slice(maxIndex), epsilon);
    // Merge, avoiding duplicate at the split point
    return left.slice(0, -1).concat(right);
  }

  // Keep only the endpoints
  return [first, last];
}

/** Euclidean distance between two points. */
function pointDistance(a: [number, number], b: [number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/** Perpendicular distance from point p to line segment a-b. */
function perpendicularDistance(
  p: [number, number],
  a: [number, number],
  b: [number, number],
  lineLengthSq: number,
): number {
  // Area of triangle formed by a, b, p
  const area = Math.abs(
    (b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1]),
  );
  return area / Math.sqrt(lineLengthSq);
}

import type { PathGeometry } from "@crc/core";
export interface InkBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
/** Curve extrema, not control-point bounds. One linear traversal; no flattening. */
export function inkBounds(path: PathGeometry): Readonly<InkBounds> | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let x = 0,
    y = 0,
    startX = 0,
    startY = 0;
  const include = (a: number, b: number) => {
    minX = Math.min(minX, a);
    maxX = Math.max(maxX, a);
    minY = Math.min(minY, b);
    maxY = Math.max(maxY, b);
  };
  const cubicRoots = (p0: number, p1: number, p2: number, p3: number) => {
    // Normalize first to keep coefficient arithmetic finite for large coordinates.
    const scale = Math.max(
      Math.abs(p0),
      Math.abs(p1),
      Math.abs(p2),
      Math.abs(p3),
      1,
    );
    p0 /= scale;
    p1 /= scale;
    p2 /= scale;
    p3 /= scale;
    const a = -p0 + 3 * p1 - 3 * p2 + p3;
    const b = 2 * (p0 - 2 * p1 + p2),
      c = p1 - p0;
    if (a === 0) return b === 0 ? [] : [-c / b];
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return [];
    const q = -0.5 * (b + (b < 0 ? -1 : 1) * Math.sqrt(discriminant));
    return q === 0 ? [-b / (2 * a)] : [q / a, c / q];
  };
  const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;
  const quadratic = (a: number, b: number, c: number, t: number) =>
    lerp(lerp(a, b, t), lerp(b, c, t), t);
  const cubic = (a: number, b: number, c: number, d: number, t: number) =>
    lerp(quadratic(a, b, c, t), quadratic(b, c, d, t), t);
  for (const segment of path) {
    if (segment.type === "move") {
      x = startX = segment.x;
      y = startY = segment.y;
      continue;
    }
    if (segment.type === "close") {
      if (x !== startX || y !== startY) {
        include(x, y);
        include(startX, startY);
      }
      x = startX;
      y = startY;
      continue;
    }
    if (segment.type === "arc")
      throw new Error("Font outlines cannot contain analytic arc commands.");
    include(x, y);
    include(segment.x, segment.y);
    if (segment.type === "quadratic") {
      const root = (a: number, b: number, c: number) => {
        const scale = Math.max(Math.abs(a), Math.abs(b), Math.abs(c), 1);
        a /= scale;
        b /= scale;
        c /= scale;
        return (a - b) / (a - 2 * b + c);
      };
      for (const t of [
        root(x, segment.cpx, segment.x),
        root(y, segment.cpy, segment.y),
      ]) {
        if (t > 0 && t < 1)
          include(
            quadratic(x, segment.cpx, segment.x, t),
            quadratic(y, segment.cpy, segment.y, t),
          );
      }
    } else if (segment.type === "cubic") {
      for (const t of [
        ...cubicRoots(x, segment.cp1x, segment.cp2x, segment.x),
        ...cubicRoots(y, segment.cp1y, segment.cp2y, segment.y),
      ]) {
        if (t > 0 && t < 1)
          include(
            cubic(x, segment.cp1x, segment.cp2x, segment.x, t),
            cubic(y, segment.cp1y, segment.cp2y, segment.y, t),
          );
      }
    }
    x = segment.x;
    y = segment.y;
  }
  if (minX === Infinity) return null;
  const result = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  if (!Object.values(result).every(Number.isFinite))
    throw new RangeError("Outline bounds overflow.");
  return Object.freeze(result);
}

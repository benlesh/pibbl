import type { CRCPhysicsVector3 } from "../../3d-geometry.js";

export interface CanonicalHull3D {
  readonly vertices: Float64Array;
  readonly faces: Uint32Array;
}

interface Face3D {
  a: number;
  b: number;
  c: number;
}

export function buildCanonicalHull3D(
  input: readonly CRCPhysicsVector3[],
): CanonicalHull3D {
  const points = canonicalPoints(input);
  const tolerance = hullVolumeTolerance(points);
  const seed = seedTetrahedron(points, tolerance);
  if (seed === null) {
    throw new RangeError("convex hull points must span a nonzero volume.");
  }
  const interior = new Float64Array(3);
  for (const index of seed) {
    interior[0] += points[index]![0]! / 4;
    interior[1] += points[index]![1]! / 4;
    interior[2] += points[index]![2]! / 4;
  }
  let faces = [
    outwardFace(seed[0], seed[1], seed[2], points, interior),
    outwardFace(seed[0], seed[3], seed[1], points, interior),
    outwardFace(seed[0], seed[2], seed[3], points, interior),
    outwardFace(seed[1], seed[3], seed[2], points, interior),
  ];
  const seeded = new Set(seed);
  for (let point = 0; point < points.length; point += 1) {
    if (seeded.has(point)) continue;
    const visible = faces
      .map((face, index) => ({ face, index }))
      .filter(
        ({ face }) =>
          signedFaceDistance(face, points, points[point]!) > tolerance,
      );
    if (visible.length === 0) continue;
    const visibleIds = new Set(visible.map(({ index }) => index));
    const edges = new Map<string, readonly [number, number]>();
    for (const { face } of visible) {
      for (const edge of [
        [face.a, face.b],
        [face.b, face.c],
        [face.c, face.a],
      ] as const) {
        const key =
          edge[0] < edge[1] ? `${edge[0]},${edge[1]}` : `${edge[1]},${edge[0]}`;
        if (edges.has(key)) edges.delete(key);
        else edges.set(key, edge);
      }
    }
    faces = faces.filter((_, index) => !visibleIds.has(index));
    const horizon = [...edges.values()].sort(
      (left, right) =>
        Math.min(...left) - Math.min(...right) ||
        Math.max(...left) - Math.max(...right),
    );
    for (const [a, b] of horizon) {
      faces.push(outwardFace(a, b, point, points, interior));
    }
  }

  const used = [
    ...new Set(faces.flatMap((face) => [face.a, face.b, face.c])),
  ].sort((left, right) => comparePoint(points[left]!, points[right]!));
  const remap = new Map(used.map((oldIndex, index) => [oldIndex, index]));
  const vertices = new Float64Array(used.length * 3);
  used.forEach((oldIndex, index) => vertices.set(points[oldIndex]!, index * 3));
  const canonicalFaces = faces
    .map((face) =>
      canonicalFace(remap.get(face.a)!, remap.get(face.b)!, remap.get(face.c)!),
    )
    .sort(compareFace);
  const uniqueFaces = canonicalFaces.filter(
    (face, index) =>
      index === 0 || compareFace(face, canonicalFaces[index - 1]!) !== 0,
  );
  return Object.freeze({
    vertices,
    faces: Uint32Array.from(uniqueFaces.flat()),
  });
}

function canonicalPoints(input: readonly CRCPhysicsVector3[]): Float64Array[] {
  if (input.length < 4)
    throw new RangeError("convex hull requires at least four points.");
  const points = input
    .map((point, index) => {
      const result = new Float64Array(3);
      for (let axis = 0; axis < 3; axis += 1) {
        const value = point[axis];
        if (!Number.isFinite(value))
          throw new TypeError(
            `convexHull.points[${index}][${axis}] must be finite.`,
          );
        result[axis] = value === 0 ? 0 : value!;
      }
      return result;
    })
    .sort(comparePoint);
  const unique = points.filter(
    (point, index) => index === 0 || !samePoint(point, points[index - 1]!),
  );
  if (unique.length < 4)
    throw new RangeError("convex hull requires at least four distinct points.");
  return unique;
}

function seedTetrahedron(
  points: readonly Float64Array[],
  tolerance: number,
): readonly [number, number, number, number] | null {
  for (let a = 0; a < points.length - 3; a += 1)
    for (let b = a + 1; b < points.length - 2; b += 1)
      for (let c = b + 1; c < points.length - 1; c += 1)
        for (let d = c + 1; d < points.length; d += 1)
          if (
            Math.abs(volume6(points[a]!, points[b]!, points[c]!, points[d]!)) >
            tolerance
          )
            return [a, b, c, d];
  return null;
}

function outwardFace(
  a: number,
  b: number,
  c: number,
  points: readonly Float64Array[],
  interior: Float64Array,
): Face3D {
  const face = { a, b, c };
  return signedFaceDistance(face, points, interior) > 0
    ? { a, b: c, c: b }
    : face;
}

function signedFaceDistance(
  face: Face3D,
  points: readonly Float64Array[],
  point: ArrayLike<number>,
): number {
  return volume6(points[face.a]!, points[face.b]!, points[face.c]!, point);
}

function volume6(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  c: ArrayLike<number>,
  d: ArrayLike<number>,
): number {
  const abx = b[0]! - a[0]!;
  const aby = b[1]! - a[1]!;
  const abz = b[2]! - a[2]!;
  const acx = c[0]! - a[0]!;
  const acy = c[1]! - a[1]!;
  const acz = c[2]! - a[2]!;
  return (
    (aby * acz - abz * acy) * (d[0]! - a[0]!) +
    (abz * acx - abx * acz) * (d[1]! - a[1]!) +
    (abx * acy - aby * acx) * (d[2]! - a[2]!)
  );
}

function canonicalFace(
  a: number,
  b: number,
  c: number,
): readonly [number, number, number] {
  if (b < a && b < c) return [b, c, a];
  if (c < a && c < b) return [c, a, b];
  return [a, b, c];
}

function compareFace(
  left: readonly number[],
  right: readonly number[],
): number {
  return left[0]! - right[0]! || left[1]! - right[1]! || left[2]! - right[2]!;
}

function comparePoint(
  left: ArrayLike<number>,
  right: ArrayLike<number>,
): number {
  return left[0]! - right[0]! || left[1]! - right[1]! || left[2]! - right[2]!;
}

function samePoint(left: ArrayLike<number>, right: ArrayLike<number>): boolean {
  return left[0] === right[0] && left[1] === right[1] && left[2] === right[2];
}

function hullVolumeTolerance(points: readonly Float64Array[]): number {
  let scale = 0;
  for (let axis = 0; axis < 3; axis += 1) {
    let minimum = Number.POSITIVE_INFINITY;
    let maximum = Number.NEGATIVE_INFINITY;
    for (const point of points) {
      minimum = Math.min(minimum, point[axis]!);
      maximum = Math.max(maximum, point[axis]!);
    }
    scale = Math.max(scale, maximum - minimum);
  }
  return scale ** 3 * Number.EPSILON * 64;
}

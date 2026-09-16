import {
  GEOMETRY_EPSILON_3D,
  MAX_EPA_ITERATIONS_3D,
} from "../numeric-policy.js";
import {
  supportMinkowski3D,
  type MinkowskiVertex3D,
  type PreparedConvexShape3D,
} from "./support.js";

interface EpaPenetrationResult3D {
  readonly status: "penetrating";
  readonly separation: number;
  readonly firstX: number;
  readonly firstY: number;
  readonly firstZ: number;
  readonly secondX: number;
  readonly secondY: number;
  readonly secondZ: number;
  readonly normalX: number;
  readonly normalY: number;
  readonly normalZ: number;
  readonly firstFeature: number;
  readonly secondFeature: number;
}

interface EpaFailureResult3D {
  readonly status: "failed";
  readonly reason: "iteration-limit" | "nonfinite" | "no-progress" | "invalid-simplex";
}

export type EpaResult3D = EpaPenetrationResult3D | EpaFailureResult3D;

interface Face3D {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly normalX: number;
  readonly normalY: number;
  readonly normalZ: number;
  readonly distance: number;
}

const SUPPORT_GAP_TOLERANCE = Math.sqrt(GEOMETRY_EPSILON_3D);

export function epaConvexShapes3D(
  first: PreparedConvexShape3D,
  second: PreparedConvexShape3D,
  simplex: readonly MinkowskiVertex3D[],
  iterationLimit = MAX_EPA_ITERATIONS_3D,
): EpaResult3D {
  if (simplex.length !== 4) return { status: "failed", reason: "invalid-simplex" };
  if (iterationLimit <= 0) return { status: "failed", reason: "iteration-limit" };
  const vertices = [...simplex];
  let faces = [
    createFace(vertices, 0, 1, 2),
    createFace(vertices, 0, 3, 1),
    createFace(vertices, 0, 2, 3),
    createFace(vertices, 1, 3, 2),
  ].filter((face): face is Face3D => face !== null);
  if (faces.length !== 4) return { status: "failed", reason: "invalid-simplex" };

  for (let iteration = 0; iteration < iterationLimit; iteration += 1) {
    faces.sort((left, right) => compareFaces(left, right, vertices));
    const face = faces[0];
    if (face === undefined || !Number.isFinite(face.distance)) {
      return { status: "failed", reason: "nonfinite" };
    }
    const support = supportMinkowski3D(
      first,
      second,
      face.normalX,
      face.normalY,
      face.normalZ,
    );
    const projection =
      support.x * face.normalX + support.y * face.normalY + support.z * face.normalZ;
    if (!Number.isFinite(projection)) return { status: "failed", reason: "nonfinite" };
    const repeated = vertices.some((vertex) => sameVertex(vertex, support));
    if (
      repeated ||
      projection - face.distance <= SUPPORT_GAP_TOLERANCE * Math.max(1, Math.abs(projection))
    ) {
      return faceResult(vertices, face);
    }
    if (projection <= face.distance) return { status: "failed", reason: "no-progress" };

    const newIndex = vertices.length;
    vertices.push(support);
    const visible = new Set<number>();
    const boundary: Array<[number, number]> = [];
    for (let index = 0; index < faces.length; index += 1) {
      const candidate = faces[index]!;
      const anchor = vertices[candidate.a]!;
      const visibility =
        candidate.normalX * (support.x - anchor.x) +
        candidate.normalY * (support.y - anchor.y) +
        candidate.normalZ * (support.z - anchor.z);
      if (visibility > GEOMETRY_EPSILON_3D) {
        visible.add(index);
        addBoundaryEdge(boundary, candidate.a, candidate.b);
        addBoundaryEdge(boundary, candidate.b, candidate.c);
        addBoundaryEdge(boundary, candidate.c, candidate.a);
      }
    }
    if (visible.size === 0 || boundary.length === 0) {
      return { status: "failed", reason: "no-progress" };
    }
    faces = faces.filter((_, index) => !visible.has(index));
    boundary.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
    for (const [a, b] of boundary) {
      const next = createFace(vertices, a, b, newIndex);
      if (next !== null) faces.push(next);
    }
    if (faces.length === 0 || faces.length > MAX_EPA_ITERATIONS_3D * 8) {
      return { status: "failed", reason: "no-progress" };
    }
  }
  return { status: "failed", reason: "iteration-limit" };
}

function createFace(
  vertices: readonly MinkowskiVertex3D[],
  a: number,
  b: number,
  c: number,
): Face3D | null {
  const first = vertices[a]!;
  const second = vertices[b]!;
  const third = vertices[c]!;
  const abX = second.x - first.x;
  const abY = second.y - first.y;
  const abZ = second.z - first.z;
  const acX = third.x - first.x;
  const acY = third.y - first.y;
  const acZ = third.z - first.z;
  let normalX = abY * acZ - abZ * acY;
  let normalY = abZ * acX - abX * acZ;
  let normalZ = abX * acY - abY * acX;
  const length = Math.hypot(normalX, normalY, normalZ);
  if (!Number.isFinite(length) || length <= GEOMETRY_EPSILON_3D) return null;
  normalX /= length;
  normalY /= length;
  normalZ /= length;
  let distance = first.x * normalX + first.y * normalY + first.z * normalZ;
  if (distance < 0) {
    normalX = -normalX;
    normalY = -normalY;
    normalZ = -normalZ;
    distance = -distance;
    return { a, b: c, c: b, normalX, normalY, normalZ, distance };
  }
  return { a, b, c, normalX, normalY, normalZ, distance };
}

function faceResult(
  vertices: readonly MinkowskiVertex3D[],
  face: Face3D,
): EpaPenetrationResult3D {
  const first = vertices[face.a]!;
  const second = vertices[face.b]!;
  const third = vertices[face.c]!;
  const closest = [
    face.normalX * face.distance,
    face.normalY * face.distance,
    face.normalZ * face.distance,
  ] as const;
  const weights = barycentric(first, second, third, closest);
  const selected = selectedWeightIndex(weights);
  return {
    status: "penetrating",
    separation: -face.distance,
    firstX: weights[0] * first.firstX + weights[1] * second.firstX + weights[2] * third.firstX,
    firstY: weights[0] * first.firstY + weights[1] * second.firstY + weights[2] * third.firstY,
    firstZ: weights[0] * first.firstZ + weights[1] * second.firstZ + weights[2] * third.firstZ,
    secondX: weights[0] * first.secondX + weights[1] * second.secondX + weights[2] * third.secondX,
    secondY: weights[0] * first.secondY + weights[1] * second.secondY + weights[2] * third.secondY,
    secondZ: weights[0] * first.secondZ + weights[1] * second.secondZ + weights[2] * third.secondZ,
    normalX: -face.normalX,
    normalY: -face.normalY,
    normalZ: -face.normalZ,
    firstFeature: [first, second, third][selected]!.firstFeature,
    secondFeature: [first, second, third][selected]!.secondFeature,
  };
}

function barycentric(
  first: MinkowskiVertex3D,
  second: MinkowskiVertex3D,
  third: MinkowskiVertex3D,
  point: ArrayLike<number>,
): readonly [number, number, number] {
  const v0 = [second.x - first.x, second.y - first.y, second.z - first.z] as const;
  const v1 = [third.x - first.x, third.y - first.y, third.z - first.z] as const;
  const v2 = [point[0]! - first.x, point[1]! - first.y, point[2]! - first.z] as const;
  const d00 = dot(v0, v0);
  const d01 = dot(v0, v1);
  const d11 = dot(v1, v1);
  const d20 = dot(v2, v0);
  const d21 = dot(v2, v1);
  const denominator = d00 * d11 - d01 * d01;
  if (Math.abs(denominator) <= GEOMETRY_EPSILON_3D ** 2) return [1, 0, 0];
  const secondWeight = (d11 * d20 - d01 * d21) / denominator;
  const thirdWeight = (d00 * d21 - d01 * d20) / denominator;
  return [1 - secondWeight - thirdWeight, secondWeight, thirdWeight];
}

function selectedWeightIndex(weights: readonly number[]): number {
  let selected = 0;
  for (let index = 1; index < weights.length; index += 1) {
    if (weights[index]! > weights[selected]! + GEOMETRY_EPSILON_3D) selected = index;
  }
  return selected;
}

function compareFaces(
  first: Face3D,
  second: Face3D,
  vertices: readonly MinkowskiVertex3D[],
): number {
  if (Math.abs(first.distance - second.distance) > GEOMETRY_EPSILON_3D) {
    return first.distance - second.distance;
  }
  const firstKey = faceFeatureKey(first, vertices);
  const secondKey = faceFeatureKey(second, vertices);
  for (let index = 0; index < firstKey.length; index += 1) {
    const difference = firstKey[index]! - secondKey[index]!;
    if (difference !== 0) return difference;
  }
  return first.a - second.a || first.b - second.b || first.c - second.c;
}

function faceFeatureKey(
  face: Face3D,
  vertices: readonly MinkowskiVertex3D[],
): readonly number[] {
  return [face.a, face.b, face.c]
    .map((index) => {
      const vertex = vertices[index]!;
      return [vertex.firstFeature, vertex.secondFeature] as const;
    })
    .sort((left, right) => left[0] - right[0] || left[1] - right[1])
    .flat();
}

function addBoundaryEdge(edges: Array<[number, number]>, a: number, b: number): void {
  const reverse = edges.findIndex((edge) => edge[0] === b && edge[1] === a);
  if (reverse >= 0) edges.splice(reverse, 1);
  else edges.push([a, b]);
}

function sameVertex(first: MinkowskiVertex3D, second: MinkowskiVertex3D): boolean {
  return Math.abs(first.x - second.x) <= GEOMETRY_EPSILON_3D &&
    Math.abs(first.y - second.y) <= GEOMETRY_EPSILON_3D &&
    Math.abs(first.z - second.z) <= GEOMETRY_EPSILON_3D;
}

function dot(first: ArrayLike<number>, second: ArrayLike<number>): number {
  return first[0]! * second[0]! + first[1]! * second[1]! + first[2]! * second[2]!;
}

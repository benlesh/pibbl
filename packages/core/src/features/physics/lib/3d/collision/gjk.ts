import {
  GEOMETRY_EPSILON_3D,
  MAX_GJK_ITERATIONS_3D,
} from "../numeric-policy.js";
import {
  supportMinkowski3D,
  type MinkowskiVertex3D,
  type PreparedConvexShape3D,
} from "./support.js";

interface GjkDistanceResult3D {
  readonly status: "separated" | "touching";
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

interface GjkPenetratingResult3D {
  readonly status: "penetrating";
  readonly simplex: readonly MinkowskiVertex3D[];
}

interface GjkFailureResult3D {
  readonly status: "failed";
  readonly reason: "iteration-limit" | "nonfinite" | "no-progress";
}

export type GjkResult3D =
  | GjkDistanceResult3D
  | GjkPenetratingResult3D
  | GjkFailureResult3D;

interface ReducedSimplex3D {
  readonly vertices: readonly MinkowskiVertex3D[];
  readonly weights: readonly number[];
  readonly closestX: number;
  readonly closestY: number;
  readonly closestZ: number;
  readonly containsOrigin: boolean;
}

export function gjkConvexShapes3D(
  first: PreparedConvexShape3D,
  second: PreparedConvexShape3D,
  initialDirectionX: number,
  initialDirectionY: number,
  initialDirectionZ: number,
  iterationLimit = MAX_GJK_ITERATIONS_3D,
): GjkResult3D {
  if (iterationLimit <= 0) return { status: "failed", reason: "iteration-limit" };
  let directionX = initialDirectionX;
  let directionY = initialDirectionY;
  let directionZ = initialDirectionZ;
  if (Math.hypot(directionX, directionY, directionZ) <= GEOMETRY_EPSILON_3D) {
    directionX = 1;
    directionY = 0;
    directionZ = 0;
  }
  let reduced = reduceSimplex([
    supportMinkowski3D(first, second, directionX, directionY, directionZ),
  ]);

  for (let iteration = 0; iteration < iterationLimit; iteration += 1) {
    const distanceSquared = squaredLength(
      reduced.closestX,
      reduced.closestY,
      reduced.closestZ,
    );
    if (!Number.isFinite(distanceSquared)) return { status: "failed", reason: "nonfinite" };
    if (reduced.containsOrigin) return { status: "penetrating", simplex: reduced.vertices };
    if (distanceSquared <= GEOMETRY_EPSILON_3D ** 2) {
      const expanded = expandZeroSimplex(reduced.vertices, first, second);
      return expanded === null
        ? distanceResult("touching", reduced)
        : { status: "penetrating", simplex: expanded };
    }

    directionX = -reduced.closestX;
    directionY = -reduced.closestY;
    directionZ = -reduced.closestZ;
    const support = supportMinkowski3D(first, second, directionX, directionY, directionZ);
    if (!finiteVertex(support)) return { status: "failed", reason: "nonfinite" };
    if (reduced.vertices.some((vertex) => sameVertex(vertex, support))) {
      return distanceResult("separated", reduced);
    }
    const supportProjection = dotVertex(support, directionX, directionY, directionZ);
    const closestProjection =
      reduced.closestX * directionX +
      reduced.closestY * directionY +
      reduced.closestZ * directionZ;
    const progress = supportProjection - closestProjection;
    if (!Number.isFinite(progress)) return { status: "failed", reason: "nonfinite" };
    if (
      progress <=
      GEOMETRY_EPSILON_3D * Math.max(1, Math.hypot(directionX, directionY, directionZ))
    ) {
      return distanceResult("separated", reduced);
    }
    const next = reduceSimplex([...reduced.vertices, support]);
    const nextDistanceSquared = squaredLength(next.closestX, next.closestY, next.closestZ);
    if (
      !next.containsOrigin &&
      nextDistanceSquared >= distanceSquared - GEOMETRY_EPSILON_3D ** 2 &&
      next.vertices.length === reduced.vertices.length
    ) {
      return distanceResult("separated", next);
    }
    reduced = next;
  }
  return { status: "failed", reason: "iteration-limit" };
}

function expandZeroSimplex(
  simplex: readonly MinkowskiVertex3D[],
  first: PreparedConvexShape3D,
  second: PreparedConvexShape3D,
): readonly MinkowskiVertex3D[] | null {
  const candidates = [...simplex];
  for (let x = -1; x <= 1; x += 1) {
    for (let y = -1; y <= 1; y += 1) {
      for (let z = -1; z <= 1; z += 1) {
        if (x === 0 && y === 0 && z === 0) continue;
        const support = supportMinkowski3D(first, second, x, y, z);
        if (!candidates.some((candidate) => sameVertex(candidate, support))) candidates.push(support);
      }
    }
  }
  for (let a = 0; a < candidates.length - 3; a += 1) {
    for (let b = a + 1; b < candidates.length - 2; b += 1) {
      for (let c = b + 1; c < candidates.length - 1; c += 1) {
        for (let d = c + 1; d < candidates.length; d += 1) {
          const reduced = reduceTetrahedron(
            candidates[a]!,
            candidates[b]!,
            candidates[c]!,
            candidates[d]!,
          );
          if (reduced.containsOrigin) return reduced.vertices;
        }
      }
    }
  }
  return null;
}

function distanceResult(
  status: "separated" | "touching",
  reduced: ReducedSimplex3D,
): GjkDistanceResult3D {
  let firstX = 0;
  let firstY = 0;
  let firstZ = 0;
  let secondX = 0;
  let secondY = 0;
  let secondZ = 0;
  for (let index = 0; index < reduced.vertices.length; index += 1) {
    const vertex = reduced.vertices[index]!;
    const weight = reduced.weights[index]!;
    firstX += weight * vertex.firstX;
    firstY += weight * vertex.firstY;
    firstZ += weight * vertex.firstZ;
    secondX += weight * vertex.secondX;
    secondY += weight * vertex.secondY;
    secondZ += weight * vertex.secondZ;
  }
  const dx = firstX - secondX;
  const dy = firstY - secondY;
  const dz = firstZ - secondZ;
  const separation = Math.hypot(dx, dy, dz);
  let featureIndex = 0;
  for (let index = 1; index < reduced.weights.length; index += 1) {
    if (reduced.weights[index]! > reduced.weights[featureIndex]! + GEOMETRY_EPSILON_3D) {
      featureIndex = index;
    }
  }
  return {
    status,
    separation: status === "touching" ? 0 : separation,
    firstX,
    firstY,
    firstZ,
    secondX,
    secondY,
    secondZ,
    normalX: separation > GEOMETRY_EPSILON_3D ? dx / separation : 0,
    normalY: separation > GEOMETRY_EPSILON_3D ? dy / separation : 0,
    normalZ: separation > GEOMETRY_EPSILON_3D ? dz / separation : 0,
    firstFeature: reduced.vertices[featureIndex]!.firstFeature,
    secondFeature: reduced.vertices[featureIndex]!.secondFeature,
  };
}

function reduceSimplex(vertices: readonly MinkowskiVertex3D[]): ReducedSimplex3D {
  if (vertices.length === 1) return vertexResult(vertices[0]!);
  if (vertices.length === 2) return reduceSegment(vertices[0]!, vertices[1]!);
  if (vertices.length === 3) return reduceTriangle(vertices[0]!, vertices[1]!, vertices[2]!);
  return reduceTetrahedron(vertices.at(-4)!, vertices.at(-3)!, vertices.at(-2)!, vertices.at(-1)!);
}

function reduceSegment(first: MinkowskiVertex3D, second: MinkowskiVertex3D): ReducedSimplex3D {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const dz = second.z - first.z;
  const denominator = squaredLength(dx, dy, dz);
  const amount = denominator <= GEOMETRY_EPSILON_3D ** 2
    ? 0
    : clamp(-(first.x * dx + first.y * dy + first.z * dz) / denominator, 0, 1);
  if (amount <= GEOMETRY_EPSILON_3D) return vertexResult(first);
  if (amount >= 1 - GEOMETRY_EPSILON_3D) return vertexResult(second);
  return segmentResult(first, second, amount);
}

function reduceTriangle(
  first: MinkowskiVertex3D,
  second: MinkowskiVertex3D,
  third: MinkowskiVertex3D,
): ReducedSimplex3D {
  const ab = [second.x - first.x, second.y - first.y, second.z - first.z] as const;
  const ac = [third.x - first.x, third.y - first.y, third.z - first.z] as const;
  const ap = [-first.x, -first.y, -first.z] as const;
  const d1 = dot(ab, ap);
  const d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return vertexResult(first);
  const bp = [-second.x, -second.y, -second.z] as const;
  const d3 = dot(ab, bp);
  const d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return vertexResult(second);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return segmentResult(first, second, d1 / (d1 - d3));
  const cp = [-third.x, -third.y, -third.z] as const;
  const d5 = dot(ab, cp);
  const d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return vertexResult(third);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return segmentResult(first, third, d2 / (d2 - d6));
  const va = d3 * d6 - d5 * d4;
  const d43 = d4 - d3;
  const d56 = d5 - d6;
  if (va <= 0 && d43 >= 0 && d56 >= 0) return segmentResult(second, third, d43 / (d43 + d56));
  const denominator = va + vb + vc;
  if (!Number.isFinite(denominator) || Math.abs(denominator) <= GEOMETRY_EPSILON_3D) {
    return bestReduced([reduceSegment(first, second), reduceSegment(first, third), reduceSegment(second, third)]);
  }
  const secondWeight = vb / denominator;
  const thirdWeight = vc / denominator;
  const firstWeight = 1 - secondWeight - thirdWeight;
  return {
    vertices: [first, second, third],
    weights: [firstWeight, secondWeight, thirdWeight],
    closestX: firstWeight * first.x + secondWeight * second.x + thirdWeight * third.x,
    closestY: firstWeight * first.y + secondWeight * second.y + thirdWeight * third.y,
    closestZ: firstWeight * first.z + secondWeight * second.z + thirdWeight * third.z,
    containsOrigin: false,
  };
}

function reduceTetrahedron(
  first: MinkowskiVertex3D,
  second: MinkowskiVertex3D,
  third: MinkowskiVertex3D,
  fourth: MinkowskiVertex3D,
): ReducedSimplex3D {
  const determinant = triple(
    second.x - first.x, second.y - first.y, second.z - first.z,
    third.x - first.x, third.y - first.y, third.z - first.z,
    fourth.x - first.x, fourth.y - first.y, fourth.z - first.z,
  );
  if (Math.abs(determinant) > GEOMETRY_EPSILON_3D ** 3) {
    const px = -first.x;
    const py = -first.y;
    const pz = -first.z;
    const secondWeight = triple(
      px, py, pz,
      third.x - first.x, third.y - first.y, third.z - first.z,
      fourth.x - first.x, fourth.y - first.y, fourth.z - first.z,
    ) / determinant;
    const thirdWeight = triple(
      second.x - first.x, second.y - first.y, second.z - first.z,
      px, py, pz,
      fourth.x - first.x, fourth.y - first.y, fourth.z - first.z,
    ) / determinant;
    const fourthWeight = triple(
      second.x - first.x, second.y - first.y, second.z - first.z,
      third.x - first.x, third.y - first.y, third.z - first.z,
      px, py, pz,
    ) / determinant;
    const firstWeight = 1 - secondWeight - thirdWeight - fourthWeight;
    if (
      firstWeight > GEOMETRY_EPSILON_3D &&
      secondWeight > GEOMETRY_EPSILON_3D &&
      thirdWeight > GEOMETRY_EPSILON_3D &&
      fourthWeight > GEOMETRY_EPSILON_3D
    ) {
      return {
        vertices: [first, second, third, fourth],
        weights: [firstWeight, secondWeight, thirdWeight, fourthWeight],
        closestX: 0,
        closestY: 0,
        closestZ: 0,
        containsOrigin: true,
      };
    }
  }
  return bestReduced([
    reduceTriangle(first, second, third),
    reduceTriangle(first, second, fourth),
    reduceTriangle(first, third, fourth),
    reduceTriangle(second, third, fourth),
  ]);
}

function bestReduced(candidates: readonly ReducedSimplex3D[]): ReducedSimplex3D {
  let selected = candidates[0]!;
  let selectedDistance = squaredLength(selected.closestX, selected.closestY, selected.closestZ);
  for (let index = 1; index < candidates.length; index += 1) {
    const candidate = candidates[index]!;
    const distance = squaredLength(candidate.closestX, candidate.closestY, candidate.closestZ);
    if (distance < selectedDistance - GEOMETRY_EPSILON_3D ** 2) {
      selected = candidate;
      selectedDistance = distance;
    }
  }
  return selected;
}

function vertexResult(vertex: MinkowskiVertex3D): ReducedSimplex3D {
  return {
    vertices: [vertex],
    weights: [1],
    closestX: vertex.x,
    closestY: vertex.y,
    closestZ: vertex.z,
    containsOrigin: false,
  };
}

function segmentResult(
  first: MinkowskiVertex3D,
  second: MinkowskiVertex3D,
  secondWeight: number,
): ReducedSimplex3D {
  return {
    vertices: [first, second],
    weights: [1 - secondWeight, secondWeight],
    closestX: first.x + secondWeight * (second.x - first.x),
    closestY: first.y + secondWeight * (second.y - first.y),
    closestZ: first.z + secondWeight * (second.z - first.z),
    containsOrigin: false,
  };
}

function finiteVertex(vertex: MinkowskiVertex3D): boolean {
  return [
    vertex.x, vertex.y, vertex.z,
    vertex.firstX, vertex.firstY, vertex.firstZ,
    vertex.secondX, vertex.secondY, vertex.secondZ,
  ].every(Number.isFinite);
}

function sameVertex(first: MinkowskiVertex3D, second: MinkowskiVertex3D): boolean {
  return Math.abs(first.x - second.x) <= GEOMETRY_EPSILON_3D &&
    Math.abs(first.y - second.y) <= GEOMETRY_EPSILON_3D &&
    Math.abs(first.z - second.z) <= GEOMETRY_EPSILON_3D;
}

function dotVertex(vertex: MinkowskiVertex3D, x: number, y: number, z: number): number {
  return vertex.x * x + vertex.y * y + vertex.z * z;
}

function dot(first: ArrayLike<number>, second: ArrayLike<number>): number {
  return first[0]! * second[0]! + first[1]! * second[1]! + first[2]! * second[2]!;
}

function triple(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number,
): number {
  return ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
}

function squaredLength(x: number, y: number, z: number): number {
  return x * x + y * y + z * z;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

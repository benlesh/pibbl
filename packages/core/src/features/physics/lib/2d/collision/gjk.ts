import type { InternalPose2D } from '../math.js';
import { GEOMETRY_EPSILON, MAX_GJK_ITERATIONS } from '../numeric-policy.js';
import type { ConvexLeaf2D } from '../shape-records.js';
import { supportMinkowski2D, type MinkowskiVertex2D } from './support.js';

export interface ConvexDistanceResult2D {
  readonly status: 'separated';
  readonly separation: number;
  readonly firstX: number;
  readonly firstY: number;
  readonly secondX: number;
  readonly secondY: number;
  readonly normalX: number;
  readonly normalY: number;
  readonly firstFeature: number;
  readonly secondFeature: number;
}

export interface ConvexTouchingResult2D extends Omit<ConvexDistanceResult2D, 'status'> {
  readonly status: 'touching';
}

export interface ConvexPenetratingResult2D {
  readonly status: 'penetrating';
  readonly simplex: readonly MinkowskiVertex2D[];
}

export interface ConvexFailureResult2D {
  readonly status: 'failed';
  readonly reason: 'iteration-limit' | 'nonfinite' | 'no-progress';
}

export type GjkResult2D =
  | ConvexDistanceResult2D
  | ConvexTouchingResult2D
  | ConvexPenetratingResult2D
  | ConvexFailureResult2D;

interface ReducedSimplex2D {
  readonly vertices: readonly MinkowskiVertex2D[];
  readonly weights: readonly number[];
  readonly closestX: number;
  readonly closestY: number;
  readonly containsOrigin: boolean;
}

export function gjkConvexLeaves2D(
  first: ConvexLeaf2D,
  firstPose: InternalPose2D,
  second: ConvexLeaf2D,
  secondPose: InternalPose2D,
  initialDirectionX: number,
  initialDirectionY: number,
): GjkResult2D {
  let directionX = initialDirectionX;
  let directionY = initialDirectionY;
  if (Math.hypot(directionX, directionY) <= GEOMETRY_EPSILON) {
    directionX = 1;
    directionY = 0;
  }
  let reduced = reduceSimplex([
    supportMinkowski2D(first, firstPose, second, secondPose, directionX, directionY),
  ]);

  for (let iteration = 0; iteration < MAX_GJK_ITERATIONS; iteration += 1) {
    const distanceSquared = reduced.closestX * reduced.closestX + reduced.closestY * reduced.closestY;
    if (!Number.isFinite(distanceSquared)) {
      return { status: 'failed', reason: 'nonfinite' };
    }
    if (reduced.containsOrigin) {
      return { status: 'penetrating', simplex: reduced.vertices };
    }
    if (distanceSquared <= GEOMETRY_EPSILON * GEOMETRY_EPSILON) {
      const expanded = expandZeroSimplex(
        reduced.vertices,
        first,
        firstPose,
        second,
        secondPose,
        initialDirectionX,
        initialDirectionY,
      );
      if (expanded !== null) {
        return { status: 'penetrating', simplex: expanded };
      }
      return distanceResult('touching', reduced);
    }

    directionX = -reduced.closestX;
    directionY = -reduced.closestY;
    const support = supportMinkowski2D(
      first,
      firstPose,
      second,
      secondPose,
      directionX,
      directionY,
    );
    if (!finiteVertex(support)) {
      return { status: 'failed', reason: 'nonfinite' };
    }
    if (reduced.vertices.some((vertex) => sameVertex(vertex, support))) {
      return distanceResult('separated', reduced);
    }
    const supportProjection = support.x * directionX + support.y * directionY;
    const closestProjection = reduced.closestX * directionX + reduced.closestY * directionY;
    const progress = supportProjection - closestProjection;
    if (!Number.isFinite(progress)) {
      return { status: 'failed', reason: 'nonfinite' };
    }
    if (progress <= GEOMETRY_EPSILON * Math.max(1, Math.hypot(directionX, directionY))) {
      return distanceResult('separated', reduced);
    }
    const next = reduceSimplex([...reduced.vertices, support]);
    const nextDistanceSquared = next.closestX * next.closestX + next.closestY * next.closestY;
    if (
      !next.containsOrigin &&
      nextDistanceSquared >= distanceSquared - GEOMETRY_EPSILON * GEOMETRY_EPSILON &&
      next.vertices.length === reduced.vertices.length
    ) {
      return distanceResult('separated', next);
    }
    reduced = next;
  }
  return { status: 'failed', reason: 'iteration-limit' };
}

function expandZeroSimplex(
  simplex: readonly MinkowskiVertex2D[],
  first: ConvexLeaf2D,
  firstPose: InternalPose2D,
  second: ConvexLeaf2D,
  secondPose: InternalPose2D,
  fallbackX: number,
  fallbackY: number,
): readonly MinkowskiVertex2D[] | null {
  let axisX = fallbackX;
  let axisY = fallbackY;
  if (simplex.length >= 2) {
    const edgeX = simplex[1]!.x - simplex[0]!.x;
    const edgeY = simplex[1]!.y - simplex[0]!.y;
    axisX = -edgeY;
    axisY = edgeX;
  }
  if (Math.hypot(axisX, axisY) <= GEOMETRY_EPSILON) {
    axisX = 0;
    axisY = 1;
  }
  const positive = supportMinkowski2D(first, firstPose, second, secondPose, axisX, axisY);
  const negative = supportMinkowski2D(first, firstPose, second, secondPose, -axisX, -axisY);
  const candidates = [...simplex, positive, negative];
  for (let firstIndex = 0; firstIndex < candidates.length - 2; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < candidates.length - 1; secondIndex += 1) {
      for (let thirdIndex = secondIndex + 1; thirdIndex < candidates.length; thirdIndex += 1) {
        const reduced = reduceTriangle(
          candidates[firstIndex]!,
          candidates[secondIndex]!,
          candidates[thirdIndex]!,
        );
        if (reduced.containsOrigin) {
          return reduced.vertices;
        }
      }
    }
  }
  return null;
}

function distanceResult(
  status: 'separated' | 'touching',
  reduced: ReducedSimplex2D,
): ConvexDistanceResult2D | ConvexTouchingResult2D {
  let firstX = 0;
  let firstY = 0;
  let secondX = 0;
  let secondY = 0;
  for (let index = 0; index < reduced.vertices.length; index += 1) {
    const vertex = reduced.vertices[index]!;
    const weight = reduced.weights[index]!;
    firstX += weight * vertex.firstX;
    firstY += weight * vertex.firstY;
    secondX += weight * vertex.secondX;
    secondY += weight * vertex.secondY;
  }
  const dx = firstX - secondX;
  const dy = firstY - secondY;
  const separation = Math.hypot(dx, dy);
  const normalX = separation > GEOMETRY_EPSILON ? dx / separation : 0;
  const normalY = separation > GEOMETRY_EPSILON ? dy / separation : 0;
  let featureIndex = 0;
  for (let index = 1; index < reduced.weights.length; index += 1) {
    if (reduced.weights[index]! > reduced.weights[featureIndex]! + GEOMETRY_EPSILON) {
      featureIndex = index;
    }
  }
  return {
    status,
    separation: status === 'touching' ? 0 : separation,
    firstX,
    firstY,
    secondX,
    secondY,
    normalX,
    normalY,
    firstFeature: reduced.vertices[featureIndex]!.firstFeature,
    secondFeature: reduced.vertices[featureIndex]!.secondFeature,
  };
}

function reduceSimplex(vertices: readonly MinkowskiVertex2D[]): ReducedSimplex2D {
  if (vertices.length === 1) {
    const vertex = vertices[0]!;
    return { vertices: [vertex], weights: [1], closestX: vertex.x, closestY: vertex.y, containsOrigin: false };
  }
  if (vertices.length === 2) {
    return reduceSegment(vertices[0]!, vertices[1]!);
  }
  return reduceTriangle(vertices.at(-3)!, vertices.at(-2)!, vertices.at(-1)!);
}

function reduceSegment(first: MinkowskiVertex2D, second: MinkowskiVertex2D): ReducedSimplex2D {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const denominator = dx * dx + dy * dy;
  const amount = denominator <= GEOMETRY_EPSILON * GEOMETRY_EPSILON
    ? 0
    : Math.max(0, Math.min(1, -(first.x * dx + first.y * dy) / denominator));
  if (amount <= GEOMETRY_EPSILON) {
    return { vertices: [first], weights: [1], closestX: first.x, closestY: first.y, containsOrigin: false };
  }
  if (amount >= 1 - GEOMETRY_EPSILON) {
    return { vertices: [second], weights: [1], closestX: second.x, closestY: second.y, containsOrigin: false };
  }
  return {
    vertices: [first, second],
    weights: [1 - amount, amount],
    closestX: first.x + amount * dx,
    closestY: first.y + amount * dy,
    containsOrigin: false,
  };
}

function reduceTriangle(
  first: MinkowskiVertex2D,
  second: MinkowskiVertex2D,
  third: MinkowskiVertex2D,
): ReducedSimplex2D {
  const abX = second.x - first.x;
  const abY = second.y - first.y;
  const acX = third.x - first.x;
  const acY = third.y - first.y;
  const apX = -first.x;
  const apY = -first.y;
  const d1 = abX * apX + abY * apY;
  const d2 = acX * apX + acY * apY;
  if (d1 <= 0 && d2 <= 0) return vertexResult(first);

  const bpX = -second.x;
  const bpY = -second.y;
  const d3 = abX * bpX + abY * bpY;
  const d4 = acX * bpX + acY * bpY;
  if (d3 >= 0 && d4 <= d3) return vertexResult(second);

  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return segmentResult(first, second, d1 / (d1 - d3));

  const cpX = -third.x;
  const cpY = -third.y;
  const d5 = abX * cpX + abY * cpY;
  const d6 = acX * cpX + acY * cpY;
  if (d6 >= 0 && d5 <= d6) return vertexResult(third);

  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return segmentResult(first, third, d2 / (d2 - d6));

  const va = d3 * d6 - d5 * d4;
  const d43 = d4 - d3;
  const d56 = d5 - d6;
  if (va <= 0 && d43 >= 0 && d56 >= 0) return segmentResult(second, third, d43 / (d43 + d56));

  const denominator = va + vb + vc;
  if (!Number.isFinite(denominator) || Math.abs(denominator) <= GEOMETRY_EPSILON) {
    return reduceSegment(first, second);
  }
  const secondWeight = vb / denominator;
  const thirdWeight = vc / denominator;
  const firstWeight = 1 - secondWeight - thirdWeight;
  const strict = firstWeight > GEOMETRY_EPSILON && secondWeight > GEOMETRY_EPSILON && thirdWeight > GEOMETRY_EPSILON;
  return {
    vertices: [first, second, third],
    weights: [firstWeight, secondWeight, thirdWeight],
    closestX: 0,
    closestY: 0,
    containsOrigin: strict,
  };
}

function vertexResult(vertex: MinkowskiVertex2D): ReducedSimplex2D {
  return { vertices: [vertex], weights: [1], closestX: vertex.x, closestY: vertex.y, containsOrigin: false };
}

function segmentResult(
  first: MinkowskiVertex2D,
  second: MinkowskiVertex2D,
  secondWeight: number,
): ReducedSimplex2D {
  return {
    vertices: [first, second],
    weights: [1 - secondWeight, secondWeight],
    closestX: first.x + secondWeight * (second.x - first.x),
    closestY: first.y + secondWeight * (second.y - first.y),
    containsOrigin: false,
  };
}

function finiteVertex(vertex: MinkowskiVertex2D): boolean {
  return Number.isFinite(vertex.x) && Number.isFinite(vertex.y) &&
    Number.isFinite(vertex.firstX) && Number.isFinite(vertex.firstY) &&
    Number.isFinite(vertex.secondX) && Number.isFinite(vertex.secondY);
}

function sameVertex(first: MinkowskiVertex2D, second: MinkowskiVertex2D): boolean {
  return Math.abs(first.x - second.x) <= GEOMETRY_EPSILON &&
    Math.abs(first.y - second.y) <= GEOMETRY_EPSILON;
}

import type { InternalPose2D } from '../math.js';
import { GEOMETRY_EPSILON, MAX_EPA_ITERATIONS } from '../numeric-policy.js';
import type { ConvexLeaf2D } from '../shape-records.js';
import { supportMinkowski2D, type MinkowskiVertex2D } from './support.js';

export interface EpaPenetrationResult2D {
  readonly status: 'penetrating';
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

export interface EpaFailureResult2D {
  readonly status: 'failed';
  readonly reason: 'iteration-limit' | 'nonfinite' | 'no-progress' | 'invalid-simplex';
}

export type EpaResult2D = EpaPenetrationResult2D | EpaFailureResult2D;

const EPA_SUPPORT_GAP_TOLERANCE = Math.sqrt(GEOMETRY_EPSILON);

interface ClosestEdge2D {
  readonly index: number;
  readonly normalX: number;
  readonly normalY: number;
  readonly distance: number;
}

export function epaConvexLeaves2D(
  first: ConvexLeaf2D,
  firstPose: InternalPose2D,
  second: ConvexLeaf2D,
  secondPose: InternalPose2D,
  simplex: readonly MinkowskiVertex2D[],
): EpaResult2D {
  if (simplex.length !== 3) {
    return { status: 'failed', reason: 'invalid-simplex' };
  }
  const polytope = [...simplex];
  if (signedArea(polytope) < 0) {
    polytope.reverse();
  }
  if (Math.abs(signedArea(polytope)) <= GEOMETRY_EPSILON) {
    return { status: 'failed', reason: 'invalid-simplex' };
  }

  for (let iteration = 0; iteration < MAX_EPA_ITERATIONS; iteration += 1) {
    const edge = closestEdge(polytope);
    if (edge === null) {
      return { status: 'failed', reason: 'nonfinite' };
    }
    const support = supportMinkowski2D(
      first,
      firstPose,
      second,
      secondPose,
      edge.normalX,
      edge.normalY,
    );
    const projection = support.x * edge.normalX + support.y * edge.normalY;
    if (!Number.isFinite(projection)) {
      return { status: 'failed', reason: 'nonfinite' };
    }
    const repeated = polytope.some((vertex) =>
      Math.abs(vertex.x - support.x) <= GEOMETRY_EPSILON &&
      Math.abs(vertex.y - support.y) <= GEOMETRY_EPSILON,
    );
    if (repeated || projection - edge.distance <= EPA_SUPPORT_GAP_TOLERANCE * Math.max(1, projection)) {
      return edgeResult(polytope, edge);
    }
    if (projection <= edge.distance || polytope.length >= MAX_EPA_ITERATIONS + 3) {
      return { status: 'failed', reason: 'no-progress' };
    }
    polytope.splice(edge.index + 1, 0, support);
  }
  return { status: 'failed', reason: 'iteration-limit' };
}

function closestEdge(polytope: readonly MinkowskiVertex2D[]): ClosestEdge2D | null {
  let selected: ClosestEdge2D | null = null;
  for (let index = 0; index < polytope.length; index += 1) {
    const first = polytope[index]!;
    const second = polytope[(index + 1) % polytope.length]!;
    const edgeX = second.x - first.x;
    const edgeY = second.y - first.y;
    const length = Math.hypot(edgeX, edgeY);
    if (!Number.isFinite(length) || length <= GEOMETRY_EPSILON) continue;
    let normalX = edgeY / length;
    let normalY = -edgeX / length;
    let distance = first.x * normalX + first.y * normalY;
    if (distance < 0) {
      normalX = -normalX;
      normalY = -normalY;
      distance = -distance;
    }
    if (
      selected === null ||
      distance < selected.distance - GEOMETRY_EPSILON ||
      (Math.abs(distance - selected.distance) <= GEOMETRY_EPSILON && index < selected.index)
    ) {
      selected = { index, normalX, normalY, distance };
    }
  }
  return selected;
}

function edgeResult(
  polytope: readonly MinkowskiVertex2D[],
  edge: ClosestEdge2D,
): EpaPenetrationResult2D {
  const first = polytope[edge.index]!;
  const second = polytope[(edge.index + 1) % polytope.length]!;
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const denominator = dx * dx + dy * dy;
  const amount = denominator <= GEOMETRY_EPSILON * GEOMETRY_EPSILON
    ? 0
    : Math.max(0, Math.min(1, -(first.x * dx + first.y * dy) / denominator));
  const firstFeature = amount <= 0.5 ? first.firstFeature : second.firstFeature;
  const secondFeature = amount <= 0.5 ? first.secondFeature : second.secondFeature;
  return {
    status: 'penetrating',
    separation: -edge.distance,
    firstX: first.firstX + amount * (second.firstX - first.firstX),
    firstY: first.firstY + amount * (second.firstY - first.firstY),
    secondX: first.secondX + amount * (second.secondX - first.secondX),
    secondY: first.secondY + amount * (second.secondY - first.secondY),
    normalX: -edge.normalX,
    normalY: -edge.normalY,
    firstFeature,
    secondFeature,
  };
}

function signedArea(vertices: readonly MinkowskiVertex2D[]): number {
  let twiceArea = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index]!;
    const next = vertices[(index + 1) % vertices.length]!;
    twiceArea += current.x * next.y - current.y * next.x;
  }
  return twiceArea / 2;
}

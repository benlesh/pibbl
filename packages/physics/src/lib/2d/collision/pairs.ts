import type {
  CRCPhysicsDistance2D,
  CRCPhysicsPose2D,
  CRCPhysicsShape2D,
  CRCPhysicsShapeContact2D,
  CRCPhysicsVector2,
} from '../../../2d-geometry.js';
import { copyFiniteVector2 } from '../../shared/validation.js';
import { composePose2D, copyPose2D, transformPointInto, type InternalPose2D } from '../math.js';
import { GEOMETRY_EPSILON } from '../numeric-policy.js';
import { requireShapeRecord2D, type ConvexLeaf2D, type ShapeRecord2D } from '../shape-records.js';
import { distanceCapsuleToCapsule2D, distancePointToSegment2D } from './analytic.js';
import { epaConvexLeaves2D } from './epa.js';
import { gjkConvexLeaves2D } from './gjk.js';
import {
  createPrivateManifold2D,
  publicContactFromManifold2D,
  type PrivatePairDistance2D,
} from './manifold.js';
import { centerOfLeaf2D } from './support.js';

interface PreparedShape2D {
  readonly shell: CRCPhysicsShape2D;
  readonly record: ShapeRecord2D;
  readonly pose: InternalPose2D;
  readonly order: number;
}

interface FailedPair2D {
  readonly status: 'failed';
}

interface SuccessfulPair2D {
  readonly status: 'success';
  readonly distance: PrivatePairDistance2D;
  readonly first: ConvexLeaf2D;
  readonly firstPose: InternalPose2D;
  readonly second: ConvexLeaf2D;
  readonly secondPose: InternalPose2D;
}

type PairResult2D = FailedPair2D | SuccessfulPair2D;

const shapeOrders = new WeakMap<object, number>();
let nextShapeOrder = 0;

export function containsPointInShape2D(
  shape: CRCPhysicsShape2D,
  pose: CRCPhysicsPose2D,
  point: CRCPhysicsVector2,
): boolean {
  const prepared = prepareShape(shape, pose, 'shape', 'pose');
  const copiedPoint = copyFiniteVector2(point, 'point');
  return prepared.record.leaves.some((leaf) => containsPointInLeaf(
    leaf,
    prepared.pose,
    copiedPoint[0],
    copiedPoint[1],
  ));
}

export function distanceBetweenPreparedShapes2D(
  firstShape: CRCPhysicsShape2D,
  firstPose: CRCPhysicsPose2D,
  secondShape: CRCPhysicsShape2D,
  secondPose: CRCPhysicsPose2D,
): CRCPhysicsDistance2D {
  const result = collidePreparedShapes(firstShape, firstPose, secondShape, secondPose);
  if (result.status === 'failed') {
    throw new Error('2D collision distance did not converge within its fixed iteration bounds.');
  }
  return publicDistance(result.distance);
}

export function overlapPreparedShapes2D(
  firstShape: CRCPhysicsShape2D,
  firstPose: CRCPhysicsPose2D,
  secondShape: CRCPhysicsShape2D,
  secondPose: CRCPhysicsPose2D,
): boolean {
  const result = collidePreparedShapes(firstShape, firstPose, secondShape, secondPose);
  return result.status === 'success' && result.distance.separation <= 0;
}

export function contactBetweenPreparedShapes2D(
  firstShape: CRCPhysicsShape2D,
  firstPose: CRCPhysicsPose2D,
  secondShape: CRCPhysicsShape2D,
  secondPose: CRCPhysicsPose2D,
): CRCPhysicsShapeContact2D | null {
  const result = collidePreparedShapes(firstShape, firstPose, secondShape, secondPose);
  if (result.status === 'failed' || result.distance.separation > 0) {
    return null;
  }
  return publicContactFromManifold2D(createPrivateManifold2D(
    result.distance,
    result.first,
    result.firstPose,
    result.second,
    result.secondPose,
  ));
}

function collidePreparedShapes(
  firstShape: CRCPhysicsShape2D,
  firstPublicPose: CRCPhysicsPose2D,
  secondShape: CRCPhysicsShape2D,
  secondPublicPose: CRCPhysicsPose2D,
): PairResult2D {
  const first = prepareShape(firstShape, firstPublicPose, 'first', 'firstPose');
  const second = prepareShape(secondShape, secondPublicPose, 'second', 'secondPose');
  let selected: SuccessfulPair2D | null = null;
  let failures = 0;
  for (const firstLeaf of first.record.leaves) {
    for (const secondLeaf of second.record.leaves) {
      const distance = distanceBetweenLeaves(firstLeaf, first.pose, secondLeaf, second.pose, first, second);
      if (distance === null) {
        failures += 1;
        continue;
      }
      const candidate: SuccessfulPair2D = {
        status: 'success',
        distance,
        first: firstLeaf,
        firstPose: first.pose,
        second: secondLeaf,
        secondPose: second.pose,
      };
      if (selected === null || comparePairCandidates(candidate, selected, first.order, second.order) < 0) {
        selected = candidate;
      }
    }
  }
  if (selected === null || (failures > 0 && selected.distance.separation > GEOMETRY_EPSILON)) {
    return { status: 'failed' };
  }
  return selected;
}

function distanceBetweenLeaves(
  first: ConvexLeaf2D,
  firstPose: InternalPose2D,
  second: ConvexLeaf2D,
  secondPose: InternalPose2D,
  firstShape: PreparedShape2D,
  secondShape: PreparedShape2D,
): PrivatePairDistance2D | null {
  const fallback = preferredNormal(first, firstPose, second, secondPose, firstShape, secondShape);
  const firstRound = roundSpine(first, firstPose);
  const secondRound = roundSpine(second, secondPose);
  if (firstRound !== null && secondRound !== null) {
    const result = distanceCapsuleToCapsule2D(
      firstRound.startX,
      firstRound.startY,
      firstRound.endX,
      firstRound.endY,
      firstRound.radius,
      secondRound.startX,
      secondRound.startY,
      secondRound.endX,
      secondRound.endY,
      secondRound.radius,
      fallback[0],
      fallback[1],
    );
    return {
      ...result,
      firstFeature: 0,
      secondFeature: 0,
      firstLeaf: first.canonicalLeafIndex,
      secondLeaf: second.canonicalLeafIndex,
    };
  }

  const gjk = gjkConvexLeaves2D(
    first,
    firstPose,
    second,
    secondPose,
    fallback[0],
    fallback[1],
  );
  if (gjk.status === 'failed') return null;
  if (gjk.status === 'penetrating') {
    const epa = epaConvexLeaves2D(first, firstPose, second, secondPose, gjk.simplex);
    if (epa.status === 'failed') return null;
    return {
      ...epa,
      firstLeaf: first.canonicalLeafIndex,
      secondLeaf: second.canonicalLeafIndex,
    };
  }
  const normalLength = Math.hypot(gjk.normalX, gjk.normalY);
  return {
    separation: gjk.separation,
    firstX: gjk.firstX,
    firstY: gjk.firstY,
    secondX: gjk.secondX,
    secondY: gjk.secondY,
    normalX: normalLength > GEOMETRY_EPSILON ? gjk.normalX : fallback[0],
    normalY: normalLength > GEOMETRY_EPSILON ? gjk.normalY : fallback[1],
    firstFeature: gjk.firstFeature,
    secondFeature: gjk.secondFeature,
    firstLeaf: first.canonicalLeafIndex,
    secondLeaf: second.canonicalLeafIndex,
  };
}

function prepareShape(
  shell: CRCPhysicsShape2D,
  publicPose: CRCPhysicsPose2D,
  shapePath: string,
  posePath: string,
): PreparedShape2D {
  const record = requireShapeRecord2D(shell);
  const pose = composePose2D(copyPose2D(publicPose, posePath), record.localPose);
  return { shell, record, pose, order: shapeOrder(shell, shapePath) };
}

function shapeOrder(shape: CRCPhysicsShape2D, _path: string): number {
  const object = shape as object;
  const existing = shapeOrders.get(object);
  if (existing !== undefined) return existing;
  const order = nextShapeOrder;
  nextShapeOrder += 1;
  shapeOrders.set(object, order);
  return order;
}

function preferredNormal(
  first: ConvexLeaf2D,
  firstPose: InternalPose2D,
  second: ConvexLeaf2D,
  secondPose: InternalPose2D,
  firstShape: PreparedShape2D,
  secondShape: PreparedShape2D,
): readonly [number, number] {
  const centers = new Float64Array(4);
  centerOfLeaf2D(centers, 0, first, firstPose);
  centerOfLeaf2D(centers, 2, second, secondPose);
  const dx = centers[0]! - centers[2]!;
  const dy = centers[1]! - centers[3]!;
  const length = Math.hypot(dx, dy);
  if (length > GEOMETRY_EPSILON) return [dx / length, dy / length];
  return firstShape.order <= secondShape.order ? [1, 0] : [-1, 0];
}

function containsPointInLeaf(
  leaf: ConvexLeaf2D,
  pose: InternalPose2D,
  pointX: number,
  pointY: number,
): boolean {
  const local = inversePoint(pointX, pointY, pose);
  switch (leaf.kind) {
    case 'circle':
      return Math.hypot(local[0] - leaf.center[0]!, local[1] - leaf.center[1]!) <= leaf.radius + GEOMETRY_EPSILON;
    case 'ellipse': {
      const dx = local[0] - leaf.center[0]!;
      const dy = local[1] - leaf.center[1]!;
      const cosine = Math.cos(leaf.rotationRadians);
      const sine = Math.sin(leaf.rotationRadians);
      const x = cosine * dx + sine * dy;
      const y = -sine * dx + cosine * dy;
      return (x / leaf.radiusX) ** 2 + (y / leaf.radiusY) ** 2 <= 1 + GEOMETRY_EPSILON;
    }
    case 'box':
      return Math.abs(local[0] - leaf.center[0]!) <= leaf.halfWidth + GEOMETRY_EPSILON &&
        Math.abs(local[1] - leaf.center[1]!) <= leaf.halfHeight + GEOMETRY_EPSILON;
    case 'rounded-box': {
      const dx = local[0] - leaf.center[0]!;
      const dy = local[1] - leaf.center[1]!;
      if (Math.abs(dx) > leaf.halfWidth + GEOMETRY_EPSILON || Math.abs(dy) > leaf.halfHeight + GEOMETRY_EPSILON) return false;
      const feature = dy < 0 ? (dx < 0 ? 0 : 1) : (dx < 0 ? 3 : 2);
      const radius = leaf.radii[feature]!;
      const cornerDx = Math.max(0, Math.abs(dx) - (leaf.halfWidth - radius));
      const cornerDy = Math.max(0, Math.abs(dy) - (leaf.halfHeight - radius));
      return cornerDx * cornerDx + cornerDy * cornerDy <= radius * radius + GEOMETRY_EPSILON;
    }
    case 'capsule':
      return distancePointToSegment2D(
        local[0], local[1], leaf.start[0]!, leaf.start[1]!, leaf.end[0]!, leaf.end[1]!,
      ).separation <= leaf.radius + GEOMETRY_EPSILON;
    case 'segment':
      return distancePointToSegment2D(
        local[0], local[1], leaf.start[0]!, leaf.start[1]!, leaf.end[0]!, leaf.end[1]!,
      ).separation <= GEOMETRY_EPSILON;
    case 'polygon': {
      for (let index = 0; index < leaf.vertices.length / 2; index += 1) {
        const next = (index + 1) % (leaf.vertices.length / 2);
        const ax = leaf.vertices[index * 2]!;
        const ay = leaf.vertices[index * 2 + 1]!;
        const bx = leaf.vertices[next * 2]!;
        const by = leaf.vertices[next * 2 + 1]!;
        if ((bx - ax) * (local[1] - ay) - (by - ay) * (local[0] - ax) < -GEOMETRY_EPSILON) return false;
      }
      return true;
    }
  }
}

function inversePoint(x: number, y: number, pose: InternalPose2D): readonly [number, number] {
  const dx = x - pose.x;
  const dy = y - pose.y;
  const cosine = Math.cos(pose.rotationRadians);
  const sine = Math.sin(pose.rotationRadians);
  return [cosine * dx + sine * dy, -sine * dx + cosine * dy];
}

function roundSpine(
  leaf: ConvexLeaf2D,
  pose: InternalPose2D,
): Readonly<{ startX: number; startY: number; endX: number; endY: number; radius: number }> | null {
  const output = new Float64Array(4);
  switch (leaf.kind) {
    case 'circle':
      transformPointInto(output, 0, leaf.center[0]!, leaf.center[1]!, pose);
      return { startX: output[0]!, startY: output[1]!, endX: output[0]!, endY: output[1]!, radius: leaf.radius };
    case 'capsule':
      transformPointInto(output, 0, leaf.start[0]!, leaf.start[1]!, pose);
      transformPointInto(output, 2, leaf.end[0]!, leaf.end[1]!, pose);
      return { startX: output[0]!, startY: output[1]!, endX: output[2]!, endY: output[3]!, radius: leaf.radius };
    case 'segment':
      transformPointInto(output, 0, leaf.start[0]!, leaf.start[1]!, pose);
      transformPointInto(output, 2, leaf.end[0]!, leaf.end[1]!, pose);
      return { startX: output[0]!, startY: output[1]!, endX: output[2]!, endY: output[3]!, radius: 0 };
    default:
      return null;
  }
}

function comparePairCandidates(
  first: SuccessfulPair2D,
  second: SuccessfulPair2D,
  firstShapeOrder: number,
  secondShapeOrder: number,
): number {
  const separationDifference = first.distance.separation - second.distance.separation;
  if (Math.abs(separationDifference) > GEOMETRY_EPSILON) return separationDifference;
  const firstKey = canonicalLeafKey(first.distance, firstShapeOrder, secondShapeOrder);
  const secondKey = canonicalLeafKey(second.distance, firstShapeOrder, secondShapeOrder);
  return firstKey[0] - secondKey[0] || firstKey[1] - secondKey[1] ||
    first.distance.firstFeature - second.distance.firstFeature ||
    first.distance.secondFeature - second.distance.secondFeature;
}

function canonicalLeafKey(
  distance: PrivatePairDistance2D,
  firstShapeOrder: number,
  secondShapeOrder: number,
): readonly [number, number] {
  return firstShapeOrder <= secondShapeOrder
    ? [distance.firstLeaf, distance.secondLeaf]
    : [distance.secondLeaf, distance.firstLeaf];
}

function publicDistance(distance: PrivatePairDistance2D): CRCPhysicsDistance2D {
  return Object.freeze({
    separation: cleanZero(distance.separation),
    pointOnFirst: freezeVector(distance.firstX, distance.firstY),
    pointOnSecond: freezeVector(distance.secondX, distance.secondY),
    normal: freezeVector(distance.normalX, distance.normalY),
  });
}

function freezeVector(x: number, y: number): readonly [number, number] {
  return Object.freeze([cleanZero(x), cleanZero(y)] as const);
}

function cleanZero(value: number): number {
  return Object.is(value, -0) || Math.abs(value) <= Number.EPSILON ? 0 : value;
}

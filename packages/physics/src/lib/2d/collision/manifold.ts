import type { CRCPhysicsShapeContact2D } from "../../../2d-geometry.js";
import { transformPointInto, type InternalPose2D } from "../math.js";
import { GEOMETRY_EPSILON } from "../numeric-policy.js";
import type { ConvexLeaf2D } from "../shape-records.js";

export interface PrivatePairDistance2D {
  readonly separation: number;
  readonly firstX: number;
  readonly firstY: number;
  readonly secondX: number;
  readonly secondY: number;
  readonly normalX: number;
  readonly normalY: number;
  readonly firstFeature: number;
  readonly secondFeature: number;
  readonly firstLeaf: number;
  readonly secondLeaf: number;
}

interface PrivateManifoldPoint2D {
  readonly firstX: number;
  readonly firstY: number;
  readonly secondX: number;
  readonly secondY: number;
  readonly separation: number;
  readonly firstFeature: number;
  readonly secondFeature: number;
}

export interface PrivateManifold2D {
  readonly normalX: number;
  readonly normalY: number;
  readonly firstLeaf: number;
  readonly secondLeaf: number;
  readonly points: readonly PrivateManifoldPoint2D[];
}

export function createPrivateManifold2D(
  distance: PrivatePairDistance2D,
  first: ConvexLeaf2D,
  firstPose: InternalPose2D,
  second: ConvexLeaf2D,
  secondPose: InternalPose2D,
): PrivateManifold2D {
  const firstVertices = polygonVertices(
    first,
    firstPose,
    distance.normalX,
    distance.normalY,
  );
  const secondVertices = polygonVertices(
    second,
    secondPose,
    distance.normalX,
    distance.normalY,
  );
  let points: readonly PrivateManifoldPoint2D[];
  if (firstVertices !== null && secondVertices !== null) {
    points = faceContactPoints(distance, firstVertices, secondVertices);
  } else {
    points = [
      {
        firstX: distance.firstX,
        firstY: distance.firstY,
        secondX: distance.secondX,
        secondY: distance.secondY,
        separation: distance.separation,
        firstFeature: distance.firstFeature,
        secondFeature: distance.secondFeature,
      },
    ];
  }
  return {
    normalX: distance.normalX,
    normalY: distance.normalY,
    firstLeaf: distance.firstLeaf,
    secondLeaf: distance.secondLeaf,
    points,
  };
}

export function publicContactFromManifold2D(
  manifold: PrivateManifold2D,
): CRCPhysicsShapeContact2D {
  const normal = freezeVector(manifold.normalX, manifold.normalY);
  const points = manifold.points.map((point) =>
    Object.freeze({
      pointOnFirst: freezeVector(point.firstX, point.firstY),
      pointOnSecond: freezeVector(point.secondX, point.secondY),
      separation: cleanZero(point.separation),
    }),
  );
  return Object.freeze({ normal, points: Object.freeze(points) });
}

function faceContactPoints(
  distance: PrivatePairDistance2D,
  firstVertices: Float64Array,
  secondVertices: Float64Array,
): readonly PrivateManifoldPoint2D[] {
  const firstFace = supportingFace(
    firstVertices,
    -distance.normalX,
    -distance.normalY,
  );
  const secondFace = supportingFace(
    secondVertices,
    distance.normalX,
    distance.normalY,
  );
  const firstAlignment = -(
    firstFace.normalX * distance.normalX +
    firstFace.normalY * distance.normalY
  );
  const secondAlignment =
    secondFace.normalX * distance.normalX +
    secondFace.normalY * distance.normalY;
  const firstIsReference = firstAlignment >= secondAlignment - GEOMETRY_EPSILON;
  const reference = firstIsReference ? firstFace : secondFace;
  const incident = firstIsReference ? secondFace : firstFace;
  const referenceTangentX = reference.endX - reference.startX;
  const referenceTangentY = reference.endY - reference.startY;
  const referenceLength = Math.hypot(referenceTangentX, referenceTangentY);
  if (referenceLength <= GEOMETRY_EPSILON) return fallbackPoint(distance);
  const tangentX = referenceTangentX / referenceLength;
  const tangentY = referenceTangentY / referenceLength;
  const minimum = reference.startX * tangentX + reference.startY * tangentY;
  const maximum = reference.endX * tangentX + reference.endY * tangentY;
  let clipped = clipSegment(
    [incident.startX, incident.startY, incident.endX, incident.endY],
    tangentX,
    tangentY,
    Math.min(minimum, maximum),
    true,
  );
  if (clipped === null) return fallbackPoint(distance);
  clipped = clipSegment(
    clipped,
    tangentX,
    tangentY,
    Math.max(minimum, maximum),
    false,
  );
  if (clipped === null) return fallbackPoint(distance);
  const referenceNormalX = reference.normalX;
  const referenceNormalY = reference.normalY;
  const points: PrivateManifoldPoint2D[] = [];
  for (let index = 0; index < 2; index += 1) {
    const x = clipped[index * 2]!;
    const y = clipped[index * 2 + 1]!;
    const separation =
      (x - reference.startX) * referenceNormalX +
      (y - reference.startY) * referenceNormalY;
    if (separation > GEOMETRY_EPSILON) continue;
    const projectedX = x - separation * referenceNormalX;
    const projectedY = y - separation * referenceNormalY;
    points.push(
      firstIsReference
        ? {
            firstX: projectedX,
            firstY: projectedY,
            secondX: x,
            secondY: y,
            separation,
            firstFeature: reference.index,
            secondFeature: incident.index * 2 + index,
          }
        : {
            firstX: x,
            firstY: y,
            secondX: projectedX,
            secondY: projectedY,
            separation,
            firstFeature: incident.index * 2 + index,
            secondFeature: reference.index,
          },
    );
  }
  if (points.length === 0) return fallbackPoint(distance);
  const publicTangentX = -distance.normalY;
  const publicTangentY = distance.normalX;
  points.sort((first, second) => {
    const projectionDifference =
      first.firstX * publicTangentX +
      first.firstY * publicTangentY -
      (second.firstX * publicTangentX + second.firstY * publicTangentY);
    if (Math.abs(projectionDifference) > GEOMETRY_EPSILON)
      return projectionDifference;
    return (
      first.firstFeature - second.firstFeature ||
      first.secondFeature - second.secondFeature
    );
  });
  return points.slice(0, 2);
}

interface Face2D {
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
  readonly normalX: number;
  readonly normalY: number;
  readonly index: number;
}

function supportingFace(
  vertices: Float64Array,
  directionX: number,
  directionY: number,
): Face2D {
  let selected: Face2D | null = null;
  let selectedAlignment = Number.NEGATIVE_INFINITY;
  const count = vertices.length / 2;
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    const startX = vertices[index * 2]!;
    const startY = vertices[index * 2 + 1]!;
    const endX = vertices[next * 2]!;
    const endY = vertices[next * 2 + 1]!;
    const edgeX = endX - startX;
    const edgeY = endY - startY;
    const length = Math.hypot(edgeX, edgeY);
    if (length <= GEOMETRY_EPSILON) continue;
    const normalX = edgeY / length;
    const normalY = -edgeX / length;
    const alignment = normalX * directionX + normalY * directionY;
    if (alignment > selectedAlignment) {
      selectedAlignment = alignment;
      selected = { startX, startY, endX, endY, normalX, normalY, index };
    }
  }
  return selected!;
}

function clipSegment(
  segment: readonly [number, number, number, number],
  normalX: number,
  normalY: number,
  offset: number,
  keepGreater: boolean,
): [number, number, number, number] | null {
  const firstDistance = segment[0] * normalX + segment[1] * normalY - offset;
  const secondDistance = segment[2] * normalX + segment[3] * normalY - offset;
  const firstInside = keepGreater
    ? firstDistance >= -GEOMETRY_EPSILON
    : firstDistance <= GEOMETRY_EPSILON;
  const secondInside = keepGreater
    ? secondDistance >= -GEOMETRY_EPSILON
    : secondDistance <= GEOMETRY_EPSILON;
  if (firstInside && secondInside) return [...segment];
  if (!firstInside && !secondInside) return null;
  const denominator = firstDistance - secondDistance;
  if (Math.abs(denominator) <= GEOMETRY_EPSILON) return null;
  const amount = firstDistance / denominator;
  const x = segment[0] + amount * (segment[2] - segment[0]);
  const y = segment[1] + amount * (segment[3] - segment[1]);
  return firstInside
    ? [segment[0], segment[1], x, y]
    : [x, y, segment[2], segment[3]];
}

function fallbackPoint(
  distance: PrivatePairDistance2D,
): readonly PrivateManifoldPoint2D[] {
  return [
    {
      firstX: distance.firstX,
      firstY: distance.firstY,
      secondX: distance.secondX,
      secondY: distance.secondY,
      separation: distance.separation,
      firstFeature: distance.firstFeature,
      secondFeature: distance.secondFeature,
    },
  ];
}

function polygonVertices(
  leaf: ConvexLeaf2D,
  pose: InternalPose2D,
  normalX: number,
  normalY: number,
): Float64Array | null {
  let local: Float64Array | readonly number[];
  if (leaf.kind === "box") {
    local = [
      leaf.center[0]! - leaf.halfWidth,
      leaf.center[1]! - leaf.halfHeight,
      leaf.center[0]! + leaf.halfWidth,
      leaf.center[1]! - leaf.halfHeight,
      leaf.center[0]! + leaf.halfWidth,
      leaf.center[1]! + leaf.halfHeight,
      leaf.center[0]! - leaf.halfWidth,
      leaf.center[1]! + leaf.halfHeight,
    ];
  } else if (leaf.kind === "capsule") {
    const dx = leaf.end[0]! - leaf.start[0]!,
      dy = leaf.end[1]! - leaf.start[1]!;
    const length = Math.hypot(dx, dy);
    if (length <= GEOMETRY_EPSILON) return null;
    const cosine = Math.cos(pose.rotationRadians),
      sine = Math.sin(pose.rotationRadians);
    // Keep the two endpoint supports while a capsule rests across a face.
    // Near an axial impact the round end retains its single witness.
    const localNormalX = cosine * normalX + sine * normalY;
    const localNormalY = -sine * normalX + cosine * normalY;
    if (Math.abs(dx * localNormalX + dy * localNormalY) > length * 0.95)
      return null;
    const sign = dx * localNormalY - dy * localNormalX >= 0 ? 1 : -1;
    const nx = sign * localNormalX * leaf.radius,
      ny = sign * localNormalY * leaf.radius;
    local = [
      leaf.start[0]! - nx,
      leaf.start[1]! - ny,
      leaf.end[0]! - nx,
      leaf.end[1]! - ny,
      leaf.end[0]! + nx,
      leaf.end[1]! + ny,
      leaf.start[0]! + nx,
      leaf.start[1]! + ny,
    ];
  } else if (leaf.kind === "polygon") {
    local = leaf.vertices;
  } else {
    return null;
  }
  const result = new Float64Array(local.length);
  for (let index = 0; index < local.length; index += 2) {
    transformPointInto(result, index, local[index]!, local[index + 1]!, pose);
  }
  return result;
}

function freezeVector(x: number, y: number): readonly [number, number] {
  return Object.freeze([cleanZero(x), cleanZero(y)] as const);
}

function cleanZero(value: number): number {
  return Object.is(value, -0) || Math.abs(value) <= Number.EPSILON ? 0 : value;
}

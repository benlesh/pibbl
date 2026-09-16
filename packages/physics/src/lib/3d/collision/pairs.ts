import type {
  CRCPhysicsDistance3D,
  CRCPhysicsPose3D,
  CRCPhysicsShape3D,
  CRCPhysicsShapeContact3D,
  CRCPhysicsVector3,
} from "../../../3d-geometry.js";
import {
  cleanZero,
  copyFiniteVector3,
  copyPose3D,
  type InternalPose3D,
} from "../math.js";
import { GEOMETRY_EPSILON_3D } from "../numeric-policy.js";
import { requireShapeRecord3D, type ShapeRecord3D } from "../shape-records.js";
import {
  distanceSphereToBox3D,
  distanceSphereToSphere3D,
  type AnalyticDistance3D,
} from "./analytic.js";
import { epaConvexShapes3D } from "./epa.js";
import { gjkConvexShapes3D } from "./gjk.js";
import {
  createPrivateManifold3D,
  freezeCollisionVector3,
  publicContactFromManifold3D,
  type PrivateManifold3D,
  type PrivatePairDistance3D,
} from "./manifold.js";
import { prepareConvexShape3D, type PreparedConvexShape3D } from "./support.js";

interface PreparedShape3D {
  readonly shape: CRCPhysicsShape3D;
  readonly record: ShapeRecord3D;
  readonly pose: InternalPose3D;
  readonly convex: PreparedConvexShape3D;
  readonly order: number;
}

interface SuccessfulPair3D {
  readonly status: "success";
  readonly distance: PrivatePairDistance3D;
  readonly first: PreparedConvexShape3D;
  readonly second: PreparedConvexShape3D;
}

interface FailedPair3D {
  readonly status: "failed";
  readonly reason: "gjk" | "epa" | "nonfinite";
}

type PairResult3D = SuccessfulPair3D | FailedPair3D;

export type PrivateManifoldResult3D =
  | Readonly<{ status: "contact"; manifold: PrivateManifold3D }>
  | Readonly<{ status: "separated" }>
  | FailedPair3D;

export type ConvexCollisionResult3D =
  | Readonly<{ status: "success"; distance: PrivatePairDistance3D }>
  | Readonly<{ status: "failed"; reason: "gjk" | "epa" }>;

const GJK_NORMALIZATION_THRESHOLD = Number.MAX_VALUE ** 0.25 / 16;

export function containsPoint3D(
  shape: CRCPhysicsShape3D,
  pose: CRCPhysicsPose3D,
  point: CRCPhysicsVector3,
): boolean {
  const prepared = prepareShape(shape, pose, "shape", "pose");
  const copied = copyFiniteVector3(point, "point");
  if (prepared.convex.kind === "sphere") {
    return Math.hypot(
      copied[0]! - prepared.convex.center[0]!,
      copied[1]! - prepared.convex.center[1]!,
      copied[2]! - prepared.convex.center[2]!,
    ) <= prepared.convex.radius + GEOMETRY_EPSILON_3D;
  }
  const dx = copied[0]! - prepared.convex.center[0]!;
  const dy = copied[1]! - prepared.convex.center[1]!;
  const dz = copied[2]! - prepared.convex.center[2]!;
  for (let axis = 0; axis < 3; axis += 1) {
    const local =
      dx * prepared.convex.axes[axis * 3]! +
      dy * prepared.convex.axes[axis * 3 + 1]! +
      dz * prepared.convex.axes[axis * 3 + 2]!;
    if (Math.abs(local) > prepared.convex.halfExtents[axis]! + GEOMETRY_EPSILON_3D) return false;
  }
  return true;
}

export function distanceBetweenPreparedShapes3D(
  firstShape: CRCPhysicsShape3D,
  firstPose: CRCPhysicsPose3D,
  secondShape: CRCPhysicsShape3D,
  secondPose: CRCPhysicsPose3D,
): CRCPhysicsDistance3D {
  const result = collidePreparedShapes(firstShape, firstPose, secondShape, secondPose);
  if (result.status === "failed") {
    throw new Error("3D collision distance did not converge within its fixed iteration bounds.");
  }
  return publicDistance(result.distance);
}

export function distanceBetweenShapes3D(
  firstShape: CRCPhysicsShape3D,
  firstPose: CRCPhysicsPose3D,
  secondShape: CRCPhysicsShape3D,
  secondPose: CRCPhysicsPose3D,
): CRCPhysicsDistance3D {
  return distanceBetweenPreparedShapes3D(firstShape, firstPose, secondShape, secondPose);
}

export function overlapPreparedShapes3D(
  firstShape: CRCPhysicsShape3D,
  firstPose: CRCPhysicsPose3D,
  secondShape: CRCPhysicsShape3D,
  secondPose: CRCPhysicsPose3D,
): boolean {
  const result = collidePreparedShapes(firstShape, firstPose, secondShape, secondPose);
  return result.status === "success" && result.distance.separation <= 0;
}

export function overlapShapes3D(
  firstShape: CRCPhysicsShape3D,
  firstPose: CRCPhysicsPose3D,
  secondShape: CRCPhysicsShape3D,
  secondPose: CRCPhysicsPose3D,
): boolean {
  return overlapPreparedShapes3D(firstShape, firstPose, secondShape, secondPose);
}

export function contactBetweenPreparedShapes3D(
  firstShape: CRCPhysicsShape3D,
  firstPose: CRCPhysicsPose3D,
  secondShape: CRCPhysicsShape3D,
  secondPose: CRCPhysicsPose3D,
): CRCPhysicsShapeContact3D | null {
  const first = prepareShape(firstShape, firstPose, "first", "firstPose");
  const second = prepareShape(secondShape, secondPose, "second", "secondPose");
  const result = manifoldResultBetweenPreparedRecords(first, second);
  return result.status === "contact"
    ? publicContactFromManifold3D(result.manifold)
    : null;
}

export function contactBetweenShapes3D(
  firstShape: CRCPhysicsShape3D,
  firstPose: CRCPhysicsPose3D,
  secondShape: CRCPhysicsShape3D,
  secondPose: CRCPhysicsPose3D,
): CRCPhysicsShapeContact3D | null {
  return contactBetweenPreparedShapes3D(firstShape, firstPose, secondShape, secondPose);
}

/** Package-private world/cache seam. Not exported from a package entry. */
export function manifoldBetweenShapeRecords3D(
  firstRecord: ShapeRecord3D,
  firstPose: InternalPose3D,
  firstOrder: number,
  secondRecord: ShapeRecord3D,
  secondPose: InternalPose3D,
  secondOrder: number,
): PrivateManifold3D | null {
  const result = manifoldResultBetweenShapeRecords3D(
    firstRecord,
    firstPose,
    firstOrder,
    secondRecord,
    secondPose,
    secondOrder,
  );
  return result.status === "contact" ? result.manifold : null;
}

/** Package-private diagnostic seam for later world tracing. */
export function manifoldResultBetweenShapeRecords3D(
  firstRecord: ShapeRecord3D,
  firstPose: InternalPose3D,
  firstOrder: number,
  secondRecord: ShapeRecord3D,
  secondPose: InternalPose3D,
  secondOrder: number,
  iterationLimits: Readonly<{ gjk?: number; epa?: number }> = {},
): PrivateManifoldResult3D {
  const first = prepareShapeRecord(firstRecord, firstPose, firstOrder);
  const second = prepareShapeRecord(secondRecord, secondPose, secondOrder);
  return manifoldResultBetweenPreparedRecords(first, second, iterationLimits);
}

function manifoldResultBetweenPreparedRecords(
  first: PreparedShape3D,
  second: PreparedShape3D,
  iterationLimits: Readonly<{ gjk?: number; epa?: number }> = {},
): PrivateManifoldResult3D {
  if (comparePrepared(first, second) <= 0) {
    const result = collideCanonical(first, second, iterationLimits);
    if (result.status === "failed") return result;
    if (result.distance.separation > 0) return { status: "separated" };
    const manifold = createPrivateManifold3D(result.distance, result.first, result.second);
    return finitePrivateManifold(manifold)
      ? { status: "contact", manifold }
      : { status: "failed", reason: "nonfinite" };
  }
  const result = collideCanonical(second, first, iterationLimits);
  if (result.status === "failed") return result;
  if (result.distance.separation > 0) return { status: "separated" };
  const manifold = invertManifold(
    createPrivateManifold3D(result.distance, result.first, result.second),
  );
  return finitePrivateManifold(manifold)
    ? { status: "contact", manifold }
    : { status: "failed", reason: "nonfinite" };
}

function collidePreparedShapes(
  firstShape: CRCPhysicsShape3D,
  firstPublicPose: CRCPhysicsPose3D,
  secondShape: CRCPhysicsShape3D,
  secondPublicPose: CRCPhysicsPose3D,
): PairResult3D {
  const first = prepareShape(firstShape, firstPublicPose, "first", "firstPose");
  const second = prepareShape(secondShape, secondPublicPose, "second", "secondPose");
  return collidePreparedRecords(first, second);
}

function collidePreparedRecords(first: PreparedShape3D, second: PreparedShape3D): PairResult3D {
  if (comparePrepared(first, second) <= 0) return collideCanonical(first, second);
  const result = collideCanonical(second, first);
  return result.status === "failed" ? result : invertResult(result);
}

function collideCanonical(
  first: PreparedShape3D,
  second: PreparedShape3D,
  iterationLimits: Readonly<{ gjk?: number; epa?: number }> = {},
): PairResult3D {
  const fallback = preferredNormal(first, second);
  let distance: PrivatePairDistance3D;
  if (first.convex.kind === "sphere" && second.convex.kind === "sphere") {
    distance = analyticToPrivate(distanceSphereToSphere3D(
      first.convex.center,
      first.convex.radius,
      second.convex.center,
      second.convex.radius,
      fallback,
    ));
  } else if (first.convex.kind === "sphere" && second.convex.kind === "box") {
    distance = analyticToPrivate(distanceSphereToBox3D(
      first.convex.center,
      first.convex.radius,
      second.convex.center,
      second.convex.axes,
      second.convex.halfExtents,
    ));
  } else if (first.convex.kind === "box" && second.convex.kind === "sphere") {
    distance = invertDistance(analyticToPrivate(distanceSphereToBox3D(
      second.convex.center,
      second.convex.radius,
      first.convex.center,
      first.convex.axes,
      first.convex.halfExtents,
    )));
  } else {
    const convex = collideConvexShapes3D(
      first.convex,
      second.convex,
      fallback,
      iterationLimits,
    );
    if (convex.status === "failed") return convex;
    distance = convex.distance;
  }
  return finitePrivateDistance(distance)
    ? { status: "success", distance, first: first.convex, second: second.convex }
    : { status: "failed", reason: "nonfinite" };
}

export function collideConvexShapes3D(
  first: PreparedConvexShape3D,
  second: PreparedConvexShape3D,
  fallback: ArrayLike<number>,
  iterationLimits: Readonly<{ gjk?: number; epa?: number }> = {},
): ConvexCollisionResult3D {
  const normalized = normalizeConvexPair(first, second);
  if (normalized === null) return { status: "failed", reason: "gjk" };
  const gjk = gjkConvexShapes3D(
    normalized.first,
    normalized.second,
    fallback[0]!,
    fallback[1]!,
    fallback[2]!,
    iterationLimits.gjk,
  );
  if (gjk.status === "failed") return { status: "failed", reason: "gjk" };
  let distance: PrivatePairDistance3D;
  if (gjk.status === "penetrating") {
    const epa = epaConvexShapes3D(
      normalized.first,
      normalized.second,
      gjk.simplex,
      iterationLimits.epa,
    );
    if (epa.status === "failed") return { status: "failed", reason: "epa" };
    distance = { ...epa };
  } else {
    const normalLength = Math.hypot(gjk.normalX, gjk.normalY, gjk.normalZ);
    distance = {
      separation: gjk.separation,
      firstX: gjk.firstX,
      firstY: gjk.firstY,
      firstZ: gjk.firstZ,
      secondX: gjk.secondX,
      secondY: gjk.secondY,
      secondZ: gjk.secondZ,
      normalX: normalLength > GEOMETRY_EPSILON_3D ? gjk.normalX : fallback[0]!,
      normalY: normalLength > GEOMETRY_EPSILON_3D ? gjk.normalY : fallback[1]!,
      normalZ: normalLength > GEOMETRY_EPSILON_3D ? gjk.normalZ : fallback[2]!,
      firstFeature: gjk.firstFeature,
      secondFeature: gjk.secondFeature,
    };
  }
  const rescaled = rescaleDistance(distance, normalized.origin, normalized.scale);
  return rescaled === null
    ? { status: "failed", reason: gjk.status === "penetrating" ? "epa" : "gjk" }
    : { status: "success", distance: rescaled };
}

function normalizeConvexPair(
  first: PreparedConvexShape3D,
  second: PreparedConvexShape3D,
): Readonly<{
  first: PreparedConvexShape3D;
  second: PreparedConvexShape3D;
  origin: readonly [number, number, number];
  scale: number;
}> | null {
  const maximum = Math.max(
    ...first.center.map(Math.abs),
    ...second.center.map(Math.abs),
    first.kind === "sphere" ? first.radius : Math.max(...first.halfExtents),
    second.kind === "sphere" ? second.radius : Math.max(...second.halfExtents),
  );
  if (!Number.isFinite(maximum)) return null;
  if (maximum <= GJK_NORMALIZATION_THRESHOLD) {
    return { first, second, origin: [0, 0, 0], scale: 1 };
  }
  const origin = [
    first.center[0]! / 2 + second.center[0]! / 2,
    first.center[1]! / 2 + second.center[1]! / 2,
    first.center[2]! / 2 + second.center[2]! / 2,
  ] as const;
  const firstOffset = new Float64Array([
    first.center[0]! - origin[0],
    first.center[1]! - origin[1],
    first.center[2]! - origin[2],
  ]);
  const secondOffset = new Float64Array([
    second.center[0]! - origin[0],
    second.center[1]! - origin[1],
    second.center[2]! - origin[2],
  ]);
  const scale = Math.max(
    ...firstOffset.map(Math.abs),
    ...secondOffset.map(Math.abs),
    first.kind === "sphere" ? first.radius : Math.max(...first.halfExtents),
    second.kind === "sphere" ? second.radius : Math.max(...second.halfExtents),
  );
  if (!Number.isFinite(scale) || scale <= 0) return null;
  return {
    first: scalePreparedShape(first, firstOffset, scale),
    second: scalePreparedShape(second, secondOffset, scale),
    origin,
    scale,
  };
}

function scalePreparedShape(
  shape: PreparedConvexShape3D,
  center: Float64Array,
  scale: number,
): PreparedConvexShape3D {
  center[0] /= scale;
  center[1] /= scale;
  center[2] /= scale;
  return shape.kind === "sphere"
    ? { kind: "sphere", center, radius: shape.radius / scale }
    : {
        kind: "box",
        center,
        axes: shape.axes,
        halfExtents: new Float64Array([
          shape.halfExtents[0]! / scale,
          shape.halfExtents[1]! / scale,
          shape.halfExtents[2]! / scale,
        ]),
      };
}

function rescaleDistance(
  distance: PrivatePairDistance3D,
  origin: ArrayLike<number>,
  scale: number,
): PrivatePairDistance3D | null {
  const result: PrivatePairDistance3D = {
    separation: distance.separation * scale,
    firstX: origin[0]! + distance.firstX * scale,
    firstY: origin[1]! + distance.firstY * scale,
    firstZ: origin[2]! + distance.firstZ * scale,
    secondX: origin[0]! + distance.secondX * scale,
    secondY: origin[1]! + distance.secondY * scale,
    secondZ: origin[2]! + distance.secondZ * scale,
    normalX: distance.normalX,
    normalY: distance.normalY,
    normalZ: distance.normalZ,
    firstFeature: distance.firstFeature,
    secondFeature: distance.secondFeature,
  };
  return finitePrivateDistance(result) ? result : null;
}

function finitePrivateDistance(distance: PrivatePairDistance3D): boolean {
  return [
    distance.separation,
    distance.firstX,
    distance.firstY,
    distance.firstZ,
    distance.secondX,
    distance.secondY,
    distance.secondZ,
    distance.normalX,
    distance.normalY,
    distance.normalZ,
  ].every(Number.isFinite);
}

function finitePrivateManifold(manifold: PrivateManifold3D): boolean {
  return [
    manifold.normalX,
    manifold.normalY,
    manifold.normalZ,
    ...manifold.points.flatMap((point) => [
      point.firstX,
      point.firstY,
      point.firstZ,
      point.secondX,
      point.secondY,
      point.secondZ,
      point.separation,
    ]),
  ].every(Number.isFinite);
}

function prepareShape(
  shape: CRCPhysicsShape3D,
  publicPose: CRCPhysicsPose3D,
  _shapePath: string,
  posePath: string,
): PreparedShape3D {
  const record = requireShapeRecord3D(shape);
  const pose = copyPose3D(publicPose, posePath);
  return {
    shape,
    record,
    pose,
    convex: prepareConvexShape3D(record, pose),
    order: record.identity,
  };
}

function prepareShapeRecord(
  record: ShapeRecord3D,
  pose: InternalPose3D,
  order: number,
): PreparedShape3D {
  const shell = Object.freeze({}) as CRCPhysicsShape3D;
  return { shape: shell, record, pose, convex: prepareConvexShape3D(record, pose), order };
}

function preferredNormal(first: PreparedShape3D, second: PreparedShape3D): readonly [number, number, number] {
  const dx = first.convex.center[0]! - second.convex.center[0]!;
  const dy = first.convex.center[1]! - second.convex.center[1]!;
  const dz = first.convex.center[2]! - second.convex.center[2]!;
  const length = Math.hypot(dx, dy, dz);
  if (length > GEOMETRY_EPSILON_3D) return [dx / length, dy / length, dz / length];
  return comparePrepared(first, second) <= 0 ? [1, 0, 0] : [-1, 0, 0];
}

function comparePrepared(first: PreparedShape3D, second: PreparedShape3D): number {
  if (first.order !== second.order) return first.order < second.order ? -1 : 1;
  const poseOrder = compareArrays(first.pose.position, second.pose.position) ||
    compareArrays(first.pose.orientation, second.pose.orientation);
  if (poseOrder !== 0) return poseOrder;
  const centerOrder = compareArrays(first.convex.center, second.convex.center);
  if (centerOrder !== 0) return centerOrder;
  if (first.convex.kind !== second.convex.kind) return first.convex.kind === "sphere" ? -1 : 1;
  if (first.convex.kind === "sphere" && second.convex.kind === "sphere") {
    return first.convex.radius < second.convex.radius
      ? -1
      : first.convex.radius > second.convex.radius ? 1 : 0;
  }
  if (first.convex.kind === "box" && second.convex.kind === "box") {
    const axesOrder = compareArrays(first.convex.axes, second.convex.axes);
    if (axesOrder !== 0) return axesOrder;
    const extentsOrder = compareArrays(first.convex.halfExtents, second.convex.halfExtents);
    if (extentsOrder !== 0) return extentsOrder;
  }
  return 0;
}

function compareArrays(first: ArrayLike<number>, second: ArrayLike<number>): number {
  for (let index = 0; index < first.length; index += 1) {
    if (first[index]! < second[index]!) return -1;
    if (first[index]! > second[index]!) return 1;
  }
  return 0;
}

function analyticToPrivate(distance: AnalyticDistance3D): PrivatePairDistance3D {
  return {
    separation: distance.separation,
    firstX: distance.first[0], firstY: distance.first[1], firstZ: distance.first[2],
    secondX: distance.second[0], secondY: distance.second[1], secondZ: distance.second[2],
    normalX: distance.normal[0], normalY: distance.normal[1], normalZ: distance.normal[2],
    firstFeature: distance.firstFeature,
    secondFeature: distance.secondFeature,
  };
}

function invertResult(result: SuccessfulPair3D): SuccessfulPair3D {
  return {
    status: "success",
    distance: invertDistance(result.distance),
    first: result.second,
    second: result.first,
  };
}

function invertDistance(distance: PrivatePairDistance3D): PrivatePairDistance3D {
  return {
    separation: distance.separation,
    firstX: distance.secondX, firstY: distance.secondY, firstZ: distance.secondZ,
    secondX: distance.firstX, secondY: distance.firstY, secondZ: distance.firstZ,
    normalX: -distance.normalX, normalY: -distance.normalY, normalZ: -distance.normalZ,
    firstFeature: distance.secondFeature,
    secondFeature: distance.firstFeature,
  };
}

function invertManifold(manifold: PrivateManifold3D): PrivateManifold3D {
  return {
    normalX: -manifold.normalX,
    normalY: -manifold.normalY,
    normalZ: -manifold.normalZ,
    points: manifold.points.map((point) => ({
      firstX: point.secondX,
      firstY: point.secondY,
      firstZ: point.secondZ,
      secondX: point.firstX,
      secondY: point.firstY,
      secondZ: point.firstZ,
      separation: point.separation,
      firstFeature: point.secondFeature,
      secondFeature: point.firstFeature,
    })),
  };
}

function publicDistance(distance: PrivatePairDistance3D): CRCPhysicsDistance3D {
  return Object.freeze({
    separation: cleanZero(distance.separation),
    pointOnFirst: freezeCollisionVector3(distance.firstX, distance.firstY, distance.firstZ),
    pointOnSecond: freezeCollisionVector3(distance.secondX, distance.secondY, distance.secondZ),
    normal: freezeCollisionVector3(distance.normalX, distance.normalY, distance.normalZ),
  });
}

import type {
  CRCPhysicsDistance3D,
  CRCPhysicsPose3D,
  CRCPhysicsShape3D,
  CRCPhysicsShapeContact3D,
  CRCPhysicsVector3,
} from "../../../3d-geometry.js";
import {
  cleanZero,
  composePose3D,
  copyFiniteVector3,
  copyPose3D,
  transformPointInto,
  type InternalPose3D,
} from "../math.js";
import { GEOMETRY_EPSILON_3D } from "../numeric-policy.js";
import {
  requireShapeRecord3D,
  type ConcaveShapeRecord3D,
  type ShapeRecord3D,
} from "../shape-records.js";
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
import {
  prepareConvexShape3D,
  supportShape3D,
  type PreparedConvexShape3D,
} from "./support.js";

interface PreparedShape3D {
  readonly shape: CRCPhysicsShape3D;
  readonly record: ShapeRecord3D;
  readonly pose: InternalPose3D;
  readonly convex: PreparedConvexShape3D | null;
  readonly order: number;
}

type PreparedConcaveShape3D = PreparedShape3D &
  Readonly<{
    record: ConcaveShapeRecord3D;
    convex: null;
  }>;

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
  if (prepared.convex === null)
    return containsConcavePoint(prepared as PreparedConcaveShape3D, copied);
  if (prepared.convex.kind === "sphere") {
    return (
      Math.hypot(
        copied[0]! - prepared.convex.center[0]!,
        copied[1]! - prepared.convex.center[1]!,
        copied[2]! - prepared.convex.center[2]!,
      ) <=
      prepared.convex.radius + GEOMETRY_EPSILON_3D
    );
  }
  if (prepared.convex.kind === "capsule") {
    return (
      pointSegmentDistanceSquared(
        copied,
        prepared.convex.start,
        prepared.convex.end,
      ) <=
      (prepared.convex.radius + GEOMETRY_EPSILON_3D) ** 2
    );
  }
  if (prepared.convex.kind === "hull") {
    for (let index = 0; index < prepared.convex.faces.length; index += 3) {
      const a = vertex(prepared.convex.vertices, prepared.convex.faces[index]!);
      const b = vertex(
        prepared.convex.vertices,
        prepared.convex.faces[index + 1]!,
      );
      const c = vertex(
        prepared.convex.vertices,
        prepared.convex.faces[index + 2]!,
      );
      if (signedTrianglePlane(a, b, c, copied) > GEOMETRY_EPSILON_3D)
        return false;
    }
    return true;
  }
  if (
    prepared.convex.kind === "ellipsoid" ||
    prepared.convex.kind === "cylinder" ||
    prepared.convex.kind === "cone"
  ) {
    const local = localPoint(
      prepared.convex.center,
      prepared.convex.axes,
      copied,
    );
    if (prepared.convex.kind === "ellipsoid") {
      return (
        (local[0] / prepared.convex.radii[0]!) ** 2 +
          (local[1] / prepared.convex.radii[1]!) ** 2 +
          (local[2] / prepared.convex.radii[2]!) ** 2 <=
        1 + GEOMETRY_EPSILON_3D
      );
    }
    if (
      local[1] < -prepared.convex.halfHeight - GEOMETRY_EPSILON_3D ||
      local[1] > prepared.convex.halfHeight + GEOMETRY_EPSILON_3D
    )
      return false;
    const radius =
      prepared.convex.kind === "cone"
        ? (prepared.convex.radius * (prepared.convex.halfHeight - local[1])) /
          (2 * prepared.convex.halfHeight)
        : prepared.convex.radius;
    return Math.hypot(local[0], local[2]) <= radius + GEOMETRY_EPSILON_3D;
  }
  const dx = copied[0]! - prepared.convex.center[0]!;
  const dy = copied[1]! - prepared.convex.center[1]!;
  const dz = copied[2]! - prepared.convex.center[2]!;
  for (let axis = 0; axis < 3; axis += 1) {
    const local =
      dx * prepared.convex.axes[axis * 3]! +
      dy * prepared.convex.axes[axis * 3 + 1]! +
      dz * prepared.convex.axes[axis * 3 + 2]!;
    if (
      Math.abs(local) >
      prepared.convex.halfExtents[axis]! + GEOMETRY_EPSILON_3D
    )
      return false;
  }
  return true;
}

export function distanceBetweenPreparedShapes3D(
  firstShape: CRCPhysicsShape3D,
  firstPose: CRCPhysicsPose3D,
  secondShape: CRCPhysicsShape3D,
  secondPose: CRCPhysicsPose3D,
): CRCPhysicsDistance3D {
  const result = collidePreparedShapes(
    firstShape,
    firstPose,
    secondShape,
    secondPose,
  );
  if (result.status === "failed") {
    throw new Error(
      "3D collision distance did not converge within its fixed iteration bounds.",
    );
  }
  return publicDistance(result.distance);
}

export function distanceBetweenShapes3D(
  firstShape: CRCPhysicsShape3D,
  firstPose: CRCPhysicsPose3D,
  secondShape: CRCPhysicsShape3D,
  secondPose: CRCPhysicsPose3D,
): CRCPhysicsDistance3D {
  return distanceBetweenPreparedShapes3D(
    firstShape,
    firstPose,
    secondShape,
    secondPose,
  );
}

export function overlapPreparedShapes3D(
  firstShape: CRCPhysicsShape3D,
  firstPose: CRCPhysicsPose3D,
  secondShape: CRCPhysicsShape3D,
  secondPose: CRCPhysicsPose3D,
): boolean {
  const result = collidePreparedShapes(
    firstShape,
    firstPose,
    secondShape,
    secondPose,
  );
  return result.status === "success" && result.distance.separation <= 0;
}

export function overlapShapes3D(
  firstShape: CRCPhysicsShape3D,
  firstPose: CRCPhysicsPose3D,
  secondShape: CRCPhysicsShape3D,
  secondPose: CRCPhysicsPose3D,
): boolean {
  return overlapPreparedShapes3D(
    firstShape,
    firstPose,
    secondShape,
    secondPose,
  );
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
  return contactBetweenPreparedShapes3D(
    firstShape,
    firstPose,
    secondShape,
    secondPose,
  );
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
    const manifold = createPrivateManifold3D(
      result.distance,
      result.first,
      result.second,
    );
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
  const second = prepareShape(
    secondShape,
    secondPublicPose,
    "second",
    "secondPose",
  );
  return collidePreparedRecords(first, second);
}

function collidePreparedRecords(
  first: PreparedShape3D,
  second: PreparedShape3D,
): PairResult3D {
  if (comparePrepared(first, second) <= 0)
    return collideCanonical(first, second);
  const result = collideCanonical(second, first);
  return result.status === "failed" ? result : invertResult(result);
}

function collideCanonical(
  first: PreparedShape3D,
  second: PreparedShape3D,
  iterationLimits: Readonly<{ gjk?: number; epa?: number }> = {},
): PairResult3D {
  if (first.convex === null || second.convex === null) {
    return collideWithConcave(first, second, iterationLimits);
  }
  const fallback = preferredNormal(first, second);
  let distance: PrivatePairDistance3D;
  if (first.convex.kind === "sphere" && second.convex.kind === "sphere") {
    distance = analyticToPrivate(
      distanceSphereToSphere3D(
        first.convex.center,
        first.convex.radius,
        second.convex.center,
        second.convex.radius,
        fallback,
      ),
    );
  } else if (first.convex.kind === "sphere" && second.convex.kind === "box") {
    distance = analyticToPrivate(
      distanceSphereToBox3D(
        first.convex.center,
        first.convex.radius,
        second.convex.center,
        second.convex.axes,
        second.convex.halfExtents,
      ),
    );
  } else if (first.convex.kind === "box" && second.convex.kind === "sphere") {
    distance = invertDistance(
      analyticToPrivate(
        distanceSphereToBox3D(
          second.convex.center,
          second.convex.radius,
          first.convex.center,
          first.convex.axes,
          first.convex.halfExtents,
        ),
      ),
    );
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
    ? {
        status: "success",
        distance,
        first: first.convex,
        second: second.convex,
      }
    : { status: "failed", reason: "nonfinite" };
}

function collideWithConcave(
  first: PreparedShape3D,
  second: PreparedShape3D,
  iterationLimits: Readonly<{ gjk?: number; epa?: number }>,
): PairResult3D {
  if (first.convex !== null && second.convex === null) {
    return collideConvexConcave(
      first.convex,
      second as PreparedConcaveShape3D,
      iterationLimits,
    );
  }
  if (first.convex === null && second.convex !== null) {
    const result = collideConvexConcave(
      second.convex,
      first as PreparedConcaveShape3D,
      iterationLimits,
    );
    return result.status === "failed" ? result : invertResult(result);
  }
  if (first.convex === null && second.convex === null) {
    const firstConcave = first as PreparedConcaveShape3D;
    const secondConcave = second as PreparedConcaveShape3D;
    let best: PairResult3D | null = null;
    const queue: Array<
      Readonly<{ firstNode: number; secondNode: number; lower: number }>
    > = [
      {
        firstNode: 0,
        secondNode: 0,
        lower: aabbDistance(
          preparedBvhNodeBounds(firstConcave, 0),
          preparedBvhNodeBounds(secondConcave, 0),
        ),
      },
    ];
    while (queue.length > 0) {
      queue.sort(
        (left, right) =>
          left.lower - right.lower ||
          left.firstNode - right.firstNode ||
          left.secondNode - right.secondNode,
      );
      const candidateNodes = queue.shift()!;
      if (
        best?.status === "success" &&
        candidateNodes.lower > Math.max(0, best.distance.separation)
      )
        break;
      const firstLeaf =
        firstConcave.record.bvh.triangle[candidateNodes.firstNode]!;
      const secondLeaf =
        secondConcave.record.bvh.triangle[candidateNodes.secondNode]!;
      if (firstLeaf < 0 || secondLeaf < 0) {
        const children: Array<readonly [number, number]> = [];
        if (firstLeaf < 0 && secondLeaf < 0) {
          for (const firstChild of bvhChildren(
            firstConcave.record,
            candidateNodes.firstNode,
          ))
            for (const secondChild of bvhChildren(
              secondConcave.record,
              candidateNodes.secondNode,
            ))
              children.push([firstChild, secondChild]);
        } else if (firstLeaf < 0) {
          for (const firstChild of bvhChildren(
            firstConcave.record,
            candidateNodes.firstNode,
          ))
            children.push([firstChild, candidateNodes.secondNode]);
        } else {
          for (const secondChild of bvhChildren(
            secondConcave.record,
            candidateNodes.secondNode,
          ))
            children.push([candidateNodes.firstNode, secondChild]);
        }
        for (const [firstNode, secondNode] of children) {
          queue.push({
            firstNode,
            secondNode,
            lower: aabbDistance(
              preparedBvhNodeBounds(firstConcave, firstNode),
              preparedBvhNodeBounds(secondConcave, secondNode),
            ),
          });
        }
        continue;
      }
      const firstTriangle = preparedTriangle(firstConcave, firstLeaf);
      const secondTriangle = preparedTriangle(secondConcave, secondLeaf);
      const result = collideConvexShapes3D(
        firstTriangle.shape,
        secondTriangle.shape,
        [1, 0, 0],
        iterationLimits,
      );
      if (result.status === "failed") continue;
      const candidate: SuccessfulPair3D = {
        status: "success",
        distance: {
          ...result.distance,
          firstFeature: firstTriangle.sourceId,
          secondFeature: secondTriangle.sourceId,
        },
        first: firstTriangle.shape,
        second: secondTriangle.shape,
      };
      if (
        best === null ||
        (best.status === "success" &&
          candidate.distance.separation < best.distance.separation)
      )
        best = candidate;
    }
    if (
      best?.status === "success" &&
      best.distance.separation > 0 &&
      (closedConcaveContains(
        secondConcave,
        preparedConcaveSurfacePoint(firstConcave),
      ) ||
        closedConcaveContains(
          firstConcave,
          preparedConcaveSurfacePoint(secondConcave),
        ))
    ) {
      return {
        ...best,
        distance: {
          ...best.distance,
          separation: -best.distance.separation,
        },
      };
    }
    return best ?? { status: "failed", reason: "gjk" };
  }
  return { status: "failed", reason: "gjk" };
}

function collideConvexConcave(
  convex: PreparedConvexShape3D,
  concave: PreparedConcaveShape3D,
  iterationLimits: Readonly<{ gjk?: number; epa?: number }>,
): PairResult3D {
  let best: SuccessfulPair3D | null = null;
  const convexBounds = preparedConvexBounds(convex);
  const queue: Array<Readonly<{ node: number; lower: number }>> = [
    {
      node: 0,
      lower: aabbDistance(convexBounds, preparedBvhNodeBounds(concave, 0)),
    },
  ];
  while (queue.length > 0) {
    queue.sort(
      (left, right) => left.lower - right.lower || left.node - right.node,
    );
    const candidateNode = queue.shift()!;
    if (
      best !== null &&
      candidateNode.lower > Math.max(0, best.distance.separation)
    )
      break;
    const leaf = concave.record.bvh.triangle[candidateNode.node]!;
    if (leaf < 0) {
      for (const child of bvhChildren(concave.record, candidateNode.node)) {
        queue.push({
          node: child,
          lower: aabbDistance(
            convexBounds,
            preparedBvhNodeBounds(concave, child),
          ),
        });
      }
      continue;
    }
    const triangle = preparedTriangle(concave, leaf);
    const distance = distanceConvexTriangle(
      convex,
      triangle.shape,
      triangle.sourceId,
      iterationLimits,
    );
    if (distance === null) continue;
    const candidate: SuccessfulPair3D = {
      status: "success",
      distance,
      first: convex,
      second: triangle.shape,
    };
    if (
      best === null ||
      distance.separation < best.distance.separation - GEOMETRY_EPSILON_3D ||
      (Math.abs(distance.separation - best.distance.separation) <=
        GEOMETRY_EPSILON_3D &&
        triangle.sourceId < best.distance.secondFeature)
    )
      best = candidate;
  }
  if (
    best !== null &&
    best.distance.separation > 0 &&
    closedConcaveContains(concave, convex.center)
  ) {
    return {
      ...best,
      distance: {
        ...best.distance,
        separation: -best.distance.separation,
      },
    };
  }
  return best ?? { status: "failed", reason: "gjk" };
}

function closedConcaveContains(
  shape: PreparedConcaveShape3D,
  point: ArrayLike<number>,
): boolean {
  return (
    shape.record.kind === "triangleMesh" &&
    shape.record.closedManifold &&
    containsConcavePoint(shape, new Float64Array(point))
  );
}

function preparedConcaveSurfacePoint(
  shape: PreparedConcaveShape3D,
): Float64Array {
  const pose = composePose3D(shape.pose, shape.record.localPose);
  const point = new Float64Array(3);
  transformPointInto(point, shape.record.triangles.subarray(0, 3), pose);
  return point;
}

function distanceConvexTriangle(
  convex: PreparedConvexShape3D,
  triangle: Extract<PreparedConvexShape3D, { kind: "hull" }>,
  sourceId: number,
  iterationLimits: Readonly<{ gjk?: number; epa?: number }>,
): PrivatePairDistance3D | null {
  const a = triangle.vertices.subarray(0, 3),
    b = triangle.vertices.subarray(3, 6),
    c = triangle.vertices.subarray(6, 9);
  let normal = cross3(subtract3(b, a), subtract3(c, a));
  const length = Math.hypot(...normal);
  if (length <= GEOMETRY_EPSILON_3D) return null;
  normal = normal.map((value) => value / length) as [number, number, number];
  if (dot3(subtract3(convex.center, a), normal) < 0)
    normal = normal.map((value) => -value) as [number, number, number];
  const witness = new Float64Array(3);
  const feature = supportShape3D(
    witness,
    convex,
    -normal[0],
    -normal[1],
    -normal[2],
  );
  const separation = dot3(subtract3(witness, a), normal);
  const projected = new Float64Array([
    witness[0]! - normal[0] * separation,
    witness[1]! - normal[1] * separation,
    witness[2]! - normal[2] * separation,
  ]);
  if (pointInTriangle(projected, a, b, c, normal)) {
    return {
      separation,
      firstX: witness[0]!,
      firstY: witness[1]!,
      firstZ: witness[2]!,
      secondX: projected[0]!,
      secondY: projected[1]!,
      secondZ: projected[2]!,
      normalX: normal[0],
      normalY: normal[1],
      normalZ: normal[2],
      firstFeature: feature,
      secondFeature: sourceId,
    };
  }
  const result = collideConvexShapes3D(
    convex,
    triangle,
    normal,
    iterationLimits,
  );
  return result.status === "success"
    ? { ...result.distance, secondFeature: sourceId }
    : null;
}

function preparedTriangle(
  shape: PreparedConcaveShape3D,
  triangle: number,
): Readonly<{
  sourceId: number;
  shape: Extract<PreparedConvexShape3D, { kind: "hull" }>;
}> {
  const record = shape.record;
  const pose = composePose3D(shape.pose, record.localPose);
  const vertices = new Float64Array(9);
  for (let vertex = 0; vertex < 3; vertex += 1)
    transformPointInto(
      vertices.subarray(vertex * 3, vertex * 3 + 3),
      record.triangles.subarray(
        triangle * 9 + vertex * 3,
        triangle * 9 + vertex * 3 + 3,
      ),
      pose,
    );
  const center = new Float64Array([
    (vertices[0]! + vertices[3]! + vertices[6]!) / 3,
    (vertices[1]! + vertices[4]! + vertices[7]!) / 3,
    (vertices[2]! + vertices[5]! + vertices[8]!) / 3,
  ]);
  return {
    sourceId: record.sourceTriangleIds[triangle]!,
    shape: {
      kind: "hull",
      center,
      vertices,
      faces: new Uint32Array(0),
    },
  };
}

interface PairBounds3D {
  readonly minimum: readonly [number, number, number];
  readonly maximum: readonly [number, number, number];
}

function preparedConvexBounds(shape: PreparedConvexShape3D): PairBounds3D {
  const minimum = [0, 0, 0] as [number, number, number];
  const maximum = [0, 0, 0] as [number, number, number];
  const point = new Float64Array(3);
  for (let axis = 0; axis < 3; axis += 1) {
    const direction = [0, 0, 0];
    direction[axis] = -1;
    supportShape3D(point, shape, direction[0]!, direction[1]!, direction[2]!);
    minimum[axis] = point[axis]!;
    direction[axis] = 1;
    supportShape3D(point, shape, direction[0]!, direction[1]!, direction[2]!);
    maximum[axis] = point[axis]!;
  }
  return { minimum, maximum };
}

function preparedBvhNodeBounds(
  shape: PreparedConcaveShape3D,
  node: number,
): PairBounds3D {
  const pose = composePose3D(shape.pose, shape.record.localPose);
  const localMinimum = shape.record.bvh.minimum.subarray(
    node * 3,
    node * 3 + 3,
  );
  const localMaximum = shape.record.bvh.maximum.subarray(
    node * 3,
    node * 3 + 3,
  );
  const minimum = [Infinity, Infinity, Infinity] as [number, number, number];
  const maximum = [-Infinity, -Infinity, -Infinity] as [number, number, number];
  const local = new Float64Array(3);
  const world = new Float64Array(3);
  for (let corner = 0; corner < 8; corner += 1) {
    for (let axis = 0; axis < 3; axis += 1)
      local[axis] =
        (corner & (1 << axis)) === 0
          ? localMinimum[axis]!
          : localMaximum[axis]!;
    transformPointInto(world, local, pose);
    for (let axis = 0; axis < 3; axis += 1) {
      minimum[axis] = Math.min(minimum[axis]!, world[axis]!);
      maximum[axis] = Math.max(maximum[axis]!, world[axis]!);
    }
  }
  return { minimum, maximum };
}

function bvhChildren(
  record: Extract<ShapeRecord3D, { kind: "triangleMesh" | "heightfield" }>,
  node: number,
): readonly number[] {
  return [record.bvh.left[node]!, record.bvh.right[node]!]
    .filter((child) => child >= 0)
    .sort((left, right) => left - right);
}

function aabbDistance(first: PairBounds3D, second: PairBounds3D): number {
  let squared = 0;
  for (let axis = 0; axis < 3; axis += 1) {
    const gap =
      first.maximum[axis]! < second.minimum[axis]!
        ? second.minimum[axis]! - first.maximum[axis]!
        : second.maximum[axis]! < first.minimum[axis]!
          ? first.minimum[axis]! - second.maximum[axis]!
          : 0;
    squared += gap * gap;
  }
  return Math.sqrt(squared);
}

function pointAabbDistance(
  point: ArrayLike<number>,
  bounds: PairBounds3D,
): number {
  let squared = 0;
  for (let axis = 0; axis < 3; axis += 1) {
    const gap =
      point[axis]! < bounds.minimum[axis]!
        ? bounds.minimum[axis]! - point[axis]!
        : point[axis]! > bounds.maximum[axis]!
          ? point[axis]! - bounds.maximum[axis]!
          : 0;
    squared += gap * gap;
  }
  return Math.sqrt(squared);
}

function rayAabbEntry(
  origin: ArrayLike<number>,
  direction: ArrayLike<number>,
  bounds: PairBounds3D,
): number | null {
  let enter = 0;
  let exit = Infinity;
  for (let axis = 0; axis < 3; axis += 1) {
    const delta = direction[axis]!;
    if (delta === 0) {
      if (
        origin[axis]! < bounds.minimum[axis]! ||
        origin[axis]! > bounds.maximum[axis]!
      )
        return null;
      continue;
    }
    let first = (bounds.minimum[axis]! - origin[axis]!) / delta;
    let second = (bounds.maximum[axis]! - origin[axis]!) / delta;
    if (first > second) [first, second] = [second, first];
    enter = Math.max(enter, first);
    exit = Math.min(exit, second);
    if (enter > exit) return null;
  }
  return exit >= 0 ? enter : null;
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
    if (epa.status === "failed") {
      if (iterationLimits.epa !== undefined)
        return { status: "failed", reason: "epa" };
      distance = directionalPenetration(
        normalized.first,
        normalized.second,
        fallback,
      );
    } else distance = { ...epa };
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
  const rescaled = rescaleDistance(
    distance,
    normalized.origin,
    normalized.scale,
  );
  return rescaled === null
    ? { status: "failed", reason: gjk.status === "penetrating" ? "epa" : "gjk" }
    : { status: "success", distance: rescaled };
}

function directionalPenetration(
  first: PreparedConvexShape3D,
  second: PreparedConvexShape3D,
  direction: ArrayLike<number>,
): PrivatePairDistance3D {
  const length = Math.hypot(direction[0]!, direction[1]!, direction[2]!);
  const normal =
    length > 0
      ? [direction[0]! / length, direction[1]! / length, direction[2]! / length]
      : [1, 0, 0];
  const firstPoint = new Float64Array(3);
  const secondPoint = new Float64Array(3);
  const firstFeature = supportShape3D(
    firstPoint,
    first,
    -normal[0]!,
    -normal[1]!,
    -normal[2]!,
  );
  const secondFeature = supportShape3D(
    secondPoint,
    second,
    normal[0]!,
    normal[1]!,
    normal[2]!,
  );
  return {
    separation:
      (firstPoint[0]! - secondPoint[0]!) * normal[0]! +
      (firstPoint[1]! - secondPoint[1]!) * normal[1]! +
      (firstPoint[2]! - secondPoint[2]!) * normal[2]!,
    firstX: firstPoint[0]!,
    firstY: firstPoint[1]!,
    firstZ: firstPoint[2]!,
    secondX: secondPoint[0]!,
    secondY: secondPoint[1]!,
    secondZ: secondPoint[2]!,
    normalX: normal[0]!,
    normalY: normal[1]!,
    normalZ: normal[2]!,
    firstFeature,
    secondFeature,
  };
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
    preparedMagnitude(first),
    preparedMagnitude(second),
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
    preparedMagnitude(first),
    preparedMagnitude(second),
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
  if (shape.kind === "sphere") {
    return { kind: "sphere", center, radius: shape.radius / scale };
  }
  if (shape.kind === "hull") {
    const vertices = new Float64Array(shape.vertices.length);
    for (let index = 0; index < vertices.length; index += 3) {
      vertices[index] =
        (shape.vertices[index]! - (shape.center[0]! - center[0]! * scale)) /
        scale;
      vertices[index + 1] =
        (shape.vertices[index + 1]! - (shape.center[1]! - center[1]! * scale)) /
        scale;
      vertices[index + 2] =
        (shape.vertices[index + 2]! - (shape.center[2]! - center[2]! * scale)) /
        scale;
    }
    return { kind: "hull", center, vertices, faces: shape.faces };
  }
  if (shape.kind === "capsule") {
    const offsetX = shape.center[0]! - center[0]! * scale;
    const offsetY = shape.center[1]! - center[1]! * scale;
    const offsetZ = shape.center[2]! - center[2]! * scale;
    return {
      kind: "capsule",
      center,
      start: new Float64Array([
        (shape.start[0]! - offsetX) / scale,
        (shape.start[1]! - offsetY) / scale,
        (shape.start[2]! - offsetZ) / scale,
      ]),
      end: new Float64Array([
        (shape.end[0]! - offsetX) / scale,
        (shape.end[1]! - offsetY) / scale,
        (shape.end[2]! - offsetZ) / scale,
      ]),
      radius: shape.radius / scale,
    };
  }
  if (shape.kind === "ellipsoid")
    return {
      ...shape,
      center,
      radii: new Float64Array(shape.radii.map((value) => value / scale)),
    };
  if (shape.kind === "cylinder" || shape.kind === "cone")
    return {
      ...shape,
      center,
      radius: shape.radius / scale,
      halfHeight: shape.halfHeight / scale,
    };
  return {
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
    convex:
      record.kind === "triangleMesh" || record.kind === "heightfield"
        ? null
        : prepareConvexShape3D(record, pose),
    order: record.identity,
  };
}

function prepareShapeRecord(
  record: ShapeRecord3D,
  pose: InternalPose3D,
  order: number,
): PreparedShape3D {
  const shell = Object.freeze({}) as CRCPhysicsShape3D;
  return {
    shape: shell,
    record,
    pose,
    convex:
      record.kind === "triangleMesh" || record.kind === "heightfield"
        ? null
        : prepareConvexShape3D(record, pose),
    order,
  };
}

function preferredNormal(
  first: PreparedShape3D,
  second: PreparedShape3D,
): readonly [number, number, number] {
  const firstCenter = preparedCenter(first);
  const secondCenter = preparedCenter(second);
  const dx = firstCenter[0]! - secondCenter[0]!;
  const dy = firstCenter[1]! - secondCenter[1]!;
  const dz = firstCenter[2]! - secondCenter[2]!;
  const length = Math.hypot(dx, dy, dz);
  if (length > GEOMETRY_EPSILON_3D)
    return [dx / length, dy / length, dz / length];
  return comparePrepared(first, second) <= 0 ? [1, 0, 0] : [-1, 0, 0];
}

function comparePrepared(
  first: PreparedShape3D,
  second: PreparedShape3D,
): number {
  if (first.order !== second.order) return first.order < second.order ? -1 : 1;
  const poseOrder =
    compareArrays(first.pose.position, second.pose.position) ||
    compareArrays(first.pose.orientation, second.pose.orientation);
  if (poseOrder !== 0) return poseOrder;
  const centerOrder = compareArrays(
    preparedCenter(first),
    preparedCenter(second),
  );
  if (centerOrder !== 0) return centerOrder;
  if (first.convex === null || second.convex === null) {
    return first.record.kind < second.record.kind
      ? -1
      : first.record.kind > second.record.kind
        ? 1
        : 0;
  }
  if (first.convex.kind !== second.convex.kind) {
    return first.convex.kind < second.convex.kind ? -1 : 1;
  }
  if (first.convex.kind === "sphere" && second.convex.kind === "sphere") {
    return first.convex.radius < second.convex.radius
      ? -1
      : first.convex.radius > second.convex.radius
        ? 1
        : 0;
  }
  if (first.convex.kind === "box" && second.convex.kind === "box") {
    const axesOrder = compareArrays(first.convex.axes, second.convex.axes);
    if (axesOrder !== 0) return axesOrder;
    const extentsOrder = compareArrays(
      first.convex.halfExtents,
      second.convex.halfExtents,
    );
    if (extentsOrder !== 0) return extentsOrder;
  }
  if (first.convex.kind === "hull" && second.convex.kind === "hull") {
    return compareArrays(first.convex.vertices, second.convex.vertices);
  }
  return 0;
}

function preparedCenter(shape: PreparedShape3D): Float64Array {
  if (shape.convex !== null) return shape.convex.center;
  const pose = composePose3D(shape.pose, shape.record.localPose);
  const center = new Float64Array(3);
  transformPointInto(center, shape.record.center, pose);
  return center;
}

function containsConcavePoint(
  shape: PreparedConcaveShape3D,
  point: Float64Array,
): boolean {
  for (const triangleIndex of pointCandidateTriangles(
    shape,
    point,
    GEOMETRY_EPSILON_3D,
  )) {
    const triangle = preparedTriangle(shape, triangleIndex);
    const a = triangle.shape.vertices.subarray(0, 3);
    const b = triangle.shape.vertices.subarray(3, 6);
    const c = triangle.shape.vertices.subarray(6, 9);
    const normal = cross3(subtract3(b, a), subtract3(c, a));
    const length = Math.hypot(...normal);
    if (
      length > 0 &&
      Math.abs(dot3(subtract3(point, a), normal)) / length <=
        GEOMETRY_EPSILON_3D &&
      pointInTriangle(point, a, b, c, normal)
    )
      return true;
  }
  if (shape.record.kind !== "triangleMesh" || !shape.record.closedManifold)
    return false;
  let crossings = 0;
  const direction = [1, 0.3713906763541037, 0.17320508075688773] as const;
  for (const triangleIndex of rayCandidateTriangles(shape, point, direction)) {
    const triangle = preparedTriangle(shape, triangleIndex);
    const a = triangle.shape.vertices.subarray(0, 3);
    const b = triangle.shape.vertices.subarray(3, 6);
    const c = triangle.shape.vertices.subarray(6, 9);
    if (rayTriangleTime(point, direction, a, b, c) !== null) crossings += 1;
  }
  return crossings % 2 === 1;
}

function pointCandidateTriangles(
  shape: PreparedConcaveShape3D,
  point: ArrayLike<number>,
  maximumDistance: number,
): readonly number[] {
  const queue: Array<Readonly<{ node: number; lower: number }>> = [
    {
      node: 0,
      lower: pointAabbDistance(point, preparedBvhNodeBounds(shape, 0)),
    },
  ];
  const result: number[] = [];
  while (queue.length > 0) {
    queue.sort(
      (left, right) => left.lower - right.lower || left.node - right.node,
    );
    const candidate = queue.shift()!;
    if (candidate.lower > maximumDistance) break;
    const leaf = shape.record.bvh.triangle[candidate.node]!;
    if (leaf >= 0) {
      result.push(leaf);
      continue;
    }
    for (const child of bvhChildren(shape.record, candidate.node)) {
      queue.push({
        node: child,
        lower: pointAabbDistance(point, preparedBvhNodeBounds(shape, child)),
      });
    }
  }
  return result.sort(
    (left, right) =>
      shape.record.sourceTriangleIds[left]! -
      shape.record.sourceTriangleIds[right]!,
  );
}

function rayCandidateTriangles(
  shape: PreparedConcaveShape3D,
  origin: ArrayLike<number>,
  direction: ArrayLike<number>,
): readonly number[] {
  const rootEntry = rayAabbEntry(
    origin,
    direction,
    preparedBvhNodeBounds(shape, 0),
  );
  if (rootEntry === null) return [];
  const queue: Array<Readonly<{ node: number; entry: number }>> = [
    { node: 0, entry: rootEntry },
  ];
  const result: number[] = [];
  while (queue.length > 0) {
    queue.sort(
      (left, right) => left.entry - right.entry || left.node - right.node,
    );
    const candidate = queue.shift()!;
    const leaf = shape.record.bvh.triangle[candidate.node]!;
    if (leaf >= 0) {
      result.push(leaf);
      continue;
    }
    for (const child of bvhChildren(shape.record, candidate.node)) {
      const entry = rayAabbEntry(
        origin,
        direction,
        preparedBvhNodeBounds(shape, child),
      );
      if (entry !== null) queue.push({ node: child, entry });
    }
  }
  return result;
}

function pointInTriangle(
  point: ArrayLike<number>,
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  c: ArrayLike<number>,
  normal: ArrayLike<number>,
): boolean {
  const edges = [
    [a, b],
    [b, c],
    [c, a],
  ] as const;
  return edges.every(
    ([start, end]) =>
      dot3(cross3(subtract3(end, start), subtract3(point, start)), normal) >=
      -GEOMETRY_EPSILON_3D,
  );
}

function rayTriangleTime(
  origin: ArrayLike<number>,
  direction: ArrayLike<number>,
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  c: ArrayLike<number>,
): number | null {
  const edge1 = subtract3(b, a),
    edge2 = subtract3(c, a);
  const p = cross3(direction, edge2);
  const determinant = dot3(edge1, p);
  if (Math.abs(determinant) <= GEOMETRY_EPSILON_3D) return null;
  const inverse = 1 / determinant;
  const tvec = subtract3(origin, a);
  const u = dot3(tvec, p) * inverse;
  const q = cross3(tvec, edge1);
  const v = dot3(direction, q) * inverse;
  const time = dot3(edge2, q) * inverse;
  return u >= 0 && v >= 0 && u + v <= 1 && time > GEOMETRY_EPSILON_3D
    ? time
    : null;
}

function subtract3(
  left: ArrayLike<number>,
  right: ArrayLike<number>,
): [number, number, number] {
  return [left[0]! - right[0]!, left[1]! - right[1]!, left[2]! - right[2]!];
}

function cross3(
  left: ArrayLike<number>,
  right: ArrayLike<number>,
): [number, number, number] {
  return [
    left[1]! * right[2]! - left[2]! * right[1]!,
    left[2]! * right[0]! - left[0]! * right[2]!,
    left[0]! * right[1]! - left[1]! * right[0]!,
  ];
}

function dot3(left: ArrayLike<number>, right: ArrayLike<number>): number {
  return left[0]! * right[0]! + left[1]! * right[1]! + left[2]! * right[2]!;
}

function preparedMagnitude(shape: PreparedConvexShape3D): number {
  if (shape.kind === "sphere") return shape.radius;
  if (shape.kind === "box") return Math.max(...shape.halfExtents);
  if (shape.kind === "ellipsoid") return Math.max(...shape.radii);
  if (shape.kind === "cylinder" || shape.kind === "cone")
    return Math.max(shape.radius, shape.halfHeight);
  if (shape.kind === "capsule")
    return (
      Math.max(
        Math.hypot(
          shape.start[0]! - shape.center[0]!,
          shape.start[1]! - shape.center[1]!,
          shape.start[2]! - shape.center[2]!,
        ),
        Math.hypot(
          shape.end[0]! - shape.center[0]!,
          shape.end[1]! - shape.center[1]!,
          shape.end[2]! - shape.center[2]!,
        ),
      ) + shape.radius
    );
  let maximum = 0;
  for (let index = 0; index < shape.vertices.length; index += 3) {
    maximum = Math.max(
      maximum,
      Math.abs(shape.vertices[index]! - shape.center[0]!),
      Math.abs(shape.vertices[index + 1]! - shape.center[1]!),
      Math.abs(shape.vertices[index + 2]! - shape.center[2]!),
    );
  }
  return maximum;
}

function localPoint(
  center: ArrayLike<number>,
  axes: ArrayLike<number>,
  point: ArrayLike<number>,
): readonly [number, number, number] {
  const x = point[0]! - center[0]!;
  const y = point[1]! - center[1]!;
  const z = point[2]! - center[2]!;
  return [
    x * axes[0]! + y * axes[1]! + z * axes[2]!,
    x * axes[3]! + y * axes[4]! + z * axes[5]!,
    x * axes[6]! + y * axes[7]! + z * axes[8]!,
  ];
}

function pointSegmentDistanceSquared(
  point: ArrayLike<number>,
  start: ArrayLike<number>,
  end: ArrayLike<number>,
): number {
  const x = end[0]! - start[0]!;
  const y = end[1]! - start[1]!;
  const z = end[2]! - start[2]!;
  const denominator = x * x + y * y + z * z;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point[0]! - start[0]!) * x +
        (point[1]! - start[1]!) * y +
        (point[2]! - start[2]!) * z) /
        denominator,
    ),
  );
  const dx = point[0]! - (start[0]! + x * t);
  const dy = point[1]! - (start[1]! + y * t);
  const dz = point[2]! - (start[2]! + z * t);
  return dx * dx + dy * dy + dz * dz;
}

function vertex(
  values: Float64Array,
  index: number,
): readonly [number, number, number] {
  return [values[index * 3]!, values[index * 3 + 1]!, values[index * 3 + 2]!];
}

function signedTrianglePlane(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  c: ArrayLike<number>,
  point: ArrayLike<number>,
): number {
  const abx = b[0]! - a[0]!;
  const aby = b[1]! - a[1]!;
  const abz = b[2]! - a[2]!;
  const acx = c[0]! - a[0]!;
  const acy = c[1]! - a[1]!;
  const acz = c[2]! - a[2]!;
  return (
    (aby * acz - abz * acy) * (point[0]! - a[0]!) +
    (abz * acx - abx * acz) * (point[1]! - a[1]!) +
    (abx * acy - aby * acx) * (point[2]! - a[2]!)
  );
}

function compareArrays(
  first: ArrayLike<number>,
  second: ArrayLike<number>,
): number {
  for (let index = 0; index < first.length; index += 1) {
    if (first[index]! < second[index]!) return -1;
    if (first[index]! > second[index]!) return 1;
  }
  return 0;
}

function analyticToPrivate(
  distance: AnalyticDistance3D,
): PrivatePairDistance3D {
  return {
    separation: distance.separation,
    firstX: distance.first[0],
    firstY: distance.first[1],
    firstZ: distance.first[2],
    secondX: distance.second[0],
    secondY: distance.second[1],
    secondZ: distance.second[2],
    normalX: distance.normal[0],
    normalY: distance.normal[1],
    normalZ: distance.normal[2],
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

function invertDistance(
  distance: PrivatePairDistance3D,
): PrivatePairDistance3D {
  return {
    separation: distance.separation,
    firstX: distance.secondX,
    firstY: distance.secondY,
    firstZ: distance.secondZ,
    secondX: distance.firstX,
    secondY: distance.firstY,
    secondZ: distance.firstZ,
    normalX: -distance.normalX,
    normalY: -distance.normalY,
    normalZ: -distance.normalZ,
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
    pointOnFirst: freezeCollisionVector3(
      distance.firstX,
      distance.firstY,
      distance.firstZ,
    ),
    pointOnSecond: freezeCollisionVector3(
      distance.secondX,
      distance.secondY,
      distance.secondZ,
    ),
    normal: freezeCollisionVector3(
      distance.normalX,
      distance.normalY,
      distance.normalZ,
    ),
  });
}

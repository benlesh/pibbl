import type {
  CRCPhysicsPose3D,
  CRCPhysicsRay3D,
  CRCPhysicsShape3D,
  CRCPhysicsShapeHit3D,
  CRCPhysicsVector3,
} from "../../../3d-geometry.js";
import { requireNonnegativeNumber } from "../../shared/validation.js";
import {
  cleanZero,
  composePose3D,
  copyFiniteVector3,
  copyPose3D,
  transformPointInto,
  type InternalPose3D,
} from "../math.js";
import {
  GEOMETRY_EPSILON_3D,
  MAX_GJK_ITERATIONS_3D,
} from "../numeric-policy.js";
import {
  requireShapeRecord3D,
  type ConcaveShapeRecord3D,
} from "../shape-records.js";
import {
  castSphereAgainstBoxAnalytically,
  castSphereAgainstSphereAnalytically,
  raycastSphereAnalytically,
  type AnalyticCastCandidate3D,
} from "./analytic-casts.js";
import { distanceBetweenPreparedShapes3D } from "./pairs.js";
import {
  prepareConvexShape3D,
  type PreparedBox3D,
  type PreparedConvexShape3D,
} from "./support.js";

const CAST_REFINEMENT_ITERATIONS = 64;
const CAST_HIT_TOLERANCE = 1e-7;
const CAST_TIME_TOLERANCE = 1e-12;

type CastCandidate3D = AnalyticCastCandidate3D &
  Readonly<{
    triangleIndex?: number;
    barycentric?: readonly [number, number, number];
  }>;

function raycastPreparedConvex(
  shape: PreparedConvexShape3D,
  origin: ArrayLike<number>,
  direction: ArrayLike<number>,
  maxDistance: number,
): CastCandidate3D | null {
  if (shape.kind === "box")
    return raycastBox(shape, origin, direction, maxDistance);
  if (shape.kind === "ellipsoid") {
    const localOrigin = localPoint(shape.center, shape.axes, origin);
    const localDirection = localVector(shape.axes, direction);
    const ox = localOrigin[0] / shape.radii[0]!;
    const oy = localOrigin[1] / shape.radii[1]!;
    const oz = localOrigin[2] / shape.radii[2]!;
    const dx = localDirection[0] / shape.radii[0]!;
    const dy = localDirection[1] / shape.radii[1]!;
    const dz = localDirection[2] / shape.radii[2]!;
    const t = smallestQuadraticRoot(
      dx * dx + dy * dy + dz * dz,
      2 * (ox * dx + oy * dy + oz * dz),
      ox * ox + oy * oy + oz * oz - 1,
      maxDistance,
    );
    if (t === null) return null;
    const localHit = [
      localOrigin[0] + localDirection[0] * t,
      localOrigin[1] + localDirection[1] * t,
      localOrigin[2] + localDirection[2] * t,
    ] as const;
    return candidateAt(
      shape,
      origin,
      direction,
      t,
      [
        localHit[0] / shape.radii[0]! ** 2,
        localHit[1] / shape.radii[1]! ** 2,
        localHit[2] / shape.radii[2]! ** 2,
      ],
      maxDistance,
    );
  }
  if (shape.kind === "capsule")
    return raycastCapsule(shape, origin, direction, maxDistance);
  if (shape.kind === "hull")
    return raycastHull(shape, origin, direction, maxDistance);
  if (shape.kind === "sphere") return null;
  return raycastAxial(shape, origin, direction, maxDistance);
}

function raycastCapsule(
  shape: Extract<PreparedConvexShape3D, { kind: "capsule" }>,
  origin: ArrayLike<number>,
  direction: ArrayLike<number>,
  maxDistance: number,
): CastCandidate3D | null {
  const bax = shape.end[0]! - shape.start[0]!;
  const bay = shape.end[1]! - shape.start[1]!;
  const baz = shape.end[2]! - shape.start[2]!;
  const oax = origin[0]! - shape.start[0]!;
  const oay = origin[1]! - shape.start[1]!;
  const oaz = origin[2]! - shape.start[2]!;
  const baba = bax * bax + bay * bay + baz * baz;
  const bard = bax * direction[0]! + bay * direction[1]! + baz * direction[2]!;
  const baoa = bax * oax + bay * oay + baz * oaz;
  const rdoa = direction[0]! * oax + direction[1]! * oay + direction[2]! * oaz;
  const oaoa = oax * oax + oay * oay + oaz * oaz;
  const a = baba - bard * bard;
  const b = baba * rdoa - baoa * bard;
  const c = baba * oaoa - baoa * baoa - shape.radius ** 2 * baba;
  const roots: number[] = [];
  const discriminant = b * b - a * c;
  if (Math.abs(a) > GEOMETRY_EPSILON_3D && discriminant >= 0) {
    const t = (-b - Math.sqrt(discriminant)) / a;
    const y = baoa + t * bard;
    if (t >= 0 && t <= maxDistance && y >= 0 && y <= baba) roots.push(t);
  }
  for (const endpoint of [shape.start, shape.end]) {
    const ox = origin[0]! - endpoint[0]!;
    const oy = origin[1]! - endpoint[1]!;
    const oz = origin[2]! - endpoint[2]!;
    const t = smallestQuadraticRoot(
      1,
      2 * (ox * direction[0]! + oy * direction[1]! + oz * direction[2]!),
      ox * ox + oy * oy + oz * oz - shape.radius ** 2,
      maxDistance,
    );
    if (t !== null) roots.push(t);
  }
  if (roots.length === 0) return null;
  const t = Math.min(...roots);
  const hit = [
    origin[0]! + direction[0]! * t,
    origin[1]! + direction[1]! * t,
    origin[2]! + direction[2]! * t,
  ] as const;
  const projection = Math.max(
    0,
    Math.min(
      1,
      ((hit[0] - shape.start[0]!) * bax +
        (hit[1] - shape.start[1]!) * bay +
        (hit[2] - shape.start[2]!) * baz) /
        baba,
    ),
  );
  return worldCandidate(
    origin,
    direction,
    t,
    [
      hit[0] - (shape.start[0]! + bax * projection),
      hit[1] - (shape.start[1]! + bay * projection),
      hit[2] - (shape.start[2]! + baz * projection),
    ],
    maxDistance,
  );
}

function raycastAxial(
  shape: Extract<PreparedConvexShape3D, { kind: "cylinder" | "cone" }>,
  origin: ArrayLike<number>,
  direction: ArrayLike<number>,
  maxDistance: number,
): CastCandidate3D | null {
  const o = localPoint(shape.center, shape.axes, origin);
  const d = localVector(shape.axes, direction);
  const candidates: readonly [number, readonly [number, number, number]][] = [];
  const mutable = candidates as [number, readonly [number, number, number]][];
  if (shape.kind === "cylinder") {
    const a = d[0] ** 2 + d[2] ** 2;
    const b = 2 * (o[0] * d[0] + o[2] * d[2]);
    const c = o[0] ** 2 + o[2] ** 2 - shape.radius ** 2;
    for (const t of quadraticRoots(a, b, c)) {
      const y = o[1] + d[1] * t;
      if (
        t >= 0 &&
        t <= maxDistance &&
        y >= -shape.halfHeight &&
        y <= shape.halfHeight
      )
        mutable.push([t, [o[0] + d[0] * t, 0, o[2] + d[2] * t]]);
    }
  } else {
    const k = shape.radius / (2 * shape.halfHeight);
    const a = d[0] ** 2 + d[2] ** 2 - k ** 2 * d[1] ** 2;
    const b =
      2 *
      (o[0] * d[0] + o[2] * d[2] + k ** 2 * (shape.halfHeight - o[1]) * d[1]);
    const c = o[0] ** 2 + o[2] ** 2 - k ** 2 * (shape.halfHeight - o[1]) ** 2;
    for (const t of quadraticRoots(a, b, c)) {
      const y = o[1] + d[1] * t;
      if (
        t >= 0 &&
        t <= maxDistance &&
        y >= -shape.halfHeight &&
        y <= shape.halfHeight
      ) {
        const x = o[0] + d[0] * t,
          z = o[2] + d[2] * t;
        mutable.push([t, [x, k ** 2 * (shape.halfHeight - y), z]]);
      }
    }
  }
  if (Math.abs(d[1]) > GEOMETRY_EPSILON_3D) {
    for (const y of shape.kind === "cylinder"
      ? [-shape.halfHeight, shape.halfHeight]
      : [-shape.halfHeight]) {
      const t = (y - o[1]) / d[1];
      const x = o[0] + d[0] * t,
        z = o[2] + d[2] * t;
      if (
        t >= 0 &&
        t <= maxDistance &&
        x * x + z * z <= shape.radius ** 2 + GEOMETRY_EPSILON_3D
      )
        mutable.push([t, [0, y < 0 ? -1 : 1, 0]]);
    }
  }
  if (mutable.length === 0) return null;
  mutable.sort((left, right) => left[0] - right[0]);
  return candidateAt(
    shape,
    origin,
    direction,
    mutable[0]![0],
    mutable[0]![1],
    maxDistance,
  );
}

function raycastHull(
  shape: Extract<PreparedConvexShape3D, { kind: "hull" }>,
  origin: ArrayLike<number>,
  direction: ArrayLike<number>,
  maxDistance: number,
): CastCandidate3D | null {
  let enter = 0;
  let normal: readonly [number, number, number] = [
    -direction[0]!,
    -direction[1]!,
    -direction[2]!,
  ];
  for (let index = 0; index < shape.faces.length; index += 3) {
    const a = vertex(shape.vertices, shape.faces[index]!);
    const b = vertex(shape.vertices, shape.faces[index + 1]!);
    const c = vertex(shape.vertices, shape.faces[index + 2]!);
    const n = cross(subtract(b, a), subtract(c, a));
    const denominator = dot(n, direction);
    const numerator = dot(n, subtract(a, origin));
    if (Math.abs(denominator) <= GEOMETRY_EPSILON_3D) {
      if (numerator < 0) return null;
      continue;
    }
    const t = numerator / denominator;
    if (denominator < 0 && t > enter) {
      enter = t;
      normal = n;
    }
    if (denominator > 0 && t < enter) return null;
  }
  return enter <= maxDistance
    ? worldCandidate(origin, direction, enter, normal, maxDistance)
    : null;
}

function containsPreparedPoint(
  shape: PreparedConvexShape3D,
  point: ArrayLike<number>,
): boolean {
  if (shape.kind === "sphere")
    return (
      Math.hypot(
        point[0]! - shape.center[0]!,
        point[1]! - shape.center[1]!,
        point[2]! - shape.center[2]!,
      ) <= shape.radius
    );
  if (shape.kind === "box") return containsPreparedBoxPoint(shape, point);
  if (shape.kind === "capsule") {
    const ab = subtract(shape.end, shape.start);
    const ap = subtract(point, shape.start);
    const t = Math.max(0, Math.min(1, dot(ap, ab) / dot(ab, ab)));
    return (
      Math.hypot(
        point[0]! - (shape.start[0]! + ab[0] * t),
        point[1]! - (shape.start[1]! + ab[1] * t),
        point[2]! - (shape.start[2]! + ab[2] * t),
      ) <= shape.radius
    );
  }
  if (shape.kind === "hull")
    return shape.faces.every(
      (_, index) =>
        index % 3 !== 0 ||
        dot(
          cross(
            subtract(
              vertex(shape.vertices, shape.faces[index + 1]!),
              vertex(shape.vertices, shape.faces[index]!),
            ),
            subtract(
              vertex(shape.vertices, shape.faces[index + 2]!),
              vertex(shape.vertices, shape.faces[index]!),
            ),
          ),
          subtract(point, vertex(shape.vertices, shape.faces[index]!)),
        ) <= GEOMETRY_EPSILON_3D,
    );
  const local = localPoint(shape.center, shape.axes, point);
  if (shape.kind === "ellipsoid")
    return (
      (local[0] / shape.radii[0]!) ** 2 +
        (local[1] / shape.radii[1]!) ** 2 +
        (local[2] / shape.radii[2]!) ** 2 <=
      1
    );
  if (local[1] < -shape.halfHeight || local[1] > shape.halfHeight) return false;
  const radius =
    shape.kind === "cone"
      ? (shape.radius * (shape.halfHeight - local[1])) / (2 * shape.halfHeight)
      : shape.radius;
  return Math.hypot(local[0], local[2]) <= radius;
}

export function raycastShape3D(
  shape: CRCPhysicsShape3D,
  publicPose: CRCPhysicsPose3D,
  ray: CRCPhysicsRay3D,
  options?: Readonly<{ includeInitialOverlap?: boolean }>,
): CRCPhysicsShapeHit3D | null {
  const record = requireShapeRecord3D(shape);
  const pose = copyPose3D(publicPose, "pose");
  const origin = copyFiniteVector3(ray.origin, "ray.origin");
  const sourceDirection = copyFiniteVector3(ray.direction, "ray.direction");
  const scale = Math.max(
    Math.abs(sourceDirection[0]!),
    Math.abs(sourceDirection[1]!),
    Math.abs(sourceDirection[2]!),
  );
  if (scale === 0) throw new RangeError("ray.direction must be non-zero.");
  const maxDistance = requireNonnegativeNumber(
    ray.maxDistance,
    "ray.maxDistance",
  );
  const includeInitialOverlap = options?.includeInitialOverlap === true;
  const scaledX = sourceDirection[0]! / scale;
  const scaledY = sourceDirection[1]! / scale;
  const scaledZ = sourceDirection[2]! / scale;
  const scaledLength = Math.hypot(scaledX, scaledY, scaledZ);
  const direction = [
    scaledX / scaledLength,
    scaledY / scaledLength,
    scaledZ / scaledLength,
  ] as const;
  if (record.kind === "triangleMesh" || record.kind === "heightfield") {
    if (maxDistance === 0) return null;
    const candidate = raycastConcave(
      record,
      pose,
      origin,
      direction,
      maxDistance,
    );
    return candidate === null ? null : publicHit(candidate);
  }
  const prepared = prepareConvexShape3D(record, pose);
  if (prepared.kind === "sphere") {
    const candidate = raycastSphereAnalytically(
      prepared,
      origin,
      sourceDirection,
      maxDistance,
      includeInitialOverlap,
    );
    return candidate === null ? null : publicHit(candidate, true);
  }
  if (containsPreparedPoint(prepared, origin)) {
    return includeInitialOverlap
      ? publicHit({
          pointX: origin[0]!,
          pointY: origin[1]!,
          pointZ: origin[2]!,
          normalX: -direction[0],
          normalY: -direction[1],
          normalZ: -direction[2],
          distance: 0,
          timeOfImpact: 0,
        })
      : null;
  }
  if (maxDistance === 0) return null;
  const candidate = raycastPreparedConvex(
    prepared,
    origin,
    direction,
    maxDistance,
  );
  return candidate === null ? null : publicHit(candidate);
}

export function shapeCastAgainstShape3D(
  moving: CRCPhysicsShape3D,
  publicFrom: CRCPhysicsPose3D,
  publicTranslation: CRCPhysicsVector3,
  target: CRCPhysicsShape3D,
  publicTargetPose: CRCPhysicsPose3D,
  options?: Readonly<{ includeInitialOverlap?: boolean }>,
): CRCPhysicsShapeHit3D | null {
  const from = copyPose3D(publicFrom, "from");
  const translation = copyFiniteVector3(publicTranslation, "translation");
  const targetPose = copyPose3D(publicTargetPose, "targetPose");
  const movingRecord = requireShapeRecord3D(moving);
  const targetRecord = requireShapeRecord3D(target);
  if (
    movingRecord.kind === "triangleMesh" ||
    movingRecord.kind === "heightfield"
  ) {
    throw new TypeError("moving shape casts require a convex 3D shape.");
  }
  const movingPrepared = prepareConvexShape3D(movingRecord, from);
  const targetPrepared =
    targetRecord.kind === "triangleMesh" || targetRecord.kind === "heightfield"
      ? null
      : prepareConvexShape3D(targetRecord, targetPose);
  const includeInitialOverlap = options?.includeInitialOverlap === true;
  const exactAnalytic =
    movingPrepared.kind === "sphere" &&
    targetPrepared !== null &&
    (targetPrepared.kind === "sphere" || targetPrepared.kind === "box");
  let candidate: CastCandidate3D | null;
  if (movingPrepared.kind === "sphere" && targetPrepared?.kind === "sphere") {
    candidate = castSphereAgainstSphereAnalytically(
      movingPrepared,
      translation,
      targetPrepared,
      includeInitialOverlap,
    );
  } else if (
    movingPrepared.kind === "sphere" &&
    targetPrepared?.kind === "box"
  ) {
    candidate = castSphereAgainstBoxAnalytically(
      movingPrepared,
      translation,
      targetPrepared,
      includeInitialOverlap,
    );
  } else {
    const translationLength = Math.hypot(
      translation[0]!,
      translation[1]!,
      translation[2]!,
    );
    if (!Number.isFinite(translationLength)) return null;
    candidate = conservativelyCast(
      moving,
      from,
      translation,
      translationLength,
      target,
      targetPose,
      includeInitialOverlap,
    );
  }
  if (candidate === null) return null;
  if (
    targetRecord.kind === "triangleMesh" ||
    targetRecord.kind === "heightfield"
  ) {
    const metadata = closestTriangleMetadata(targetRecord, targetPose, [
      candidate.pointX,
      candidate.pointY,
      candidate.pointZ,
    ]);
    return publicHit({ ...candidate, ...metadata });
  }
  return publicHit(candidate, exactAnalytic);
}

function closestTriangleMetadata(
  record: ConcaveShapeRecord3D,
  outerPose: InternalPose3D,
  point: ArrayLike<number>,
): Readonly<{
  triangleIndex: number;
  barycentric: readonly [number, number, number];
}> {
  const pose = composePose3D(outerPose, record.localPose);
  let bestDistance = Infinity;
  let bestTriangle = Infinity;
  let bestBarycentric: readonly [number, number, number] = [1, 0, 0];
  for (
    let triangle = 0;
    triangle < record.sourceTriangleIds.length;
    triangle += 1
  ) {
    const a = new Float64Array(3),
      b = new Float64Array(3),
      c = new Float64Array(3);
    transformPointInto(
      a,
      record.triangles.subarray(triangle * 9, triangle * 9 + 3),
      pose,
    );
    transformPointInto(
      b,
      record.triangles.subarray(triangle * 9 + 3, triangle * 9 + 6),
      pose,
    );
    transformPointInto(
      c,
      record.triangles.subarray(triangle * 9 + 6, triangle * 9 + 9),
      pose,
    );
    const barycentric = barycentricCoordinates(point, a, b, c);
    const projected = [
      a[0]! * barycentric[0] + b[0]! * barycentric[1] + c[0]! * barycentric[2],
      a[1]! * barycentric[0] + b[1]! * barycentric[1] + c[1]! * barycentric[2],
      a[2]! * barycentric[0] + b[2]! * barycentric[1] + c[2]! * barycentric[2],
    ];
    const distance = Math.hypot(
      point[0]! - projected[0]!,
      point[1]! - projected[1]!,
      point[2]! - projected[2]!,
    );
    const sourceId = record.sourceTriangleIds[triangle]!;
    if (
      distance < bestDistance - GEOMETRY_EPSILON_3D ||
      (Math.abs(distance - bestDistance) <= GEOMETRY_EPSILON_3D &&
        sourceId < bestTriangle)
    ) {
      bestDistance = distance;
      bestTriangle = sourceId;
      bestBarycentric = barycentric;
    }
  }
  return { triangleIndex: bestTriangle, barycentric: bestBarycentric };
}

function barycentricCoordinates(
  point: ArrayLike<number>,
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  c: ArrayLike<number>,
): readonly [number, number, number] {
  const v0 = subtract(b, a),
    v1 = subtract(c, a),
    v2 = subtract(point, a);
  const d00 = dot(v0, v0),
    d01 = dot(v0, v1),
    d11 = dot(v1, v1),
    d20 = dot(v2, v0),
    d21 = dot(v2, v1);
  const denominator = d00 * d11 - d01 * d01;
  let v = (d11 * d20 - d01 * d21) / denominator;
  let w = (d00 * d21 - d01 * d20) / denominator;
  let u = 1 - v - w;
  u = Math.max(0, Math.min(1, u));
  v = Math.max(0, Math.min(1 - u, v));
  w = 1 - u - v;
  return [u, v, w];
}

function raycastConcave(
  record: ConcaveShapeRecord3D,
  outerPose: InternalPose3D,
  origin: ArrayLike<number>,
  direction: ArrayLike<number>,
  maxDistance: number,
): CastCandidate3D | null {
  const pose = composePose3D(outerPose, record.localPose);
  let best: CastCandidate3D | null = null;
  const stack = [0];
  while (stack.length > 0) {
    const node = stack.pop()!;
    const triangle = record.bvh.triangle[node]!;
    if (triangle >= 0) {
      const a = new Float64Array(3),
        b = new Float64Array(3),
        c = new Float64Array(3);
      transformPointInto(
        a,
        record.triangles.subarray(triangle * 9, triangle * 9 + 3),
        pose,
      );
      transformPointInto(
        b,
        record.triangles.subarray(triangle * 9 + 3, triangle * 9 + 6),
        pose,
      );
      transformPointInto(
        c,
        record.triangles.subarray(triangle * 9 + 6, triangle * 9 + 9),
        pose,
      );
      const hit = rayTriangle(origin, direction, maxDistance, a, b, c);
      if (hit !== null) {
        const sourceId = record.sourceTriangleIds[triangle]!;
        if (
          best === null ||
          hit.distance < best.distance - CAST_TIME_TOLERANCE ||
          (Math.abs(hit.distance - best.distance) <= CAST_TIME_TOLERANCE &&
            sourceId < best.triangleIndex!)
        ) {
          best = { ...hit, triangleIndex: sourceId };
        }
      }
      continue;
    }
    const left = record.bvh.left[node]!,
      right = record.bvh.right[node]!;
    if (right >= 0) stack.push(right);
    if (left >= 0) stack.push(left);
  }
  return best;
}

function rayTriangle(
  origin: ArrayLike<number>,
  direction: ArrayLike<number>,
  maxDistance: number,
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  c: ArrayLike<number>,
): CastCandidate3D | null {
  const edge1 = subtract(b, a),
    edge2 = subtract(c, a);
  const p = cross(direction, edge2);
  const determinant = dot(edge1, p);
  if (Math.abs(determinant) <= GEOMETRY_EPSILON_3D) return null;
  const inverse = 1 / determinant;
  const tvec = subtract(origin, a);
  const u = dot(tvec, p) * inverse;
  if (u < -GEOMETRY_EPSILON_3D || u > 1 + GEOMETRY_EPSILON_3D) return null;
  const q = cross(tvec, edge1);
  const v = dot(direction, q) * inverse;
  if (v < -GEOMETRY_EPSILON_3D || u + v > 1 + GEOMETRY_EPSILON_3D) return null;
  const distance = dot(edge2, q) * inverse;
  if (distance < 0 || distance > maxDistance) return null;
  let normal = cross(edge1, edge2);
  if (dot(normal, direction) > 0) normal = [-normal[0], -normal[1], -normal[2]];
  return {
    ...worldCandidate(origin, direction, distance, normal, maxDistance),
    barycentric: [1 - u - v, u, v],
  };
}

function raycastBox(
  box: PreparedBox3D,
  origin: ArrayLike<number>,
  direction: ArrayLike<number>,
  maxDistance: number,
): CastCandidate3D | null {
  const offsetX = origin[0]! - box.center[0]!;
  const offsetY = origin[1]! - box.center[1]!;
  const offsetZ = origin[2]! - box.center[2]!;
  let minimum = 0;
  let maximum = maxDistance;
  let selectedFace = Number.POSITIVE_INFINITY;
  for (let axis = 0; axis < 3; axis += 1) {
    const originLocal =
      offsetX * box.axes[axis * 3]! +
      offsetY * box.axes[axis * 3 + 1]! +
      offsetZ * box.axes[axis * 3 + 2]!;
    const directionLocal =
      direction[0]! * box.axes[axis * 3]! +
      direction[1]! * box.axes[axis * 3 + 1]! +
      direction[2]! * box.axes[axis * 3 + 2]!;
    if (Math.abs(directionLocal) <= GEOMETRY_EPSILON_3D) {
      if (Math.abs(originLocal) > box.halfExtents[axis]!) return null;
      continue;
    }
    let near = (-box.halfExtents[axis]! - originLocal) / directionLocal;
    let far = (box.halfExtents[axis]! - originLocal) / directionLocal;
    let nearSign = -1;
    if (near > far) {
      [near, far] = [far, near];
      nearSign = 1;
    }
    const face = axis * 2 + (nearSign > 0 ? 1 : 0);
    if (
      near > minimum + CAST_TIME_TOLERANCE ||
      (Math.abs(near - minimum) <= CAST_TIME_TOLERANCE && face < selectedFace)
    ) {
      minimum = near;
      selectedFace = face;
    }
    maximum = Math.min(maximum, far);
    if (minimum > maximum + CAST_TIME_TOLERANCE) return null;
  }
  if (
    minimum < -CAST_TIME_TOLERANCE ||
    minimum > maxDistance + CAST_TIME_TOLERANCE
  )
    return null;
  const distance = Math.max(0, Math.min(maxDistance, minimum));
  const axis = Math.floor(selectedFace / 2);
  const sign = (selectedFace & 1) === 0 ? -1 : 1;
  const normal = [
    sign * box.axes[axis * 3]!,
    sign * box.axes[axis * 3 + 1]!,
    sign * box.axes[axis * 3 + 2]!,
  ] as const;
  return {
    pointX: origin[0]! + direction[0]! * distance,
    pointY: origin[1]! + direction[1]! * distance,
    pointZ: origin[2]! + direction[2]! * distance,
    normalX: normal[0],
    normalY: normal[1],
    normalZ: normal[2],
    distance,
    timeOfImpact: distance / maxDistance,
  };
}

function localPoint(
  center: ArrayLike<number>,
  axes: ArrayLike<number>,
  point: ArrayLike<number>,
): readonly [number, number, number] {
  return localVector(axes, subtract(point, center));
}

function localVector(
  axes: ArrayLike<number>,
  vector: ArrayLike<number>,
): readonly [number, number, number] {
  return [
    axes[0]! * vector[0]! + axes[1]! * vector[1]! + axes[2]! * vector[2]!,
    axes[3]! * vector[0]! + axes[4]! * vector[1]! + axes[5]! * vector[2]!,
    axes[6]! * vector[0]! + axes[7]! * vector[1]! + axes[8]! * vector[2]!,
  ];
}

function candidateAt(
  shape: Extract<PreparedConvexShape3D, { axes: Float64Array }>,
  origin: ArrayLike<number>,
  direction: ArrayLike<number>,
  distance: number,
  localNormal: ArrayLike<number>,
  maxDistance: number,
): CastCandidate3D {
  const normal = [
    shape.axes[0]! * localNormal[0]! +
      shape.axes[3]! * localNormal[1]! +
      shape.axes[6]! * localNormal[2]!,
    shape.axes[1]! * localNormal[0]! +
      shape.axes[4]! * localNormal[1]! +
      shape.axes[7]! * localNormal[2]!,
    shape.axes[2]! * localNormal[0]! +
      shape.axes[5]! * localNormal[1]! +
      shape.axes[8]! * localNormal[2]!,
  ] as const;
  return worldCandidate(origin, direction, distance, normal, maxDistance);
}

function worldCandidate(
  origin: ArrayLike<number>,
  direction: ArrayLike<number>,
  distance: number,
  sourceNormal: ArrayLike<number>,
  maxDistance: number,
): CastCandidate3D {
  const length = Math.hypot(
    sourceNormal[0]!,
    sourceNormal[1]!,
    sourceNormal[2]!,
  );
  const normal =
    length > 0
      ? [
          sourceNormal[0]! / length,
          sourceNormal[1]! / length,
          sourceNormal[2]! / length,
        ]
      : [-direction[0]!, -direction[1]!, -direction[2]!];
  return {
    pointX: origin[0]! + direction[0]! * distance,
    pointY: origin[1]! + direction[1]! * distance,
    pointZ: origin[2]! + direction[2]! * distance,
    normalX: normal[0]!,
    normalY: normal[1]!,
    normalZ: normal[2]!,
    distance,
    timeOfImpact: Number.isFinite(maxDistance) ? distance / maxDistance : 0,
  };
}

function quadraticRoots(a: number, b: number, c: number): number[] {
  if (Math.abs(a) <= GEOMETRY_EPSILON_3D)
    return Math.abs(b) <= GEOMETRY_EPSILON_3D ? [] : [-c / b];
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return [];
  const root = Math.sqrt(discriminant);
  return [(-b - root) / (2 * a), (-b + root) / (2 * a)];
}

function smallestQuadraticRoot(
  a: number,
  b: number,
  c: number,
  maximum: number,
): number | null {
  const roots = quadraticRoots(a, b, c).filter(
    (value) => value >= 0 && value <= maximum,
  );
  return roots.length === 0 ? null : Math.min(...roots);
}

function vertex(
  values: Float64Array,
  index: number,
): readonly [number, number, number] {
  return [values[index * 3]!, values[index * 3 + 1]!, values[index * 3 + 2]!];
}

function subtract(
  left: ArrayLike<number>,
  right: ArrayLike<number>,
): readonly [number, number, number] {
  return [left[0]! - right[0]!, left[1]! - right[1]!, left[2]! - right[2]!];
}

function cross(
  left: ArrayLike<number>,
  right: ArrayLike<number>,
): readonly [number, number, number] {
  return [
    left[1]! * right[2]! - left[2]! * right[1]!,
    left[2]! * right[0]! - left[0]! * right[2]!,
    left[0]! * right[1]! - left[1]! * right[0]!,
  ];
}

function conservativelyCast(
  moving: CRCPhysicsShape3D,
  from: InternalPose3D,
  translation: ArrayLike<number>,
  translationLength: number,
  target: CRCPhysicsShape3D,
  targetPose: InternalPose3D,
  includeInitialOverlap: boolean,
): CastCandidate3D | null {
  let time = 0;
  let separatedTime = 0;
  for (let iteration = 0; iteration < MAX_GJK_ITERATIONS_3D; iteration += 1) {
    const distance = sampleTranslatedDistance(
      moving,
      from,
      translation,
      time,
      target,
      targetPose,
    );
    if (distance === null) return null;
    if (distance.separation <= 0) {
      if (time === 0 && !includeInitialOverlap) return null;
      if (time === 0) {
        const normal = unitAgainstMotion(
          distance.normal[0],
          distance.normal[1],
          distance.normal[2],
          translation,
        );
        return candidateFromDistance(distance, normal, translationLength, time);
      }
      return refineCrossing(
        moving,
        from,
        translation,
        translationLength,
        target,
        targetPose,
        separatedTime,
        time,
        distance,
      );
    }
    if (translationLength === 0) return null;
    if (distance.separation <= CAST_HIT_TOLERANCE) break;
    const closingSpeed = -(
      distance.normal[0] * translation[0]! +
      distance.normal[1] * translation[1]! +
      distance.normal[2] * translation[2]!
    );
    if (!Number.isFinite(closingSpeed) || closingSpeed <= 0) break;
    const step = distance.separation / closingSpeed;
    if (!Number.isFinite(step) || step <= CAST_TIME_TOLERANCE) break;
    const nextTime = time + step;
    if (
      !Number.isFinite(nextTime) ||
      nextTime <= time ||
      nextTime > 1 + CAST_TIME_TOLERANCE
    )
      break;
    separatedTime = time;
    time = Math.min(1, nextTime);
  }
  return refineBoundedTangent(
    moving,
    from,
    translation,
    translationLength,
    target,
    targetPose,
  );
}

function refineBoundedTangent(
  moving: CRCPhysicsShape3D,
  from: InternalPose3D,
  translation: ArrayLike<number>,
  translationLength: number,
  target: CRCPhysicsShape3D,
  targetPose: InternalPose3D,
): CastCandidate3D | null {
  let minimumTime = 0;
  let maximumTime = 1;
  let tangentTime = 0;
  let tangent = sampleTranslatedDistance(
    moving,
    from,
    translation,
    tangentTime,
    target,
    targetPose,
  );
  if (tangent === null) return null;
  for (
    let iteration = 0;
    iteration < CAST_REFINEMENT_ITERATIONS;
    iteration += 1
  ) {
    const middleTime = (minimumTime + maximumTime) / 2;
    const middle = sampleTranslatedDistance(
      moving,
      from,
      translation,
      middleTime,
      target,
      targetPose,
    );
    if (middle === null) return null;
    if (
      middle.separation < tangent.separation ||
      (middle.separation === tangent.separation && middleTime < tangentTime)
    ) {
      tangentTime = middleTime;
      tangent = middle;
    }
    const derivative =
      middle.normal[0] * translation[0]! +
      middle.normal[1] * translation[1]! +
      middle.normal[2] * translation[2]!;
    if (!Number.isFinite(derivative)) return null;
    if (derivative < 0) minimumTime = middleTime;
    else maximumTime = middleTime;
  }
  if (tangent.separation > GEOMETRY_EPSILON_3D) return null;
  let impactTime = tangentTime;
  if (tangent.separation < -GEOMETRY_EPSILON_3D) {
    let separatedTime = 0;
    for (
      let iteration = 0;
      iteration < CAST_REFINEMENT_ITERATIONS;
      iteration += 1
    ) {
      const middleTime = (separatedTime + impactTime) / 2;
      const middle = sampleTranslatedDistance(
        moving,
        from,
        translation,
        middleTime,
        target,
        targetPose,
      );
      if (middle === null) return null;
      if (middle.separation <= 0) {
        impactTime = middleTime;
        tangent = middle;
      } else {
        separatedTime = middleTime;
      }
    }
  }
  const normal = unitAgainstMotion(
    tangent.normal[0],
    tangent.normal[1],
    tangent.normal[2],
    translation,
  );
  return candidateFromDistance(tangent, normal, translationLength, impactTime);
}

function refineCrossing(
  moving: CRCPhysicsShape3D,
  from: InternalPose3D,
  translation: ArrayLike<number>,
  translationLength: number,
  target: CRCPhysicsShape3D,
  targetPose: InternalPose3D,
  initialSeparatedTime: number,
  initialImpactTime: number,
  initialImpact: ReturnType<typeof distanceBetweenPreparedShapes3D>,
): CastCandidate3D | null {
  let separatedTime = initialSeparatedTime;
  let impactTime = initialImpactTime;
  let impact = initialImpact;
  for (
    let iteration = 0;
    iteration < CAST_REFINEMENT_ITERATIONS;
    iteration += 1
  ) {
    const middleTime = (separatedTime + impactTime) / 2;
    const middle = sampleTranslatedDistance(
      moving,
      from,
      translation,
      middleTime,
      target,
      targetPose,
    );
    if (middle === null) return null;
    if (middle.separation <= 0) {
      impactTime = middleTime;
      impact = middle;
    } else {
      separatedTime = middleTime;
    }
  }
  const normal = unitAgainstMotion(
    impact.normal[0],
    impact.normal[1],
    impact.normal[2],
    translation,
  );
  return candidateFromDistance(impact, normal, translationLength, impactTime);
}

function sampleTranslatedDistance(
  moving: CRCPhysicsShape3D,
  from: InternalPose3D,
  translation: ArrayLike<number>,
  time: number,
  target: CRCPhysicsShape3D,
  targetPose: InternalPose3D,
): ReturnType<typeof distanceBetweenPreparedShapes3D> | null {
  try {
    const distance = distanceBetweenPreparedShapes3D(
      moving,
      internalPoseAsPublic({
        position: new Float64Array([
          from.position[0]! + translation[0]! * time,
          from.position[1]! + translation[1]! * time,
          from.position[2]! + translation[2]! * time,
        ]),
        orientation: from.orientation,
      }),
      target,
      internalPoseAsPublic(targetPose),
    );
    return isFiniteDistance(distance) ? distance : null;
  } catch {
    return null;
  }
}

function candidateFromDistance(
  distance: ReturnType<typeof distanceBetweenPreparedShapes3D>,
  normal: readonly [number, number, number],
  translationLength: number,
  timeOfImpact: number,
): CastCandidate3D {
  return {
    pointX: distance.pointOnSecond[0],
    pointY: distance.pointOnSecond[1],
    pointZ: distance.pointOnSecond[2],
    normalX: normal[0],
    normalY: normal[1],
    normalZ: normal[2],
    distance: translationLength * timeOfImpact,
    timeOfImpact,
  };
}

function containsPreparedBoxPoint(
  shape: PreparedBox3D,
  point: ArrayLike<number>,
): boolean {
  const dx = point[0]! - shape.center[0]!;
  const dy = point[1]! - shape.center[1]!;
  const dz = point[2]! - shape.center[2]!;
  for (let axis = 0; axis < 3; axis += 1) {
    const local =
      dx * shape.axes[axis * 3]! +
      dy * shape.axes[axis * 3 + 1]! +
      dz * shape.axes[axis * 3 + 2]!;
    if (Math.abs(local) > shape.halfExtents[axis]! + GEOMETRY_EPSILON_3D)
      return false;
  }
  return true;
}

function unitAgainstMotion(
  x: number,
  y: number,
  z: number,
  motion: ArrayLike<number>,
): readonly [number, number, number] {
  const length = Math.hypot(x, y, z);
  if (Number.isFinite(length) && length > 0) {
    const unit = [x / length, y / length, z / length] as const;
    return dot(unit, motion) > 0 ? [-unit[0], -unit[1], -unit[2]] : unit;
  }
  const motionLength = Math.hypot(motion[0]!, motion[1]!, motion[2]!);
  return Number.isFinite(motionLength) && motionLength > 0
    ? [
        -motion[0]! / motionLength,
        -motion[1]! / motionLength,
        -motion[2]! / motionLength,
      ]
    : [1, 0, 0];
}

function internalPoseAsPublic(pose: InternalPose3D): CRCPhysicsPose3D {
  return {
    position: [pose.position[0]!, pose.position[1]!, pose.position[2]!],
    orientation: [
      pose.orientation[0]!,
      pose.orientation[1]!,
      pose.orientation[2]!,
      pose.orientation[3]!,
    ],
  };
}

function isFiniteDistance(
  distance: ReturnType<typeof distanceBetweenPreparedShapes3D>,
): boolean {
  return [
    distance.separation,
    ...distance.pointOnFirst,
    ...distance.pointOnSecond,
    ...distance.normal,
  ].every(Number.isFinite);
}

function publicHit(
  candidate: CastCandidate3D,
  preserveExactScale = false,
): CRCPhysicsShapeHit3D | null {
  if (
    ![
      candidate.pointX,
      candidate.pointY,
      candidate.pointZ,
      candidate.normalX,
      candidate.normalY,
      candidate.normalZ,
      candidate.distance,
      candidate.timeOfImpact,
    ].every(Number.isFinite)
  )
    return null;
  return Object.freeze({
    point: freezeCastVector3(
      candidate.pointX,
      candidate.pointY,
      candidate.pointZ,
      preserveExactScale,
    ),
    normal: freezeCastVector3(
      candidate.normalX,
      candidate.normalY,
      candidate.normalZ,
      preserveExactScale,
    ),
    distance: cleanZero(candidate.distance),
    timeOfImpact: cleanZero(candidate.timeOfImpact),
    ...(candidate.triangleIndex === undefined
      ? {}
      : { triangleIndex: candidate.triangleIndex }),
    ...(candidate.barycentric === undefined
      ? {}
      : {
          barycentric: Object.freeze(
            candidate.barycentric.map(cleanZero),
          ) as CRCPhysicsVector3,
        }),
  });
}

function freezeCastVector3(
  x: number,
  y: number,
  z: number,
  preserveExactScale: boolean,
): CRCPhysicsVector3 {
  const clean = preserveExactScale
    ? cleanZero
    : (value: number): number =>
        Math.abs(value) <= Number.EPSILON ? 0 : value;
  return Object.freeze([clean(x), clean(y), clean(z)] as const);
}

function dot(first: ArrayLike<number>, second: ArrayLike<number>): number {
  return (
    first[0]! * second[0]! + first[1]! * second[1]! + first[2]! * second[2]!
  );
}

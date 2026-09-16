import type {
  CRCPhysicsAabb3D,
  CRCPhysicsMassProperties3D,
  CRCPhysicsPose3D,
  CRCPhysicsQuaternion,
  CRCPhysicsShape3D,
  CRCPhysicsTransform3D,
  CRCPhysicsVector3,
} from "../../3d-geometry.js";
import { requirePositiveNumber } from "../shared/validation.js";
import {
  IDENTITY_POSE_3D,
  cleanZero,
  composePose3D,
  copyCanonicalQuaternion,
  copyFiniteVector3,
  copyPose3D,
  freezeVector3,
  rotateDiagonalTensor,
  rotationMatrixInto,
  transformPointInto,
  type InternalPose3D,
} from "./math.js";
import {
  createShape3D,
  requireShapeRecord3D,
  type ShapeRecord3D,
} from "./shape-records.js";

const identityQuaternion: CRCPhysicsQuaternion = [0, 0, 0, 1];
const zeroVector: CRCPhysicsVector3 = [0, 0, 0];

export function sphereShape3D(
  input: Readonly<{
    radius: number;
    center?: CRCPhysicsVector3;
  }>,
): CRCPhysicsShape3D {
  return createShape3D({
    kind: "sphere",
    center: copyFiniteVector3(input.center ?? zeroVector, "sphere.center"),
    radius: requirePositiveNumber(input.radius, "sphere.radius"),
    localPose: IDENTITY_POSE_3D,
  });
}

export function boxShape3D(
  input: Readonly<{
    width: number;
    height: number;
    depth: number;
    center?: CRCPhysicsVector3;
    orientation?: CRCPhysicsQuaternion;
  }>,
): CRCPhysicsShape3D {
  const width = requirePositiveNumber(input.width, "box.width");
  const height = requirePositiveNumber(input.height, "box.height");
  const depth = requirePositiveNumber(input.depth, "box.depth");
  return createShape3D({
    kind: "box",
    center: copyFiniteVector3(input.center ?? zeroVector, "box.center"),
    orientation: copyCanonicalQuaternion(
      input.orientation ?? identityQuaternion,
      "box.orientation",
    ),
    halfExtents: new Float64Array([width / 2, height / 2, depth / 2]),
    localPose: IDENTITY_POSE_3D,
  });
}

export function boundsOfShape3D(
  shape: CRCPhysicsShape3D,
  pose?: CRCPhysicsPose3D,
): CRCPhysicsAabb3D {
  const record = requireShapeRecord3D(shape);
  const worldPose = composePose3D(copyPose3D(pose, "pose"), record.localPose);
  const center = new Float64Array(3);
  transformPointInto(center, record.center, worldPose);

  if (record.kind === "sphere") {
    return freezeBounds3D(
      center[0]! - record.radius,
      center[1]! - record.radius,
      center[2]! - record.radius,
      center[0]! + record.radius,
      center[1]! + record.radius,
      center[2]! + record.radius,
    );
  }

  const orientationPose = poseFor(record.center, record.orientation);
  const worldBoxPose = composePose3D(worldPose, orientationPose);
  transformPointInto(center, zeroVector, worldBoxPose);
  const rotation = new Float64Array(9);
  rotationMatrixInto(rotation, worldBoxPose.orientation);
  const extentX =
    Math.abs(rotation[0]!) * record.halfExtents[0]! +
    Math.abs(rotation[1]!) * record.halfExtents[1]! +
    Math.abs(rotation[2]!) * record.halfExtents[2]!;
  const extentY =
    Math.abs(rotation[3]!) * record.halfExtents[0]! +
    Math.abs(rotation[4]!) * record.halfExtents[1]! +
    Math.abs(rotation[5]!) * record.halfExtents[2]!;
  const extentZ =
    Math.abs(rotation[6]!) * record.halfExtents[0]! +
    Math.abs(rotation[7]!) * record.halfExtents[1]! +
    Math.abs(rotation[8]!) * record.halfExtents[2]!;
  return freezeBounds3D(
    center[0]! - extentX,
    center[1]! - extentY,
    center[2]! - extentZ,
    center[0]! + extentX,
    center[1]! + extentY,
    center[2]! + extentZ,
  );
}

export function massProperties3D(
  shape: CRCPhysicsShape3D,
  options?: Readonly<{ density?: number }>,
): CRCPhysicsMassProperties3D {
  const record = requireShapeRecord3D(shape);
  const density = requirePositiveNumber(
    options?.density ?? 1,
    "options.density",
  );
  const center = new Float64Array(3);
  transformPointInto(center, record.center, record.localPose);

  if (record.kind === "sphere") {
    const volume = (4 * Math.PI * record.radius ** 3) / 3;
    const mass = volume * density;
    const inertia = (2 * mass * record.radius ** 2) / 5;
    return freezeMassProperties(
      volume,
      center,
      mass,
      rotateDiagonalTensor(
        inertia,
        inertia,
        inertia,
        record.localPose.orientation,
      ),
    );
  }

  const width = record.halfExtents[0]! * 2;
  const height = record.halfExtents[1]! * 2;
  const depth = record.halfExtents[2]! * 2;
  const volume = width * height * depth;
  const mass = volume * density;
  const orientation = composePose3D(
    record.localPose,
    poseFor(zeroVector, record.orientation),
  ).orientation;
  return freezeMassProperties(
    volume,
    center,
    mass,
    rotateDiagonalTensor(
      (mass * (height ** 2 + depth ** 2)) / 12,
      (mass * (width ** 2 + depth ** 2)) / 12,
      (mass * (width ** 2 + height ** 2)) / 12,
      orientation,
    ),
  );
}

export function transformShape3D(
  shape: CRCPhysicsShape3D,
  transform: CRCPhysicsTransform3D,
): CRCPhysicsShape3D {
  const source = requireShapeRecord3D(shape);
  rejectScale(transform);
  const localPose = composePose3D(
    copyPose3D(transform, "transform"),
    source.localPose,
  );
  return createShape3D({ ...source, localPose } as ShapeRecord3D);
}

function poseFor(
  position: ArrayLike<number>,
  orientation: Float64Array,
): InternalPose3D {
  return Object.freeze({
    position:
      position instanceof Float64Array
        ? position
        : new Float64Array([position[0]!, position[1]!, position[2]!]),
    orientation,
  });
}

function freezeBounds3D(
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): CRCPhysicsAabb3D {
  return Object.freeze({
    min: freezeVector3(minX, minY, minZ),
    max: freezeVector3(maxX, maxY, maxZ),
  });
}

function freezeMassProperties(
  volume: number,
  center: Float64Array,
  mass: number,
  inertiaTensor: CRCPhysicsMassProperties3D["inertiaTensor"],
): CRCPhysicsMassProperties3D {
  return Object.freeze({
    volume: cleanZero(volume),
    centerOfMass: freezeVector3(center[0]!, center[1]!, center[2]!),
    mass: cleanZero(mass),
    inertiaTensor,
  });
}

function rejectScale(transform: CRCPhysicsTransform3D): void {
  const candidate = transform as unknown as Record<string, unknown>;
  if (
    "scale" in candidate ||
    "scaleX" in candidate ||
    "scaleY" in candidate ||
    "scaleZ" in candidate
  ) {
    throw new TypeError("transform must not contain scale.");
  }
}

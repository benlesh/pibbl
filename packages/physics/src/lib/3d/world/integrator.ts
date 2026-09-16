import {
  copyCanonicalQuaternion,
  rotationMatrixInto,
  transformPointInto,
  type InternalPose3D,
} from "../math.js";
import { shapeForRecord3D, type ShapeRecord3D } from "../shape-records.js";
import { massProperties3D } from "../shapes.js";
import {
  BODY_ENABLED_3D,
  BODY_TYPE_DYNAMIC_3D,
  BODY_TYPE_KINEMATIC_3D,
  BODY_TYPE_MASK_3D,
  type BodyStore3D,
} from "./storage.js";

export const AXIS_LOCK_X_3D = 1 << 0;
export const AXIS_LOCK_Y_3D = 1 << 1;
export const AXIS_LOCK_Z_3D = 1 << 2;

export interface CompoundColliderMassInput3D {
  readonly shape: ShapeRecord3D;
  readonly position: readonly [number, number, number];
  readonly orientation: readonly [number, number, number, number];
  readonly density: number;
  readonly contributesToMass: boolean;
}

export interface CompoundMassProperties3D {
  readonly mass: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly centerZ: number;
  readonly inertiaXX: number;
  readonly inertiaYY: number;
  readonly inertiaZZ: number;
  readonly inertiaXY: number;
  readonly inertiaXZ: number;
  readonly inertiaYZ: number;
  readonly inverseMass: number;
  readonly inverseInertiaXX: number;
  readonly inverseInertiaYY: number;
  readonly inverseInertiaZZ: number;
  readonly inverseInertiaXY: number;
  readonly inverseInertiaXZ: number;
  readonly inverseInertiaYZ: number;
}

interface WeightedShapeMass3D {
  readonly mass: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly centerZ: number;
  readonly inertiaXX: number;
  readonly inertiaYY: number;
  readonly inertiaZZ: number;
  readonly inertiaXY: number;
  readonly inertiaXZ: number;
  readonly inertiaYZ: number;
}

export function applyForceAtPointToCandidateBody3D(
  bodies: BodyStore3D,
  bodyIndex: number,
  bodyGeneration: number,
  forceX: number,
  forceY: number,
  forceZ: number,
  pointX: number,
  pointY: number,
  pointZ: number,
): boolean {
  if (!bodies.has(bodyIndex, bodyGeneration)) return false;
  if (!isDynamicBody(bodies, bodyIndex)) return true;
  bodies.forceX[bodyIndex] += forceX;
  bodies.forceY[bodyIndex] += forceY;
  bodies.forceZ[bodyIndex] += forceZ;
  const offsetX = pointX - bodies.positionX[bodyIndex]!;
  const offsetY = pointY - bodies.positionY[bodyIndex]!;
  const offsetZ = pointZ - bodies.positionZ[bodyIndex]!;
  bodies.torqueX[bodyIndex] += offsetY * forceZ - offsetZ * forceY;
  bodies.torqueY[bodyIndex] += offsetZ * forceX - offsetX * forceZ;
  bodies.torqueZ[bodyIndex] += offsetX * forceY - offsetY * forceX;
  return true;
}

export function applyTorqueToCandidateBody3D(
  bodies: BodyStore3D,
  bodyIndex: number,
  bodyGeneration: number,
  torqueX: number,
  torqueY: number,
  torqueZ: number,
): boolean {
  if (!bodies.has(bodyIndex, bodyGeneration)) return false;
  if (!isDynamicBody(bodies, bodyIndex)) return true;
  bodies.torqueX[bodyIndex] += torqueX;
  bodies.torqueY[bodyIndex] += torqueY;
  bodies.torqueZ[bodyIndex] += torqueZ;
  return true;
}

export function applyImpulseAtPointToCandidateBody3D(
  bodies: BodyStore3D,
  bodyIndex: number,
  bodyGeneration: number,
  impulseX: number,
  impulseY: number,
  impulseZ: number,
  pointX: number,
  pointY: number,
  pointZ: number,
): boolean {
  if (!bodies.has(bodyIndex, bodyGeneration)) return false;
  if (!isDynamicBody(bodies, bodyIndex)) return true;
  const inverseMass = bodies.inverseMass[bodyIndex]!;
  const translationLocks = bodies.translationLocks[bodyIndex]!;
  if ((translationLocks & AXIS_LOCK_X_3D) === 0) {
    bodies.linearVelocityX[bodyIndex] += impulseX * inverseMass;
  }
  if ((translationLocks & AXIS_LOCK_Y_3D) === 0) {
    bodies.linearVelocityY[bodyIndex] += impulseY * inverseMass;
  }
  if ((translationLocks & AXIS_LOCK_Z_3D) === 0) {
    bodies.linearVelocityZ[bodyIndex] += impulseZ * inverseMass;
  }
  const offsetX = pointX - bodies.positionX[bodyIndex]!;
  const offsetY = pointY - bodies.positionY[bodyIndex]!;
  const offsetZ = pointZ - bodies.positionZ[bodyIndex]!;
  const angularImpulseX = offsetY * impulseZ - offsetZ * impulseY;
  const angularImpulseY = offsetZ * impulseX - offsetX * impulseZ;
  const angularImpulseZ = offsetX * impulseY - offsetY * impulseX;
  const worldInverseInertia = new Float64Array(9);
  const rotation = new Float64Array(9);
  writeWorldInverseInertia3D(
    bodies,
    bodyIndex,
    worldInverseInertia,
    0,
    rotation,
  );
  bodies.angularVelocityX[bodyIndex] +=
    worldInverseInertia[0]! * angularImpulseX +
    worldInverseInertia[1]! * angularImpulseY +
    worldInverseInertia[2]! * angularImpulseZ;
  bodies.angularVelocityY[bodyIndex] +=
    worldInverseInertia[3]! * angularImpulseX +
    worldInverseInertia[4]! * angularImpulseY +
    worldInverseInertia[5]! * angularImpulseZ;
  bodies.angularVelocityZ[bodyIndex] +=
    worldInverseInertia[6]! * angularImpulseX +
    worldInverseInertia[7]! * angularImpulseY +
    worldInverseInertia[8]! * angularImpulseZ;
  projectLockedAngularVelocity(bodies, bodyIndex, rotation);
  return true;
}

export function integrateCandidateBodies3D(
  bodies: BodyStore3D,
  bodyIndices: Int32Array,
  bodyCount: number,
  gravityX: number,
  gravityY: number,
  gravityZ: number,
  dt: number,
): void {
  if (!Number.isFinite(dt) || dt < 0) {
    throw new RangeError("integration dt must be finite and nonnegative.");
  }
  const worldInverseInertia = new Float64Array(9);
  const rotation = new Float64Array(9);
  const orientation = new Float64Array(4);
  for (let offset = 0; offset < bodyCount; offset += 1) {
    const bodyIndex = bodyIndices[offset]!;
    const type = bodies.flags[bodyIndex]! & BODY_TYPE_MASK_3D;
    if (type === BODY_TYPE_DYNAMIC_3D) {
      integrateDynamicVelocity(
        bodies,
        bodyIndex,
        gravityX,
        gravityY,
        gravityZ,
        dt,
        worldInverseInertia,
        rotation,
      );
      integratePose(bodies, bodyIndex, dt, orientation);
    } else if (type === BODY_TYPE_KINEMATIC_3D) {
      enforceTranslationLocks(bodies, bodyIndex);
      projectLockedAngularVelocity(bodies, bodyIndex, rotation);
      integratePose(bodies, bodyIndex, dt, orientation);
    }
    bodies.forceX[bodyIndex] = 0;
    bodies.forceY[bodyIndex] = 0;
    bodies.forceZ[bodyIndex] = 0;
    bodies.torqueX[bodyIndex] = 0;
    bodies.torqueY[bodyIndex] = 0;
    bodies.torqueZ[bodyIndex] = 0;
  }
}

export function writeWorldInverseInertia3D(
  bodies: BodyStore3D,
  bodyIndex: number,
  output: Float64Array,
  outputOffset: number,
  rotationScratch?: Float64Array,
): void {
  const rotation = rotationScratch ?? new Float64Array(9);
  writeRotationMatrixFromComponents(
    rotation,
    bodies.orientationX[bodyIndex]!,
    bodies.orientationY[bodyIndex]!,
    bodies.orientationZ[bodyIndex]!,
    bodies.orientationW[bodyIndex]!,
  );
  let xx = bodies.localInverseInertiaXX[bodyIndex]!;
  let yy = bodies.localInverseInertiaYY[bodyIndex]!;
  let zz = bodies.localInverseInertiaZZ[bodyIndex]!;
  let xy = bodies.localInverseInertiaXY[bodyIndex]!;
  let xz = bodies.localInverseInertiaXZ[bodyIndex]!;
  let yz = bodies.localInverseInertiaYZ[bodyIndex]!;
  const locks = bodies.rotationLocks[bodyIndex]!;
  if ((locks & AXIS_LOCK_X_3D) !== 0) {
    xx = 0;
    xy = 0;
    xz = 0;
  }
  if ((locks & AXIS_LOCK_Y_3D) !== 0) {
    yy = 0;
    xy = 0;
    yz = 0;
  }
  if ((locks & AXIS_LOCK_Z_3D) !== 0) {
    zz = 0;
    xz = 0;
    yz = 0;
  }
  const m00 = rotation[0]! * xx + rotation[1]! * xy + rotation[2]! * xz;
  const m01 = rotation[0]! * xy + rotation[1]! * yy + rotation[2]! * yz;
  const m02 = rotation[0]! * xz + rotation[1]! * yz + rotation[2]! * zz;
  const m10 = rotation[3]! * xx + rotation[4]! * xy + rotation[5]! * xz;
  const m11 = rotation[3]! * xy + rotation[4]! * yy + rotation[5]! * yz;
  const m12 = rotation[3]! * xz + rotation[4]! * yz + rotation[5]! * zz;
  const m20 = rotation[6]! * xx + rotation[7]! * xy + rotation[8]! * xz;
  const m21 = rotation[6]! * xy + rotation[7]! * yy + rotation[8]! * yz;
  const m22 = rotation[6]! * xz + rotation[7]! * yz + rotation[8]! * zz;
  output[outputOffset] = cleanArithmeticZero(
    m00 * rotation[0]! + m01 * rotation[1]! + m02 * rotation[2]!,
  );
  output[outputOffset + 1] = cleanArithmeticZero(
    m00 * rotation[3]! + m01 * rotation[4]! + m02 * rotation[5]!,
  );
  output[outputOffset + 2] = cleanArithmeticZero(
    m00 * rotation[6]! + m01 * rotation[7]! + m02 * rotation[8]!,
  );
  output[outputOffset + 3] = cleanArithmeticZero(
    m10 * rotation[0]! + m11 * rotation[1]! + m12 * rotation[2]!,
  );
  output[outputOffset + 4] = cleanArithmeticZero(
    m10 * rotation[3]! + m11 * rotation[4]! + m12 * rotation[5]!,
  );
  output[outputOffset + 5] = cleanArithmeticZero(
    m10 * rotation[6]! + m11 * rotation[7]! + m12 * rotation[8]!,
  );
  output[outputOffset + 6] = cleanArithmeticZero(
    m20 * rotation[0]! + m21 * rotation[1]! + m22 * rotation[2]!,
  );
  output[outputOffset + 7] = cleanArithmeticZero(
    m20 * rotation[3]! + m21 * rotation[4]! + m22 * rotation[5]!,
  );
  output[outputOffset + 8] = cleanArithmeticZero(
    m20 * rotation[6]! + m21 * rotation[7]! + m22 * rotation[8]!,
  );
}

export function deriveCompoundMassProperties3D(
  colliders: readonly CompoundColliderMassInput3D[],
  bodyType: "dynamic" | "static" | "kinematic",
): CompoundMassProperties3D {
  const shapes: WeightedShapeMass3D[] = [];
  let mass = 0;
  let weightedCenterX = 0;
  let weightedCenterY = 0;
  let weightedCenterZ = 0;
  for (const collider of colliders) {
    if (!collider.contributesToMass) continue;
    if (!Number.isFinite(collider.density) || collider.density <= 0) {
      throw new RangeError("collider density must be positive and finite.");
    }
    const properties = shapeMassProperties(collider);
    shapes.push(properties);
    mass += properties.mass;
    weightedCenterX += properties.centerX * properties.mass;
    weightedCenterY += properties.centerY * properties.mass;
    weightedCenterZ += properties.centerZ * properties.mass;
  }
  if (bodyType === "dynamic" && (!Number.isFinite(mass) || mass <= 0)) {
    throw new RangeError(
      "an automatic-mass dynamic body must have positive mass.",
    );
  }
  const centerX = mass > 0 ? weightedCenterX / mass : 0;
  const centerY = mass > 0 ? weightedCenterY / mass : 0;
  const centerZ = mass > 0 ? weightedCenterZ / mass : 0;
  let inertiaXX = 0;
  let inertiaYY = 0;
  let inertiaZZ = 0;
  let inertiaXY = 0;
  let inertiaXZ = 0;
  let inertiaYZ = 0;
  for (const shape of shapes) {
    const dx = shape.centerX - centerX;
    const dy = shape.centerY - centerY;
    const dz = shape.centerZ - centerZ;
    inertiaXX += shape.inertiaXX + shape.mass * (dy * dy + dz * dz);
    inertiaYY += shape.inertiaYY + shape.mass * (dx * dx + dz * dz);
    inertiaZZ += shape.inertiaZZ + shape.mass * (dx * dx + dy * dy);
    inertiaXY += shape.inertiaXY - shape.mass * dx * dy;
    inertiaXZ += shape.inertiaXZ - shape.mass * dx * dz;
    inertiaYZ += shape.inertiaYZ - shape.mass * dy * dz;
  }
  let inverseXX = 0;
  let inverseYY = 0;
  let inverseZZ = 0;
  let inverseXY = 0;
  let inverseXZ = 0;
  let inverseYZ = 0;
  if (bodyType === "dynamic") {
    const inverse = invertSymmetricTensor(
      inertiaXX,
      inertiaYY,
      inertiaZZ,
      inertiaXY,
      inertiaXZ,
      inertiaYZ,
    );
    inverseXX = inverse[0];
    inverseYY = inverse[1];
    inverseZZ = inverse[2];
    inverseXY = inverse[3];
    inverseXZ = inverse[4];
    inverseYZ = inverse[5];
  }
  return {
    mass,
    centerX,
    centerY,
    centerZ,
    inertiaXX,
    inertiaYY,
    inertiaZZ,
    inertiaXY,
    inertiaXZ,
    inertiaYZ,
    inverseMass: bodyType === "dynamic" ? 1 / mass : 0,
    inverseInertiaXX: inverseXX,
    inverseInertiaYY: inverseYY,
    inverseInertiaZZ: inverseZZ,
    inverseInertiaXY: inverseXY,
    inverseInertiaXZ: inverseXZ,
    inverseInertiaYZ: inverseYZ,
  };
}

function integrateDynamicVelocity(
  bodies: BodyStore3D,
  bodyIndex: number,
  gravityX: number,
  gravityY: number,
  gravityZ: number,
  dt: number,
  worldInverseInertia: Float64Array,
  rotation: Float64Array,
): void {
  const inverseMass = bodies.inverseMass[bodyIndex]!;
  const gravityScale = bodies.gravityScale[bodyIndex]!;
  const linearDamping = 1 / (1 + bodies.linearDamping[bodyIndex]! * dt);
  bodies.linearVelocityX[bodyIndex] =
    (bodies.linearVelocityX[bodyIndex]! +
      dt *
        (gravityX * gravityScale + bodies.forceX[bodyIndex]! * inverseMass)) *
    linearDamping;
  bodies.linearVelocityY[bodyIndex] =
    (bodies.linearVelocityY[bodyIndex]! +
      dt *
        (gravityY * gravityScale + bodies.forceY[bodyIndex]! * inverseMass)) *
    linearDamping;
  bodies.linearVelocityZ[bodyIndex] =
    (bodies.linearVelocityZ[bodyIndex]! +
      dt *
        (gravityZ * gravityScale + bodies.forceZ[bodyIndex]! * inverseMass)) *
    linearDamping;
  enforceTranslationLocks(bodies, bodyIndex);

  writeWorldInverseInertia3D(
    bodies,
    bodyIndex,
    worldInverseInertia,
    0,
    rotation,
  );
  const torqueX = bodies.torqueX[bodyIndex]!;
  const torqueY = bodies.torqueY[bodyIndex]!;
  const torqueZ = bodies.torqueZ[bodyIndex]!;
  const angularDamping = 1 / (1 + bodies.angularDamping[bodyIndex]! * dt);
  bodies.angularVelocityX[bodyIndex] =
    (bodies.angularVelocityX[bodyIndex]! +
      dt *
        (worldInverseInertia[0]! * torqueX +
          worldInverseInertia[1]! * torqueY +
          worldInverseInertia[2]! * torqueZ)) *
    angularDamping;
  bodies.angularVelocityY[bodyIndex] =
    (bodies.angularVelocityY[bodyIndex]! +
      dt *
        (worldInverseInertia[3]! * torqueX +
          worldInverseInertia[4]! * torqueY +
          worldInverseInertia[5]! * torqueZ)) *
    angularDamping;
  bodies.angularVelocityZ[bodyIndex] =
    (bodies.angularVelocityZ[bodyIndex]! +
      dt *
        (worldInverseInertia[6]! * torqueX +
          worldInverseInertia[7]! * torqueY +
          worldInverseInertia[8]! * torqueZ)) *
    angularDamping;
  projectLockedAngularVelocity(bodies, bodyIndex, rotation);
}

function integratePose(
  bodies: BodyStore3D,
  bodyIndex: number,
  dt: number,
  orientation: Float64Array,
): void {
  bodies.positionX[bodyIndex] += bodies.linearVelocityX[bodyIndex]! * dt;
  bodies.positionY[bodyIndex] += bodies.linearVelocityY[bodyIndex]! * dt;
  bodies.positionZ[bodyIndex] += bodies.linearVelocityZ[bodyIndex]! * dt;
  const qx = bodies.orientationX[bodyIndex]!;
  const qy = bodies.orientationY[bodyIndex]!;
  const qz = bodies.orientationZ[bodyIndex]!;
  const qw = bodies.orientationW[bodyIndex]!;
  const wx = bodies.angularVelocityX[bodyIndex]!;
  const wy = bodies.angularVelocityY[bodyIndex]!;
  const wz = bodies.angularVelocityZ[bodyIndex]!;
  const halfDt = dt * 0.5;
  writeCanonicalQuaternionInto3D(
    orientation,
    qx + halfDt * (wx * qw + wy * qz - wz * qy),
    qy + halfDt * (-wx * qz + wy * qw + wz * qx),
    qz + halfDt * (wx * qy - wy * qx + wz * qw),
    qw + halfDt * (-wx * qx - wy * qy - wz * qz),
  );
  bodies.orientationX[bodyIndex] = orientation[0]!;
  bodies.orientationY[bodyIndex] = orientation[1]!;
  bodies.orientationZ[bodyIndex] = orientation[2]!;
  bodies.orientationW[bodyIndex] = orientation[3]!;
}

function enforceTranslationLocks(bodies: BodyStore3D, bodyIndex: number): void {
  const locks = bodies.translationLocks[bodyIndex]!;
  if ((locks & AXIS_LOCK_X_3D) !== 0) bodies.linearVelocityX[bodyIndex] = 0;
  if ((locks & AXIS_LOCK_Y_3D) !== 0) bodies.linearVelocityY[bodyIndex] = 0;
  if ((locks & AXIS_LOCK_Z_3D) !== 0) bodies.linearVelocityZ[bodyIndex] = 0;
}

function projectLockedAngularVelocity(
  bodies: BodyStore3D,
  bodyIndex: number,
  rotation: Float64Array,
): void {
  const locks = bodies.rotationLocks[bodyIndex]!;
  if (locks === 0) return;
  writeRotationMatrixFromComponents(
    rotation,
    bodies.orientationX[bodyIndex]!,
    bodies.orientationY[bodyIndex]!,
    bodies.orientationZ[bodyIndex]!,
    bodies.orientationW[bodyIndex]!,
  );
  const worldX = bodies.angularVelocityX[bodyIndex]!;
  const worldY = bodies.angularVelocityY[bodyIndex]!;
  const worldZ = bodies.angularVelocityZ[bodyIndex]!;
  let localX =
    rotation[0]! * worldX + rotation[3]! * worldY + rotation[6]! * worldZ;
  let localY =
    rotation[1]! * worldX + rotation[4]! * worldY + rotation[7]! * worldZ;
  let localZ =
    rotation[2]! * worldX + rotation[5]! * worldY + rotation[8]! * worldZ;
  if ((locks & AXIS_LOCK_X_3D) !== 0) localX = 0;
  if ((locks & AXIS_LOCK_Y_3D) !== 0) localY = 0;
  if ((locks & AXIS_LOCK_Z_3D) !== 0) localZ = 0;
  bodies.angularVelocityX[bodyIndex] =
    rotation[0]! * localX + rotation[1]! * localY + rotation[2]! * localZ;
  bodies.angularVelocityY[bodyIndex] =
    rotation[3]! * localX + rotation[4]! * localY + rotation[5]! * localZ;
  bodies.angularVelocityZ[bodyIndex] =
    rotation[6]! * localX + rotation[7]! * localY + rotation[8]! * localZ;
}

function shapeMassProperties(
  collider: CompoundColliderMassInput3D,
): WeightedShapeMass3D {
  const colliderPose: InternalPose3D = {
    position: new Float64Array(collider.position),
    orientation: copyCanonicalQuaternion(
      collider.orientation,
      "collider orientation",
    ),
  };
  const properties = massProperties3D(shapeForRecord3D(collider.shape), {
    density: collider.density,
  });
  const center = new Float64Array(3);
  transformPointInto(center, properties.centerOfMass, colliderPose);
  const tensor = rotateTensor(
    properties.inertiaTensor,
    colliderPose.orientation,
  );
  return {
    mass: properties.mass,
    centerX: center[0]!,
    centerY: center[1]!,
    centerZ: center[2]!,
    inertiaXX: tensor[0]!,
    inertiaYY: tensor[4]!,
    inertiaZZ: tensor[8]!,
    inertiaXY: tensor[1]!,
    inertiaXZ: tensor[2]!,
    inertiaYZ: tensor[5]!,
  };
}
function rotateTensor(
  tensor: ArrayLike<number>,
  orientation: ArrayLike<number>,
): Float64Array {
  const rotation = new Float64Array(9);
  const intermediate = new Float64Array(9);
  const result = new Float64Array(9);
  rotationMatrixInto(rotation, orientation);
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      intermediate[row * 3 + column] =
        rotation[row * 3]! * tensor[column]! +
        rotation[row * 3 + 1]! * tensor[3 + column]! +
        rotation[row * 3 + 2]! * tensor[6 + column]!;
    }
  }
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      result[row * 3 + column] =
        intermediate[row * 3]! * rotation[column * 3]! +
        intermediate[row * 3 + 1]! * rotation[column * 3 + 1]! +
        intermediate[row * 3 + 2]! * rotation[column * 3 + 2]!;
    }
  }
  return result;
}

function invertSymmetricTensor(
  xx: number,
  yy: number,
  zz: number,
  xy: number,
  xz: number,
  yz: number,
): readonly [number, number, number, number, number, number] {
  const cofactorXX = yy * zz - yz * yz;
  const cofactorYY = xx * zz - xz * xz;
  const cofactorZZ = xx * yy - xy * xy;
  const cofactorXY = xz * yz - xy * zz;
  const cofactorXZ = xy * yz - xz * yy;
  const cofactorYZ = xy * xz - xx * yz;
  const determinant = xx * cofactorXX + xy * cofactorXY + xz * cofactorXZ;
  if (!Number.isFinite(determinant) || determinant <= 0) {
    throw new RangeError("dynamic inertia tensor must be positive definite.");
  }
  return [
    cofactorXX / determinant,
    cofactorYY / determinant,
    cofactorZZ / determinant,
    cofactorXY / determinant,
    cofactorXZ / determinant,
    cofactorYZ / determinant,
  ];
}

function isDynamicBody(bodies: BodyStore3D, bodyIndex: number): boolean {
  return (
    (bodies.flags[bodyIndex]! & BODY_ENABLED_3D) !== 0 &&
    (bodies.flags[bodyIndex]! & BODY_TYPE_MASK_3D) === BODY_TYPE_DYNAMIC_3D &&
    bodies.inverseMass[bodyIndex]! > 0
  );
}

export function writeCanonicalQuaternionInto3D(
  output: Float64Array,
  x: number,
  y: number,
  z: number,
  w: number,
): void {
  const scale = Math.max(Math.abs(x), Math.abs(y), Math.abs(z), Math.abs(w));
  if (scale === 0 || !Number.isFinite(scale)) {
    throw new RangeError(
      "integrated orientation must remain finite and nonzero.",
    );
  }
  let normalizedX = x / scale;
  let normalizedY = y / scale;
  let normalizedZ = z / scale;
  let normalizedW = w / scale;
  const length = Math.hypot(normalizedX, normalizedY, normalizedZ, normalizedW);
  normalizedX /= length;
  normalizedY /= length;
  normalizedZ /= length;
  normalizedW /= length;
  const firstNonzero =
    normalizedW !== 0
      ? normalizedW
      : normalizedX !== 0
        ? normalizedX
        : normalizedY !== 0
          ? normalizedY
          : normalizedZ;
  if (firstNonzero < 0) {
    normalizedX = -normalizedX;
    normalizedY = -normalizedY;
    normalizedZ = -normalizedZ;
    normalizedW = -normalizedW;
  }
  output[0] = normalizedX === 0 ? 0 : normalizedX;
  output[1] = normalizedY === 0 ? 0 : normalizedY;
  output[2] = normalizedZ === 0 ? 0 : normalizedZ;
  output[3] = normalizedW === 0 ? 0 : normalizedW;
}

function writeRotationMatrixFromComponents(
  output: Float64Array,
  x: number,
  y: number,
  z: number,
  w: number,
): void {
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;
  output[0] = cleanArithmeticZero(1 - 2 * (yy + zz));
  output[1] = cleanArithmeticZero(2 * (xy - wz));
  output[2] = cleanArithmeticZero(2 * (xz + wy));
  output[3] = cleanArithmeticZero(2 * (xy + wz));
  output[4] = cleanArithmeticZero(1 - 2 * (xx + zz));
  output[5] = cleanArithmeticZero(2 * (yz - wx));
  output[6] = cleanArithmeticZero(2 * (xz - wy));
  output[7] = cleanArithmeticZero(2 * (yz + wx));
  output[8] = cleanArithmeticZero(1 - 2 * (xx + yy));
}

function cleanArithmeticZero(value: number): number {
  return value === 0 ? 0 : value;
}

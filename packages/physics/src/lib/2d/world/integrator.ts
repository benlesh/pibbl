import type { BodyStore2D } from "./storage.js";

export const BODY_TYPE_DYNAMIC_2D = 1 << 0;
export const BODY_TYPE_KINEMATIC_2D = 1 << 1;
export const BODY_FIXED_ROTATION_2D = 1 << 2;

const BODY_TYPE_MASK_2D = BODY_TYPE_DYNAMIC_2D | BODY_TYPE_KINEMATIC_2D;

export function applyForceAtPointToCandidateBody2D(
  bodies: BodyStore2D,
  bodyIndex: number,
  bodyGeneration: number,
  forceX: number,
  forceY: number,
  pointX: number,
  pointY: number,
): boolean {
  if (!bodies.has(bodyIndex, bodyGeneration)) return false;
  if (!isDynamicBody(bodies, bodyIndex)) return true;
  bodies.forceX[bodyIndex] += forceX;
  bodies.forceY[bodyIndex] += forceY;
  if (!isFixedRotation(bodies, bodyIndex)) {
    bodies.torque[bodyIndex] +=
      (pointX - bodies.positionX[bodyIndex]!) * forceY -
      (pointY - bodies.positionY[bodyIndex]!) * forceX;
  }
  return true;
}

export function applyTorqueToCandidateBody2D(
  bodies: BodyStore2D,
  bodyIndex: number,
  bodyGeneration: number,
  torque: number,
): boolean {
  if (!bodies.has(bodyIndex, bodyGeneration)) return false;
  if (isDynamicBody(bodies, bodyIndex) && !isFixedRotation(bodies, bodyIndex)) {
    bodies.torque[bodyIndex] += torque;
  }
  return true;
}

export function applyImpulseAtPointToCandidateBody2D(
  bodies: BodyStore2D,
  bodyIndex: number,
  bodyGeneration: number,
  impulseX: number,
  impulseY: number,
  pointX: number,
  pointY: number,
): boolean {
  if (!bodies.has(bodyIndex, bodyGeneration)) return false;
  if (!isDynamicBody(bodies, bodyIndex)) return true;
  const inverseMass = bodies.inverseMass[bodyIndex]!;
  bodies.linearVelocityX[bodyIndex] += impulseX * inverseMass;
  bodies.linearVelocityY[bodyIndex] += impulseY * inverseMass;
  if (!isFixedRotation(bodies, bodyIndex)) {
    bodies.angularVelocity[bodyIndex] +=
      ((pointX - bodies.positionX[bodyIndex]!) * impulseY -
        (pointY - bodies.positionY[bodyIndex]!) * impulseX) *
      bodies.inverseInertia[bodyIndex]!;
  }
  return true;
}

export function integrateCandidateBodies2D(
  bodies: BodyStore2D,
  bodyIndices: Int32Array,
  bodyCount: number,
  gravityX: number,
  gravityY: number,
  dt: number,
): void {
  for (let offset = 0; offset < bodyCount; offset += 1) {
    const bodyIndex = bodyIndices[offset]!;
    const type = bodies.flags[bodyIndex]! & BODY_TYPE_MASK_2D;
    if (type === BODY_TYPE_DYNAMIC_2D) {
      integrateDynamicVelocity(bodies, bodyIndex, gravityX, gravityY, dt);
      integratePose(bodies, bodyIndex, dt);
    } else if (type === BODY_TYPE_KINEMATIC_2D) {
      integratePose(bodies, bodyIndex, dt);
    }
    bodies.forceX[bodyIndex] = 0;
    bodies.forceY[bodyIndex] = 0;
    bodies.torque[bodyIndex] = 0;
  }
}

/** Integrate acceleration separately so resting constraints act before position drift. */
export function integrateCandidateVelocities2D(
  bodies: BodyStore2D,
  bodyIndices: Int32Array,
  bodyCount: number,
  gravityX: number,
  gravityY: number,
  dt: number,
): void {
  for (let offset = 0; offset < bodyCount; offset += 1) {
    const body = bodyIndices[offset]!;
    if (isDynamicBody(bodies, body))
      integrateDynamicVelocity(bodies, body, gravityX, gravityY, dt);
    bodies.forceX[body] = 0;
    bodies.forceY[body] = 0;
    bodies.torque[body] = 0;
  }
}

export function integrateCandidatePoses2D(
  bodies: BodyStore2D,
  bodyIndices: Int32Array,
  bodyCount: number,
  dt: number,
): void {
  for (let offset = 0; offset < bodyCount; offset += 1) {
    const body = bodyIndices[offset]!;
    if ((bodies.flags[body]! & BODY_TYPE_MASK_2D) !== 0)
      integratePose(bodies, body, dt);
  }
}

function integrateDynamicVelocity(
  bodies: BodyStore2D,
  bodyIndex: number,
  gravityX: number,
  gravityY: number,
  dt: number,
): void {
  const inverseMass = bodies.inverseMass[bodyIndex]!;
  const gravityScale = bodies.gravityScale[bodyIndex]!;
  bodies.linearVelocityX[bodyIndex] =
    (bodies.linearVelocityX[bodyIndex]! +
      dt *
        (gravityX * gravityScale + bodies.forceX[bodyIndex]! * inverseMass)) /
    (1 + bodies.linearDamping[bodyIndex]! * dt);
  bodies.linearVelocityY[bodyIndex] =
    (bodies.linearVelocityY[bodyIndex]! +
      dt *
        (gravityY * gravityScale + bodies.forceY[bodyIndex]! * inverseMass)) /
    (1 + bodies.linearDamping[bodyIndex]! * dt);

  if (isFixedRotation(bodies, bodyIndex)) {
    bodies.inverseInertia[bodyIndex] = 0;
    bodies.angularVelocity[bodyIndex] = 0;
  } else {
    bodies.angularVelocity[bodyIndex] =
      (bodies.angularVelocity[bodyIndex]! +
        dt * bodies.torque[bodyIndex]! * bodies.inverseInertia[bodyIndex]!) /
      (1 + bodies.angularDamping[bodyIndex]! * dt);
  }
}

function integratePose(
  bodies: BodyStore2D,
  bodyIndex: number,
  dt: number,
): void {
  bodies.positionX[bodyIndex] += bodies.linearVelocityX[bodyIndex]! * dt;
  bodies.positionY[bodyIndex] += bodies.linearVelocityY[bodyIndex]! * dt;
  bodies.rotationRadians[bodyIndex] += bodies.angularVelocity[bodyIndex]! * dt;
}

function isDynamicBody(bodies: BodyStore2D, bodyIndex: number): boolean {
  return (
    (bodies.flags[bodyIndex]! & BODY_TYPE_MASK_2D) === BODY_TYPE_DYNAMIC_2D &&
    bodies.inverseMass[bodyIndex]! > 0
  );
}

function isFixedRotation(bodies: BodyStore2D, bodyIndex: number): boolean {
  return (bodies.flags[bodyIndex]! & BODY_FIXED_ROTATION_2D) !== 0;
}

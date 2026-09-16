export type CRCPhysicsVector3 = readonly [x: number, y: number, z: number];

export type CRCPhysicsQuaternion = readonly [
  x: number,
  y: number,
  z: number,
  w: number,
];

export type CRCPhysicsMatrix3 = readonly [
  m00: number,
  m01: number,
  m02: number,
  m10: number,
  m11: number,
  m12: number,
  m20: number,
  m21: number,
  m22: number,
];

export interface CRCPhysicsPose3D {
  readonly position: CRCPhysicsVector3;
  readonly orientation: CRCPhysicsQuaternion;
}

export type CRCPhysicsTransform3D = CRCPhysicsPose3D;

export interface CRCPhysicsAabb3D {
  readonly min: CRCPhysicsVector3;
  readonly max: CRCPhysicsVector3;
}

export interface CRCPhysicsRay3D {
  readonly origin: CRCPhysicsVector3;
  readonly direction: CRCPhysicsVector3;
  readonly maxDistance: number;
}

declare const physicsShape3DBrand: unique symbol;
export interface CRCPhysicsShape3D {
  readonly [physicsShape3DBrand]: true;
}

export interface CRCPhysicsMassProperties3D {
  readonly volume: number;
  readonly centerOfMass: CRCPhysicsVector3;
  readonly mass: number;
  readonly inertiaTensor: CRCPhysicsMatrix3;
}

export interface CRCPhysicsDistance3D {
  readonly separation: number;
  readonly pointOnFirst: CRCPhysicsVector3;
  readonly pointOnSecond: CRCPhysicsVector3;
  /** Direction from the second shape toward the first. */
  readonly normal: CRCPhysicsVector3;
}

export interface CRCPhysicsContactPoint3D {
  readonly pointOnFirst: CRCPhysicsVector3;
  readonly pointOnSecond: CRCPhysicsVector3;
  readonly separation: number;
}

export interface CRCPhysicsShapeContact3D {
  readonly normal: CRCPhysicsVector3;
  readonly points: readonly CRCPhysicsContactPoint3D[];
}

export interface CRCPhysicsShapeHit3D {
  readonly point: CRCPhysicsVector3;
  readonly normal: CRCPhysicsVector3;
  readonly distance: number;
  readonly timeOfImpact: number;
  readonly triangleIndex?: number;
  readonly barycentric?: CRCPhysicsVector3;
}

export {
  boundsOfShape3D,
  boxShape3D,
  massProperties3D,
  sphereShape3D,
  transformShape3D,
} from "./lib/3d/shapes.js";
export {
  contactBetweenShapes3D,
  containsPoint3D,
  distanceBetweenShapes3D,
  overlapShapes3D,
} from "./lib/3d/collision/pairs.js";
export {
  raycastShape3D,
  shapeCastAgainstShape3D,
} from "./lib/3d/collision/casts.js";

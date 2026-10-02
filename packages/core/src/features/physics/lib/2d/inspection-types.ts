import type {
  CRCPhysicsAabb2D,
  CRCPhysicsContactPoint2D,
  CRCPhysicsPose2D,
  CRCPhysicsVector2,
} from "../../2d-geometry.js";

export interface CRCPhysicsBodyInspection2D {
  readonly id: number;
  readonly generation: number;
  readonly type: "dynamic" | "kinematic" | "static";
  readonly enabled: boolean;
  readonly sleeping: boolean;
  readonly pose: CRCPhysicsPose2D;
  readonly presentationPose: CRCPhysicsPose2D;
  readonly centerOfMass: CRCPhysicsVector2;
  readonly linearVelocity: CRCPhysicsVector2;
  readonly angularVelocityDegreesPerSecond: number;
  readonly mass: number | null;
}
export interface CRCPhysicsColliderInspection2D {
  readonly id: number;
  readonly generation: number;
  readonly bodyId: number;
  readonly sensor: boolean;
  /** String tags only. Arbitrary application objects are never serialized. */
  readonly label: string | null;
  readonly shapeKinds: readonly string[];
  readonly bounds: CRCPhysicsAabb2D;
}
export interface CRCPhysicsContactInspection2D {
  readonly firstColliderId: number;
  readonly secondColliderId: number;
  readonly sensor: boolean;
  readonly normal: CRCPhysicsVector2;
  readonly points: readonly CRCPhysicsContactPoint2D[];
  readonly normalImpulse: number;
}
/** Read-only observations, not an engine serialization/restore format. */
export interface CRCPhysicsInspection2D {
  readonly engine: "rapier-2d@0.21.0";
  readonly space: "root" | "local";
  readonly revision: number;
  readonly tick: number;
  readonly advancing: boolean;
  readonly failedFrames: number;
  readonly lastFailure: string | null;
  readonly bodies: readonly CRCPhysicsBodyInspection2D[];
  readonly colliders: readonly CRCPhysicsColliderInspection2D[];
  readonly contacts: readonly CRCPhysicsContactInspection2D[];
}

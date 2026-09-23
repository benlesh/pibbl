import type { CRCNode, Signal } from "@crc/core";
import type {} from "@crc/webgl";
import type {
  CRCPhysicsContactPoint3D,
  CRCPhysicsQuaternion,
  CRCPhysicsShape3D,
  CRCPhysicsShapeHit3D,
  CRCPhysicsVector3,
} from "../../3d-geometry.js";

export interface CRCPhysicsAxisLocks3D {
  readonly x?: boolean;
  readonly y?: boolean;
  readonly z?: boolean;
}

export interface CRCPhysicsCollisionFilter {
  readonly category?: number;
  readonly mask?: number;
  readonly group?: number;
}

export interface CRCPhysicsColliderConfiguration3D {
  readonly shape?: "self" | CRCPhysicsShape3D;
  readonly offset?: CRCPhysicsVector3;
  readonly orientation?: CRCPhysicsQuaternion;
  readonly density?: number;
  readonly friction?: number;
  readonly restitution?: number;
  readonly sensor?: boolean;
  readonly contributesToMass?: boolean;
  readonly collisionFilter?: CRCPhysicsCollisionFilter;
  readonly tag?: unknown;
  readonly onCollisionStart?: CRCPhysicsCollisionHandler3D;
  readonly onCollisionEnd?: CRCPhysicsCollisionHandler3D;
  readonly onHit?: CRCPhysicsHitHandler3D;
  readonly onOverlapStart?: CRCPhysicsOverlapHandler3D;
  readonly onOverlapEnd?: CRCPhysicsOverlapHandler3D;
}

export interface CRCPhysicsDynamicBody3DOptions {
  readonly enabled?: boolean;
  readonly handle?: CRCPhysicsBodyHandle3D;
  readonly linearVelocity?: CRCPhysicsVector3;
  readonly angularVelocityDegreesPerSecond?: CRCPhysicsVector3;
  readonly linearDamping?: number;
  readonly angularDamping?: number;
  readonly gravityScale?: number;
  readonly mass?: "auto" | number;
  readonly lockTranslation?: CRCPhysicsAxisLocks3D;
  readonly lockRotation?: CRCPhysicsAxisLocks3D;
  readonly allowSleep?: boolean;
  readonly ccd?: boolean;
  readonly reenableVelocity?: "zero" | "preserve";
  readonly collider?:
    false | CRCPhysicsColliderConfiguration3D | CRCPhysicsShape3D;
}

export interface CRCPhysicsStaticBody3DOptions {
  readonly enabled?: boolean;
  readonly handle?: CRCPhysicsBodyHandle3D;
  readonly collider?:
    false | CRCPhysicsColliderConfiguration3D | CRCPhysicsShape3D;
}

export interface CRCPhysicsKinematicTarget3D {
  readonly position?: Signal<CRCPhysicsVector3>;
  readonly orientation?: Signal<CRCPhysicsQuaternion>;
}

export interface CRCPhysicsKinematicBody3DOptions {
  readonly enabled?: boolean;
  readonly handle?: CRCPhysicsBodyHandle3D;
  readonly target?: CRCPhysicsKinematicTarget3D;
  readonly allowSleep?: boolean;
  readonly collider?:
    false | CRCPhysicsColliderConfiguration3D | CRCPhysicsShape3D;
}

export interface CRCPhysicsSolverOptions {
  readonly velocityIterations?: number;
  readonly positionIterations?: number;
}

export interface CRCPhysicsWorld3DProps {
  readonly gravity?: CRCPhysicsVector3;
  readonly fixedStepMilliseconds?: number;
  readonly maxCatchUpSteps?: number;
  readonly interpolation?: "linear" | "none";
  readonly sleeping?: boolean;
  readonly solver?: CRCPhysicsSolverOptions;
  readonly onSleep?: CRCPhysicsBodyStateHandler3D;
  readonly onWake?: CRCPhysicsBodyStateHandler3D;
  readonly onError?: (error: unknown) => void;
  readonly children?: CRCNode;
}

declare const physicsAttachment3DBrand: unique symbol;
export interface CRCPhysicsBodyAttachment3D {
  readonly [physicsAttachment3DBrand]: "body";
}
export interface CRCPhysicsColliderAttachment3D {
  readonly [physicsAttachment3DBrand]: "collider";
}
export type CRCPhysicsAttachment3D =
  CRCPhysicsBodyAttachment3D | CRCPhysicsColliderAttachment3D;

declare const bodyHandle3DBrand: unique symbol;
export interface CRCPhysicsBodyHandle3D {
  readonly [bodyHandle3DBrand]: true;
  readonly position: Signal<CRCPhysicsVector3>;
  readonly orientation: Signal<CRCPhysicsQuaternion>;
  readonly linearVelocity: Signal<CRCPhysicsVector3>;
  readonly angularVelocityDegreesPerSecond: Signal<CRCPhysicsVector3>;
  readonly sleeping: Signal<boolean>;
  readonly enabled: Signal<boolean>;
  readonly generation: Signal<number>;
}

declare const colliderHandle3DBrand: unique symbol;
export interface CRCPhysicsColliderHandle3D {
  readonly [colliderHandle3DBrand]: true;
}

declare const worldHandle3DBrand: unique symbol;
export interface CRCPhysicsWorldHandle3D {
  readonly [worldHandle3DBrand]: true;
  readonly revision: Signal<number>;
}

export type CRCPhysicsQueryMode = "closest" | "any" | "all";

export interface CRCPhysicsQueryOptions3D<
  Mode extends CRCPhysicsQueryMode = "closest",
> {
  readonly mode?: Mode;
  readonly sensors?: "include" | "exclude" | "only";
  readonly collisionFilter?: CRCPhysicsCollisionFilter;
  readonly excludeBody?: CRCPhysicsBodyHandle3D;
  readonly excludeCollider?: CRCPhysicsColliderHandle3D;
}

export interface CRCPhysicsQueryHit3D extends CRCPhysicsShapeHit3D {
  readonly body: CRCPhysicsBodyHandle3D;
  readonly collider: CRCPhysicsColliderHandle3D;
  readonly bodyGeneration: number;
  readonly colliderGeneration: number;
  readonly tag: unknown;
}

export interface CRCPhysicsQueryMatch3D {
  readonly body: CRCPhysicsBodyHandle3D;
  readonly collider: CRCPhysicsColliderHandle3D;
  readonly bodyGeneration: number;
  readonly colliderGeneration: number;
  readonly tag: unknown;
}

export type CRCPhysicsQueryResult3D<
  Mode extends CRCPhysicsQueryMode,
  Result,
> = Mode extends "any"
  ? boolean
  : Mode extends "all"
    ? readonly Result[]
    : Result | null;

export interface CRCPhysicsCollisionEvent3D {
  readonly selfBody: CRCPhysicsBodyHandle3D;
  readonly selfCollider: CRCPhysicsColliderHandle3D;
  readonly otherBody: CRCPhysicsBodyHandle3D;
  readonly otherCollider: CRCPhysicsColliderHandle3D;
  readonly normal: CRCPhysicsVector3;
  readonly points: readonly CRCPhysicsContactPoint3D[];
  readonly totalNormalImpulse: number;
  readonly tick: number;
  readonly selfTag: unknown;
  readonly otherTag: unknown;
}

export interface CRCPhysicsOverlapEvent3D {
  readonly selfBody: CRCPhysicsBodyHandle3D;
  readonly selfCollider: CRCPhysicsColliderHandle3D;
  readonly otherBody: CRCPhysicsBodyHandle3D;
  readonly otherCollider: CRCPhysicsColliderHandle3D;
  readonly tick: number;
  readonly selfTag: unknown;
  readonly otherTag: unknown;
}

export interface CRCPhysicsBodyStateEvent3D {
  readonly body: CRCPhysicsBodyHandle3D;
  readonly sleeping: boolean;
  readonly tick: number;
}

export type CRCPhysicsCollisionHandler3D = (
  event: CRCPhysicsCollisionEvent3D,
) => void;
export type CRCPhysicsHitHandler3D = (
  event: CRCPhysicsCollisionEvent3D,
) => void;
export type CRCPhysicsOverlapHandler3D = (
  event: CRCPhysicsOverlapEvent3D,
) => void;
export type CRCPhysicsBodyStateHandler3D = (
  event: CRCPhysicsBodyStateEvent3D,
) => void;

declare module "@crc/webgl" {
  interface CRCPhysics3DPropExtension {
    readonly physics?: CRCPhysicsAttachment3D;
  }
}

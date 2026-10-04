import type {
  BoxStyle,
  CRCEventHandlers,
  CRCEventParticipationOptions,
  CRCNodeInput,
  CursorStyle,
  LayoutBox,
  LayoutItemStyle,
  PaintStyle,
  Signal,
  SignalValue,
  SystemStyle,
} from "@crc/core";
import type {
  CRCPhysicsAabb2D,
  CRCPhysicsContactPoint2D,
  CRCPhysicsShape2D,
  CRCPhysicsShapeHit2D,
  CRCPhysicsVector2,
} from "../../2d-geometry.js";

export interface CRCPhysicsCollisionFilter {
  readonly category?: number;
  readonly mask?: number;
  readonly group?: number;
}

export type CRCPhysicsCollisionHandler2D = (
  event: CRCPhysicsCollisionEvent2D,
) => void;
export type CRCPhysicsHitHandler2D = (
  event: CRCPhysicsCollisionEvent2D,
) => void;
export type CRCPhysicsOverlapHandler2D = (
  event: CRCPhysicsOverlapEvent2D,
) => void;
export type CRCPhysicsBodyStateHandler2D = (
  event: CRCPhysicsBodyStateEvent2D,
) => void;

export interface CRCPhysicsColliderConfiguration2D {
  readonly shape?: "self" | CRCPhysicsShape2D;
  readonly offset?: CRCPhysicsVector2;
  readonly rotationDegrees?: number;
  readonly density?: number;
  readonly friction?: number;
  readonly restitution?: number;
  readonly sensor?: boolean;
  readonly contributesToMass?: boolean;
  readonly collisionFilter?: CRCPhysicsCollisionFilter;
  readonly tag?: unknown;
  readonly onCollisionStart?: CRCPhysicsCollisionHandler2D;
  readonly onCollisionEnd?: CRCPhysicsCollisionHandler2D;
  readonly onHit?: CRCPhysicsHitHandler2D;
  readonly onOverlapStart?: CRCPhysicsOverlapHandler2D;
  readonly onOverlapEnd?: CRCPhysicsOverlapHandler2D;
}

export interface CRCPhysicsDynamicBody2DOptions {
  readonly enabled?: boolean;
  readonly handle?: CRCPhysicsBodyHandle2D;
  readonly linearVelocity?: CRCPhysicsVector2;
  readonly angularVelocityDegreesPerSecond?: number;
  readonly linearDamping?: number;
  readonly angularDamping?: number;
  readonly gravityScale?: number;
  readonly mass?: "auto" | number;
  readonly fixedRotation?: boolean;
  readonly allowSleep?: boolean;
  readonly ccd?: boolean;
  readonly reenableVelocity?: "zero" | "preserve";
  readonly collider?:
    false | CRCPhysicsColliderConfiguration2D | CRCPhysicsShape2D;
}

export interface CRCPhysicsStaticBody2DOptions {
  readonly enabled?: boolean;
  readonly handle?: CRCPhysicsBodyHandle2D;
  readonly collider?:
    false | CRCPhysicsColliderConfiguration2D | CRCPhysicsShape2D;
}

export interface CRCPhysicsKinematicTarget2D {
  readonly position?: Signal<CRCPhysicsVector2>;
  readonly rotationDegrees?: Signal<number>;
}

export interface CRCPhysicsKinematicBody2DOptions {
  readonly enabled?: boolean;
  readonly handle?: CRCPhysicsBodyHandle2D;
  readonly target?: CRCPhysicsKinematicTarget2D;
  readonly allowSleep?: boolean;
  readonly collider?:
    false | CRCPhysicsColliderConfiguration2D | CRCPhysicsShape2D;
}

declare const physicsAttachment2DBrand: unique symbol;
export interface CRCPhysicsBodyAttachment2D {
  readonly [physicsAttachment2DBrand]: "body";
}
export interface CRCPhysicsColliderAttachment2D {
  readonly [physicsAttachment2DBrand]: "collider";
}
export type CRCPhysicsAttachment2D =
  CRCPhysicsBodyAttachment2D | CRCPhysicsColliderAttachment2D;

declare module "@crc/core" {
  interface CRCPhysics2DPropExtension {
    readonly physics?: CRCPhysicsAttachment2D;
  }
}

export interface CRCPhysicsSolverOptions {
  readonly velocityIterations?: number;
  readonly positionIterations?: number;
}

interface CRCPhysicsWorld2DValues {
  /** Local space follows the world component viewport; root preserves root-logical coordinates. Creation-only. */
  readonly space?: "root" | "local";
  readonly gravity?: CRCPhysicsVector2;
  readonly fixedStepMilliseconds?: number;
  readonly maxCatchUpSteps?: number;
  readonly interpolation?: "linear" | "none";
  readonly sleeping?: boolean;
  readonly solver?: CRCPhysicsSolverOptions;
  readonly onSleep?: CRCPhysicsBodyStateHandler2D;
  readonly onWake?: CRCPhysicsBodyStateHandler2D;
  readonly onError?: (error: unknown) => void;
  readonly children?: CRCNodeInput;
}

export type CRCPhysicsWorld2DProps = {
  readonly [K in keyof CRCPhysicsWorld2DValues]: K extends "children"
    ? CRCPhysicsWorld2DValues[K]
    : SignalValue<CRCPhysicsWorld2DValues[K]>;
};

export interface CRCPhysicsPrimitiveProps2D
  extends CRCEventHandlers, CRCEventParticipationOptions {
  readonly keyboardFocusable?: boolean;
  readonly keyboardNavigationBounds?: Readonly<LayoutBox>;
  readonly physics?: CRCPhysicsAttachment2D;
}

export interface PhysicsShape2DProps extends CRCPhysicsPrimitiveProps2D {}
export interface PhysicsShape2DStyle
  extends SystemStyle, PaintStyle, CursorStyle, BoxStyle, LayoutItemStyle {
  readonly shape: CRCPhysicsShape2D;
  readonly lineInteractionWidth?: number;
}

export interface Capsule2DProps extends CRCPhysicsPrimitiveProps2D {}
export interface Capsule2DStyle
  extends SystemStyle, PaintStyle, CursorStyle, BoxStyle, LayoutItemStyle {
  readonly start: CRCPhysicsVector2;
  readonly end: CRCPhysicsVector2;
  readonly radius: number;
  readonly lineInteractionWidth?: number;
}

export interface Segment2DProps extends CRCPhysicsPrimitiveProps2D {}
export interface Segment2DStyle
  extends
    SystemStyle,
    Omit<PaintStyle, "fill">,
    CursorStyle,
    BoxStyle,
    LayoutItemStyle {
  readonly start: CRCPhysicsVector2;
  readonly end: CRCPhysicsVector2;
  readonly lineInteractionWidth?: number;
}

export interface Chain2DProps extends CRCPhysicsPrimitiveProps2D {}
export interface Chain2DStyle
  extends SystemStyle, PaintStyle, CursorStyle, BoxStyle, LayoutItemStyle {
  readonly points: readonly CRCPhysicsVector2[];
  readonly closed?: boolean;
  readonly radius?: number;
  readonly lineInteractionWidth?: number;
}

declare const bodyHandle2DBrand: unique symbol;
export interface CRCPhysicsBodyHandle2D {
  readonly [bodyHandle2DBrand]: true;
  readonly position: Signal<CRCPhysicsVector2>;
  readonly rotationDegrees: Signal<number>;
  readonly linearVelocity: Signal<CRCPhysicsVector2>;
  readonly angularVelocityDegreesPerSecond: Signal<number>;
  readonly sleeping: Signal<boolean>;
  readonly enabled: Signal<boolean>;
  readonly generation: Signal<number>;
}

declare const colliderHandle2DBrand: unique symbol;
export interface CRCPhysicsColliderHandle2D {
  readonly [colliderHandle2DBrand]: true;
}

declare const worldHandle2DBrand: unique symbol;
export interface CRCPhysicsWorldHandle2D {
  readonly [worldHandle2DBrand]: true;
  readonly revision: Signal<number>;
}

export type CRCPhysicsQueryMode = "closest" | "any" | "all";

export interface CRCPhysicsQueryOptions2D<
  Mode extends CRCPhysicsQueryMode = "closest",
> {
  readonly mode?: Mode;
  readonly sensors?: "include" | "exclude" | "only";
  readonly collisionFilter?: CRCPhysicsCollisionFilter;
  readonly excludeBody?: CRCPhysicsBodyHandle2D;
  readonly excludeCollider?: CRCPhysicsColliderHandle2D;
}

export interface CRCPhysicsQueryHit2D extends CRCPhysicsShapeHit2D {
  readonly body: CRCPhysicsBodyHandle2D;
  readonly collider: CRCPhysicsColliderHandle2D;
  readonly bodyGeneration: number;
  readonly colliderGeneration: number;
  readonly tag: unknown;
}

export interface CRCPhysicsQueryMatch2D {
  readonly body: CRCPhysicsBodyHandle2D;
  readonly collider: CRCPhysicsColliderHandle2D;
  readonly bodyGeneration: number;
  readonly colliderGeneration: number;
  readonly tag: unknown;
}

export type CRCPhysicsQueryResult2D<
  Mode extends CRCPhysicsQueryMode,
  Result,
> = Mode extends "any"
  ? boolean
  : Mode extends "all"
    ? readonly Result[]
    : Result | null;

export interface CRCPhysicsCollisionEvent2D {
  readonly selfBody: CRCPhysicsBodyHandle2D;
  readonly selfCollider: CRCPhysicsColliderHandle2D;
  readonly otherBody: CRCPhysicsBodyHandle2D;
  readonly otherCollider: CRCPhysicsColliderHandle2D;
  /** Direction from other toward self. */
  readonly normal: CRCPhysicsVector2;
  readonly points: readonly CRCPhysicsContactPoint2D[];
  readonly totalNormalImpulse: number;
  readonly tick: number;
  readonly selfTag: unknown;
  readonly otherTag: unknown;
}

export interface CRCPhysicsOverlapEvent2D {
  readonly selfBody: CRCPhysicsBodyHandle2D;
  readonly selfCollider: CRCPhysicsColliderHandle2D;
  readonly otherBody: CRCPhysicsBodyHandle2D;
  readonly otherCollider: CRCPhysicsColliderHandle2D;
  readonly tick: number;
  readonly selfTag: unknown;
  readonly otherTag: unknown;
}

export interface CRCPhysicsBodyStateEvent2D {
  readonly body: CRCPhysicsBodyHandle2D;
  readonly sleeping: boolean;
  readonly tick: number;
}

export type {
  CRCPhysicsAabb2D,
  CRCPhysicsShape2D,
  CRCPhysicsShapeHit2D,
  CRCPhysicsVector2,
};

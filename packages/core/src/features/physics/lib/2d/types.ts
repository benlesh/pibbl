import type { collider2D, dynamicBody2D, kinematicBody2D, staticBody2D } from './runtime/descriptors.js';
import type { PhysicsWorld2D, pibblPhysicsWorld2D } from './runtime/world-component.js';
import type { Capsule2D, Chain2D, PhysicsShape2D, Segment2D } from './canvas/components.js';
import type { overlapShape2D, queryAabb2D, raycast2D, shapeCast2D } from '../../2d.js';
import type {
  BoxStyle,
  PibblEventHandlers,
  PibblEventParticipationOptions,
  PibblNodeInput,
  CursorStyle,
  LayoutBox,
  LayoutItemStyle,
  PaintStyle,
  Signal,
  SignalValue,
  SystemStyle,
} from "@pibbl/core";
import type {
  PibblPhysicsAabb2D,
  PibblPhysicsContactPoint2D,
  PibblPhysicsShape2D,
  PibblPhysicsShapeHit2D,
  PibblPhysicsVector2,
} from "../../2d-geometry.js";

/**
 * Category, mask, and group values controlling eligible collision pairs.
 *
 * @see {@link PibblPhysicsColliderConfiguration2D}
 * @see {@link PibblPhysicsQueryOptions2D}
 */
export interface PibblPhysicsCollisionFilter {
  /** Category bits identifying this collider for collision filtering. See {@link PibblPhysicsCollisionFilter}. */
  readonly category?: number;
  /** Category bits this collider is permitted to collide with. See {@link PibblPhysicsCollisionFilter}. */
  readonly mask?: number;
  /** Signed group override used when filtering a collider pair. See {@link PibblPhysicsCollisionFilter}. */
  readonly group?: number;
}

/**
 * Receives a collision-start or collision-end event for a collider.
 *
 * @param event - Collision pair and contact information for this notification. See
 * {@link PibblPhysicsCollisionEvent2D} .
 *
 * @see {@link PibblPhysicsCollisionEvent2D}
 * @see {@link PibblPhysicsColliderConfiguration2D}
 */
export type PibblPhysicsCollisionHandler2D = (
  event: PibblPhysicsCollisionEvent2D,
) => void;
/**
 * Receives contact impulse information for a collider hit.
 *
 * @param event - Collision pair and contact information for this notification. See
 * {@link PibblPhysicsCollisionEvent2D} .
 *
 * @see {@link PibblPhysicsCollisionEvent2D}
 * @see {@link PibblPhysicsColliderConfiguration2D}
 */
export type PibblPhysicsHitHandler2D = (
  event: PibblPhysicsCollisionEvent2D,
) => void;
/**
 * Receives sensor overlap-start or overlap-end notifications.
 *
 * @param event - Sensor overlap pair and overlap lifecycle information. See
 * {@link PibblPhysicsOverlapEvent2D} .
 *
 * @see {@link PibblPhysicsOverlapEvent2D}
 * @see {@link PibblPhysicsColliderConfiguration2D}
 */
export type PibblPhysicsOverlapHandler2D = (
  event: PibblPhysicsOverlapEvent2D,
) => void;
/**
 * Receives body sleeping-state changes at a simulation tick.
 *
 * @param event - Body state change notification. See {@link PibblPhysicsBodyStateEvent2D}.
 *
 * @see {@link PibblPhysicsBodyStateEvent2D}
 */
export type PibblPhysicsBodyStateHandler2D = (
  event: PibblPhysicsBodyStateEvent2D,
) => void;

/**
 * Shape, material, mass contribution, filtering, tags, and callbacks for a collider attachment.
 *
 * @see {@link PibblPhysicsShape2D}
 * @see {@link PibblPhysicsVector2}
 * @see {@link PibblPhysicsCollisionFilter}
 * @see {@link PibblPhysicsCollisionHandler2D}
 * @see {@link PibblPhysicsHitHandler2D}
 * @see {@link PibblPhysicsOverlapHandler2D}
 */
export interface PibblPhysicsColliderConfiguration2D {
  /** Immutable collision geometry or particle spawn shape. See {@link PibblPhysicsShape2D}. */
  readonly shape?: "self" | PibblPhysicsShape2D;
  /** Collider displacement relative to its owning body. See {@link PibblPhysicsVector2}. */
  readonly offset?: PibblPhysicsVector2;
  /** Rotation in degrees. See {@link PibblPhysicsColliderConfiguration2D}. */
  readonly rotationDegrees?: number;
  /**
   * Mass per unit area used to derive automatic mass properties. See
   * {@link PibblPhysicsColliderConfiguration2D}.
   */
  readonly density?: number;
  /** Contact friction coefficient. See {@link PibblPhysicsColliderConfiguration2D}. */
  readonly friction?: number;
  /**
   * Contact restitution coefficient controlling bounce. See
   * {@link PibblPhysicsColliderConfiguration2D}.
   */
  readonly restitution?: number;
  /**
   * Whether the collider reports overlaps instead of producing contact response. See
   * {@link PibblPhysicsColliderConfiguration2D}.
   */
  readonly sensor?: boolean;
  /**
   * Whether this collider contributes to its body's automatic mass properties. See
   * {@link PibblPhysicsColliderConfiguration2D}.
   */
  readonly contributesToMass?: boolean;
  /**
   * Category, mask, and group filtering for collision or query participation. See
   * {@link PibblPhysicsCollisionFilter}.
   */
  readonly collisionFilter?: PibblPhysicsCollisionFilter;
  /**
   * Application payload carried through physics queries and events. See
   * {@link PibblPhysicsColliderConfiguration2D}.
   */
  readonly tag?: unknown;
  /**
   * Receives the start of a contact pair involving this collider. See
   * {@link PibblPhysicsCollisionHandler2D}.
   */
  readonly onCollisionStart?: PibblPhysicsCollisionHandler2D;
  /**
   * Receives the end of a contact pair involving this collider. See
   * {@link PibblPhysicsCollisionHandler2D}.
   */
  readonly onCollisionEnd?: PibblPhysicsCollisionHandler2D;
  /** Receives contact impulse information for this collider. See {@link PibblPhysicsHitHandler2D}. */
  readonly onHit?: PibblPhysicsHitHandler2D;
  /**
   * Receives the start of a sensor overlap involving this collider. See
   * {@link PibblPhysicsOverlapHandler2D}.
   */
  readonly onOverlapStart?: PibblPhysicsOverlapHandler2D;
  /**
   * Receives the end of a sensor overlap involving this collider. See
   * {@link PibblPhysicsOverlapHandler2D}.
   */
  readonly onOverlapEnd?: PibblPhysicsOverlapHandler2D;
}

/**
 * Initial motion, mass, damping, gravity, sleeping, and collider configuration of a dynamic body.
 *
 * @see {@link PibblPhysicsBodyHandle2D}
 * @see {@link PibblPhysicsVector2}
 * @see {@link PibblPhysicsColliderConfiguration2D}
 * @see {@link PibblPhysicsShape2D}
 * @see {@link dynamicBody2D}
 */
export interface PibblPhysicsDynamicBody2DOptions {
  /**
   * Whether this operation or resource participates in updates. See
   * {@link PibblPhysicsDynamicBody2DOptions}.
   */
  readonly enabled?: boolean;
  /** Handle identity associated with the operation or body. See {@link PibblPhysicsBodyHandle2D}. */
  readonly handle?: PibblPhysicsBodyHandle2D;
  /**
   * Linear velocity in the simulation coordinate system per second. See {@link PibblPhysicsVector2}
   * .
   */
  readonly linearVelocity?: PibblPhysicsVector2;
  /** Angular velocity in degrees per second. See {@link PibblPhysicsDynamicBody2DOptions}. */
  readonly angularVelocityDegreesPerSecond?: number;
  /** Damping applied to linear motion. See {@link PibblPhysicsDynamicBody2DOptions}. */
  readonly linearDamping?: number;
  /** Damping applied to angular motion. See {@link PibblPhysicsDynamicBody2DOptions}. */
  readonly angularDamping?: number;
  /**
   * Multiplier applied to world gravity for this body. See {@link PibblPhysicsDynamicBody2DOptions}
   * .
   */
  readonly gravityScale?: number;
  /** Mass used by the spring or physics calculation. See {@link PibblPhysicsDynamicBody2DOptions}. */
  readonly mass?: "auto" | number;
  /** Whether angular motion is locked. See {@link PibblPhysicsDynamicBody2DOptions}. */
  readonly fixedRotation?: boolean;
  /** Whether the body may enter the sleeping state. See {@link PibblPhysicsDynamicBody2DOptions}. */
  readonly allowSleep?: boolean;
  /**
   * Whether continuous collision detection is enabled for the body. See
   * {@link PibblPhysicsDynamicBody2DOptions}.
   */
  readonly ccd?: boolean;
  /**
   * Whether re-enabling restores or clears the body's velocity. See
   * {@link PibblPhysicsDynamicBody2DOptions}.
   */
  readonly reenableVelocity?: "zero" | "preserve";
  /**
   * Collider configuration or identity associated with this body or query. See
   * {@link PibblPhysicsColliderConfiguration2D}, {@link PibblPhysicsShape2D}.
   */
  readonly collider?: false | PibblPhysicsColliderConfiguration2D | PibblPhysicsShape2D;
}

/**
 * Enablement, handle, and collider configuration of a static body.
 *
 * @see {@link PibblPhysicsBodyHandle2D}
 * @see {@link PibblPhysicsColliderConfiguration2D}
 * @see {@link PibblPhysicsShape2D}
 * @see {@link staticBody2D}
 */
export interface PibblPhysicsStaticBody2DOptions {
  /**
   * Whether this operation or resource participates in updates. See
   * {@link PibblPhysicsStaticBody2DOptions}.
   */
  readonly enabled?: boolean;
  /** Handle identity associated with the operation or body. See {@link PibblPhysicsBodyHandle2D}. */
  readonly handle?: PibblPhysicsBodyHandle2D;
  /**
   * Collider configuration or identity associated with this body or query. See
   * {@link PibblPhysicsColliderConfiguration2D}, {@link PibblPhysicsShape2D}.
   */
  readonly collider?: false | PibblPhysicsColliderConfiguration2D | PibblPhysicsShape2D;
}

/**
 * Reactive position and rotation targets for a kinematic body.
 *
 * @see {@link Signal}
 * @see {@link PibblPhysicsVector2}
 * @see {@link PibblPhysicsKinematicBody2DOptions}
 */
export interface PibblPhysicsKinematicTarget2D {
  /**
   * Position of the geometry, source, or selected resize handle. See {@link Signal},
   * {@link PibblPhysicsVector2}.
   */
  readonly position?: Signal<PibblPhysicsVector2>;
  /** Rotation in degrees. See {@link Signal}. */
  readonly rotationDegrees?: Signal<number>;
}

/**
 * Target signals, handle, enablement, and collider configuration of a kinematic body.
 *
 * @see {@link PibblPhysicsBodyHandle2D}
 * @see {@link PibblPhysicsKinematicTarget2D}
 * @see {@link PibblPhysicsColliderConfiguration2D}
 * @see {@link PibblPhysicsShape2D}
 * @see {@link kinematicBody2D}
 */
export interface PibblPhysicsKinematicBody2DOptions {
  /**
   * Whether this operation or resource participates in updates. See
   * {@link PibblPhysicsKinematicBody2DOptions}.
   */
  readonly enabled?: boolean;
  /** Handle identity associated with the operation or body. See {@link PibblPhysicsBodyHandle2D}. */
  readonly handle?: PibblPhysicsBodyHandle2D;
  /**
   * The selected logical target or target configuration. See {@link PibblPhysicsKinematicTarget2D}.
   */
  readonly target?: PibblPhysicsKinematicTarget2D;
  /**
   * Whether the body may enter the sleeping state. See {@link PibblPhysicsKinematicBody2DOptions}.
   */
  readonly allowSleep?: boolean;
  /**
   * Collider configuration or identity associated with this body or query. See
   * {@link PibblPhysicsColliderConfiguration2D}, {@link PibblPhysicsShape2D}.
   */
  readonly collider?: false | PibblPhysicsColliderConfiguration2D | PibblPhysicsShape2D;
}

declare const physicsAttachment2DBrand: unique symbol;
/**
 * A branded body descriptor attached to supported Canvas primitives.
 *
 * @see {@link PibblPhysicsAttachment2D}
 * @see {@link dynamicBody2D}
 * @see {@link kinematicBody2D}
 */
export interface PibblPhysicsBodyAttachment2D {
  readonly [physicsAttachment2DBrand]: "body";
}
/**
 * A branded collider descriptor attached under a physics body.
 *
 * @see {@link PibblPhysicsAttachment2D}
 * @see {@link collider2D}
 */
export interface PibblPhysicsColliderAttachment2D {
  readonly [physicsAttachment2DBrand]: "collider";
}
/**
 * A body or collider descriptor accepted by a physics-aware primitive.
 *
 * @see {@link PibblPhysicsBodyAttachment2D}
 * @see {@link PibblPhysicsColliderAttachment2D}
 * @see {@link PibblPhysicsPrimitiveProps2D}
 */
export type PibblPhysicsAttachment2D =
  PibblPhysicsBodyAttachment2D | PibblPhysicsColliderAttachment2D;

declare module "@pibbl/core" {
  interface PibblPhysics2DPropExtension {
    readonly physics?: PibblPhysicsAttachment2D;
  }
}

/**
 * Iteration budgets controlling the 2D solver's velocity and position work.
 *
 * @see {@link PibblPhysicsWorld2DProps}
 */
export interface PibblPhysicsSolverOptions {
  /** Solver iteration budget for velocity constraints. See {@link PibblPhysicsSolverOptions}. */
  readonly velocityIterations?: number;
  /** Solver iteration budget for position constraints. See {@link PibblPhysicsSolverOptions}. */
  readonly positionIterations?: number;
}

interface PibblPhysicsWorld2DValues {
  /**
   * Local space follows the world component viewport; root preserves root-logical coordinates.
   * Creation-only.
   */
  readonly space?: "root" | "local";
  readonly gravity?: PibblPhysicsVector2;
  readonly fixedStepMilliseconds?: number;
  readonly maxCatchUpSteps?: number;
  readonly interpolation?: "linear" | "none";
  readonly sleeping?: boolean;
  readonly solver?: PibblPhysicsSolverOptions;
  readonly onSleep?: PibblPhysicsBodyStateHandler2D;
  readonly onWake?: PibblPhysicsBodyStateHandler2D;
  readonly onError?: (error: unknown) => void;
  readonly children?: PibblNodeInput;
}

/**
 * World configuration with signal-capable values and ordinary Pibbl children.
 *
 * @see {@link SignalValue}
 * @see {@link PibblPhysicsSolverOptions}
 * @see {@link PhysicsWorld2D}
 */
export type PibblPhysicsWorld2DProps = {
  readonly [K in keyof PibblPhysicsWorld2DValues]: K extends "children"
    ? PibblPhysicsWorld2DValues[K]
    : SignalValue<PibblPhysicsWorld2DValues[K]>;
};

/**
 * Interaction and physics attachment props shared by physics-aware primitives.
 *
 * @see {@link PibblEventHandlers}
 * @see {@link PibblEventParticipationOptions}
 * @see {@link LayoutBox}
 * @see {@link PibblPhysicsAttachment2D}
 * @see {@link PhysicsShape2DProps}
 * @see {@link Capsule2DProps}
 */
export interface PibblPhysicsPrimitiveProps2D
  extends PibblEventHandlers, PibblEventParticipationOptions {
  /** Whether the target may receive keyboard focus. See {@link PibblPhysicsPrimitiveProps2D}. */
  readonly keyboardFocusable?: boolean;
  /** Logical rectangle used for directional keyboard navigation. See {@link LayoutBox}. */
  readonly keyboardNavigationBounds?: Readonly<LayoutBox>;
  /**
   * Declarative body or collider attachment for this primitive. See {@link PibblPhysicsAttachment2D}
   * .
   */
  readonly physics?: PibblPhysicsAttachment2D;
}

/**
 * Authored inputs for PhysicsShape2D, including the declared data and presentation options.
 *
 * @see {@link PibblPhysicsPrimitiveProps2D}
 * @see {@link PhysicsShape2D}
 */
export interface PhysicsShape2DProps extends PibblPhysicsPrimitiveProps2D {}
/**
 * Supported geometry and presentation properties for PhysicsShape2D.
 *
 * @see {@link SystemStyle}
 * @see {@link PaintStyle}
 * @see {@link CursorStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link PibblPhysicsShape2D}
 * @see {@link PhysicsShape2D}
 */
export interface PhysicsShape2DStyle
  extends SystemStyle, PaintStyle, CursorStyle, BoxStyle, LayoutItemStyle {
  /** Immutable collision geometry or particle spawn shape. See {@link PibblPhysicsShape2D}. */
  readonly shape: PibblPhysicsShape2D;
  /**
   * Width used for line hit testing independently of the visible stroke width. See
   * {@link PhysicsShape2DStyle}.
   */
  readonly lineInteractionWidth?: number;
}

/**
 * Authored inputs for Capsule2D, including the declared data and presentation options.
 *
 * @see {@link PibblPhysicsPrimitiveProps2D}
 * @see {@link Capsule2D}
 */
export interface Capsule2DProps extends PibblPhysicsPrimitiveProps2D {}
/**
 * Supported geometry and presentation properties for Capsule2D.
 *
 * @see {@link SystemStyle}
 * @see {@link PaintStyle}
 * @see {@link CursorStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link PibblPhysicsVector2}
 * @see {@link Capsule2D}
 */
export interface Capsule2DStyle
  extends SystemStyle, PaintStyle, CursorStyle, BoxStyle, LayoutItemStyle {
  /** First endpoint of the shape. See {@link PibblPhysicsVector2}. */
  readonly start: PibblPhysicsVector2;
  /** Last endpoint of the shape. See {@link PibblPhysicsVector2}. */
  readonly end: PibblPhysicsVector2;
  /** Radius in the coordinate system of this geometry or effect. See {@link Capsule2DStyle}. */
  readonly radius: number;
  /**
   * Width used for line hit testing independently of the visible stroke width. See
   * {@link Capsule2DStyle}.
   */
  readonly lineInteractionWidth?: number;
}

/**
 * Authored inputs for Segment2D, including the declared data and presentation options.
 *
 * @see {@link PibblPhysicsPrimitiveProps2D}
 * @see {@link Segment2D}
 */
export interface Segment2DProps extends PibblPhysicsPrimitiveProps2D {}
/**
 * Supported geometry and presentation properties for Segment2D.
 *
 * @see {@link SystemStyle}
 * @see {@link PaintStyle}
 * @see {@link CursorStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link PibblPhysicsVector2}
 * @see {@link Segment2D}
 */
export interface Segment2DStyle
  extends SystemStyle, Omit<PaintStyle, "fill">, CursorStyle, BoxStyle, LayoutItemStyle {
  /** First endpoint of the shape. See {@link PibblPhysicsVector2}. */
  readonly start: PibblPhysicsVector2;
  /** Last endpoint of the shape. See {@link PibblPhysicsVector2}. */
  readonly end: PibblPhysicsVector2;
  /**
   * Width used for line hit testing independently of the visible stroke width. See
   * {@link Segment2DStyle}.
   */
  readonly lineInteractionWidth?: number;
}

/**
 * Authored inputs for Chain2D, including the declared data and presentation options.
 *
 * @see {@link PibblPhysicsPrimitiveProps2D}
 * @see {@link Chain2D}
 */
export interface Chain2DProps extends PibblPhysicsPrimitiveProps2D {}
/**
 * Supported geometry and presentation properties for Chain2D.
 *
 * @see {@link SystemStyle}
 * @see {@link PaintStyle}
 * @see {@link CursorStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link PibblPhysicsVector2}
 * @see {@link Chain2D}
 */
export interface Chain2DStyle
  extends SystemStyle, PaintStyle, CursorStyle, BoxStyle, LayoutItemStyle {
  /**
   * Points defining the geometry or reported by the contact query. See {@link PibblPhysicsVector2}.
   */
  readonly points: readonly PibblPhysicsVector2[];
  /**
   * Whether the point chain connects its last point back to its first. See {@link Chain2DStyle}.
   */
  readonly closed?: boolean;
  /** Radius in the coordinate system of this geometry or effect. See {@link Chain2DStyle}. */
  readonly radius?: number;
  /**
   * Width used for line hit testing independently of the visible stroke width. See
   * {@link Chain2DStyle}.
   */
  readonly lineInteractionWidth?: number;
}

declare const bodyHandle2DBrand: unique symbol;
/**
 * Stable body identity with committed reactive pose, velocity, sleeping, enablement, and generation.
 *
 * @see {@link Signal}
 * @see {@link PibblPhysicsVector2}
 * @see {@link PibblPhysicsDynamicBody2DOptions}
 * @see {@link PibblPhysicsStaticBody2DOptions}
 * @see {@link PibblPhysicsKinematicBody2DOptions}
 */
export interface PibblPhysicsBodyHandle2D {
  readonly [bodyHandle2DBrand]: true;
  /**
   * Position of the geometry, source, or selected resize handle. See {@link Signal},
   * {@link PibblPhysicsVector2}.
   */
  readonly position: Signal<PibblPhysicsVector2>;
  /** Rotation in degrees. See {@link Signal}. */
  readonly rotationDegrees: Signal<number>;
  /**
   * Linear velocity in the simulation coordinate system per second. See {@link Signal},
   * {@link PibblPhysicsVector2}.
   */
  readonly linearVelocity: Signal<PibblPhysicsVector2>;
  /** Angular velocity in degrees per second. See {@link Signal}. */
  readonly angularVelocityDegreesPerSecond: Signal<number>;
  /** Whether the body is currently sleeping. See {@link Signal}. */
  readonly sleeping: Signal<boolean>;
  /** Whether this operation or resource participates in updates. See {@link Signal}. */
  readonly enabled: Signal<boolean>;
  /**
   * Generation counter distinguishing successive bindings of a stable identity. See {@link Signal}
   * .
   */
  readonly generation: Signal<number>;
}

declare const colliderHandle2DBrand: unique symbol;
/**
 * Stable opaque collider identity for filtering and query results.
 *
 * @see {@link PibblPhysicsQueryOptions2D}
 * @see {@link PibblPhysicsQueryHit2D}
 * @see {@link PibblPhysicsQueryMatch2D}
 */
export interface PibblPhysicsColliderHandle2D {
  readonly [colliderHandle2DBrand]: true;
}

declare const worldHandle2DBrand: unique symbol;
/**
 * Stable world identity with a reactive committed-state revision.
 *
 * @see {@link Signal}
 * @see {@link pibblPhysicsWorld2D}
 * @see {@link raycast2D}
 * @see {@link shapeCast2D}
 */
export interface PibblPhysicsWorldHandle2D {
  readonly [worldHandle2DBrand]: true;
  /** Revision used to detect changes to the underlying state or geometry. See {@link Signal}. */
  readonly revision: Signal<number>;
}

/**
 * Whether a query returns its closest match, any-match boolean, or all matches.
 *
 * @see {@link PibblPhysicsQueryOptions2D}
 * @see {@link PibblPhysicsQueryResult2D}
 * @see {@link raycast2D}
 */
export type PibblPhysicsQueryMode = "closest" | "any" | "all";

/**
 * Result mode, sensor policy, collision filtering, and body/collider exclusions for world queries.
 *
 * @see {@link PibblPhysicsQueryMode}
 * @see {@link PibblPhysicsCollisionFilter}
 * @see {@link PibblPhysicsBodyHandle2D}
 * @see {@link PibblPhysicsColliderHandle2D}
 */
export interface PibblPhysicsQueryOptions2D<Mode extends PibblPhysicsQueryMode = "closest"> {
  /**
   * Selects the supported mapping, placement, or result policy. See
   * {@link PibblPhysicsQueryOptions2D}.
   */
  readonly mode?: Mode;
  /**
   * Selects `"include"` , `"exclude"` , `"only"` for sensors. See {@link PibblPhysicsQueryOptions2D}
   * .
   */
  readonly sensors?: "include" | "exclude" | "only";
  /**
   * Category, mask, and group filtering for collision or query participation. See
   * {@link PibblPhysicsCollisionFilter}.
   */
  readonly collisionFilter?: PibblPhysicsCollisionFilter;
  /** Body identity omitted from query candidates. See {@link PibblPhysicsBodyHandle2D}. */
  readonly excludeBody?: PibblPhysicsBodyHandle2D;
  /** Collider identity omitted from query candidates. See {@link PibblPhysicsColliderHandle2D}. */
  readonly excludeCollider?: PibblPhysicsColliderHandle2D;
}

/**
 * Cast geometry plus matched body/collider identities, generations, and application tag.
 *
 * @see {@link PibblPhysicsShapeHit2D}
 * @see {@link PibblPhysicsBodyHandle2D}
 * @see {@link PibblPhysicsColliderHandle2D}
 * @see {@link raycast2D}
 */
export interface PibblPhysicsQueryHit2D extends PibblPhysicsShapeHit2D {
  /** Body identity associated with this event or result. See {@link PibblPhysicsBodyHandle2D}. */
  readonly body: PibblPhysicsBodyHandle2D;
  /**
   * Collider configuration or identity associated with this body or query. See
   * {@link PibblPhysicsColliderHandle2D}.
   */
  readonly collider: PibblPhysicsColliderHandle2D;
  /** Committed generation of the matched body identity. See {@link PibblPhysicsQueryHit2D}. */
  readonly bodyGeneration: number;
  /** Committed generation of the matched collider identity. See {@link PibblPhysicsQueryHit2D}. */
  readonly colliderGeneration: number;
  /**
   * Application payload carried through physics queries and events. See
   * {@link PibblPhysicsQueryHit2D}.
   */
  readonly tag: unknown;
}

/**
 * Matched body/collider identities, generations, and tag for an overlap query.
 *
 * @see {@link PibblPhysicsBodyHandle2D}
 * @see {@link PibblPhysicsColliderHandle2D}
 * @see {@link overlapShape2D}
 * @see {@link queryAabb2D}
 */
export interface PibblPhysicsQueryMatch2D {
  /** Body identity associated with this event or result. See {@link PibblPhysicsBodyHandle2D}. */
  readonly body: PibblPhysicsBodyHandle2D;
  /**
   * Collider configuration or identity associated with this body or query. See
   * {@link PibblPhysicsColliderHandle2D}.
   */
  readonly collider: PibblPhysicsColliderHandle2D;
  /** Committed generation of the matched body identity. See {@link PibblPhysicsQueryMatch2D}. */
  readonly bodyGeneration: number;
  /** Committed generation of the matched collider identity. See {@link PibblPhysicsQueryMatch2D}. */
  readonly colliderGeneration: number;
  /**
   * Application payload carried through physics queries and events. See
   * {@link PibblPhysicsQueryMatch2D}.
   */
  readonly tag: unknown;
}

/**
 * Selects a boolean, readonly result list, or nullable closest result from the query mode.
 *
 * @see {@link PibblPhysicsQueryMode}
 * @see {@link raycast2D}
 * @see {@link shapeCast2D}
 */
export type PibblPhysicsQueryResult2D<
  Mode extends PibblPhysicsQueryMode,
  Result,
> = Mode extends "any"
  ? boolean
  : Mode extends "all"
    ? readonly Result[]
    : Result | null;

/**
 * Bodies, colliders, contact geometry, impulse, tags, and tick for a collision event.
 *
 * @see {@link PibblPhysicsBodyHandle2D}
 * @see {@link PibblPhysicsColliderHandle2D}
 * @see {@link PibblPhysicsVector2}
 * @see {@link PibblPhysicsContactPoint2D}
 * @see {@link PibblPhysicsCollisionHandler2D}
 * @see {@link PibblPhysicsHitHandler2D}
 */
export interface PibblPhysicsCollisionEvent2D {
  /** Body receiving the collision or overlap notification. See {@link PibblPhysicsBodyHandle2D}. */
  readonly selfBody: PibblPhysicsBodyHandle2D;
  /**
   * Collider receiving the collision or overlap notification. See
   * {@link PibblPhysicsColliderHandle2D}.
   */
  readonly selfCollider: PibblPhysicsColliderHandle2D;
  /** The other body in the collision or overlap pair. See {@link PibblPhysicsBodyHandle2D}. */
  readonly otherBody: PibblPhysicsBodyHandle2D;
  /**
   * The other collider in the collision or overlap pair. See {@link PibblPhysicsColliderHandle2D}.
   */
  readonly otherCollider: PibblPhysicsColliderHandle2D;
  /** Direction from other toward self. */
  readonly normal: PibblPhysicsVector2;
  /**
   * Points defining the geometry or reported by the contact query. See
   * {@link PibblPhysicsContactPoint2D}.
   */
  readonly points: readonly PibblPhysicsContactPoint2D[];
  /** Total normal contact impulse reported for the pair. See {@link PibblPhysicsCollisionEvent2D}. */
  readonly totalNormalImpulse: number;
  /** Simulation tick associated with this observation. See {@link PibblPhysicsCollisionEvent2D}. */
  readonly tick: number;
  /** Application tag attached to the receiving collider. See {@link PibblPhysicsCollisionEvent2D}. */
  readonly selfTag: unknown;
  /** Application tag attached to the other collider. See {@link PibblPhysicsCollisionEvent2D}. */
  readonly otherTag: unknown;
}

/**
 * Bodies, colliders, tags, and tick for a sensor-overlap event.
 *
 * @see {@link PibblPhysicsBodyHandle2D}
 * @see {@link PibblPhysicsColliderHandle2D}
 * @see {@link PibblPhysicsOverlapHandler2D}
 */
export interface PibblPhysicsOverlapEvent2D {
  /** Body receiving the collision or overlap notification. See {@link PibblPhysicsBodyHandle2D}. */
  readonly selfBody: PibblPhysicsBodyHandle2D;
  /**
   * Collider receiving the collision or overlap notification. See
   * {@link PibblPhysicsColliderHandle2D}.
   */
  readonly selfCollider: PibblPhysicsColliderHandle2D;
  /** The other body in the collision or overlap pair. See {@link PibblPhysicsBodyHandle2D}. */
  readonly otherBody: PibblPhysicsBodyHandle2D;
  /**
   * The other collider in the collision or overlap pair. See {@link PibblPhysicsColliderHandle2D}.
   */
  readonly otherCollider: PibblPhysicsColliderHandle2D;
  /** Simulation tick associated with this observation. See {@link PibblPhysicsOverlapEvent2D}. */
  readonly tick: number;
  /** Application tag attached to the receiving collider. See {@link PibblPhysicsOverlapEvent2D}. */
  readonly selfTag: unknown;
  /** Application tag attached to the other collider. See {@link PibblPhysicsOverlapEvent2D}. */
  readonly otherTag: unknown;
}

/**
 * Body identity and sleeping state at the reported simulation tick.
 *
 * @see {@link PibblPhysicsBodyHandle2D}
 * @see {@link PibblPhysicsBodyStateHandler2D}
 */
export interface PibblPhysicsBodyStateEvent2D {
  /** Body identity associated with this event or result. See {@link PibblPhysicsBodyHandle2D}. */
  readonly body: PibblPhysicsBodyHandle2D;
  /** Whether the body is currently sleeping. See {@link PibblPhysicsBodyStateEvent2D}. */
  readonly sleeping: boolean;
  /** Simulation tick associated with this observation. See {@link PibblPhysicsBodyStateEvent2D}. */
  readonly tick: number;
}

export type {
  PibblPhysicsAabb2D,
  PibblPhysicsShape2D,
  PibblPhysicsShapeHit2D,
  PibblPhysicsVector2,
};

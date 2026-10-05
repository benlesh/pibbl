import type { collider2D, dynamicBody2D, kinematicBody2D, staticBody2D } from './runtime/descriptors.js';
import type { PhysicsWorld2D, crcPhysicsWorld2D } from './runtime/world-component.js';
import type { Capsule2D, Chain2D, PhysicsShape2D, Segment2D } from './canvas/components.js';
import type { overlapShape2D, queryAabb2D, raycast2D, shapeCast2D } from '../../2d.js';
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

/**
 * Category, mask, and group values controlling eligible collision pairs.
 *
 * @see {@link CRCPhysicsColliderConfiguration2D}
 * @see {@link CRCPhysicsQueryOptions2D}
 */
export interface CRCPhysicsCollisionFilter {
  /** Category bits identifying this collider for collision filtering. See {@link CRCPhysicsCollisionFilter}. */
  readonly category?: number;
  /** Category bits this collider is permitted to collide with. See {@link CRCPhysicsCollisionFilter}. */
  readonly mask?: number;
  /** Signed group override used when filtering a collider pair. See {@link CRCPhysicsCollisionFilter}. */
  readonly group?: number;
}

/**
 * Receives a collision-start or collision-end event for a collider.
 *
 * @param event - Collision pair and contact information for this notification. See
 * {@link CRCPhysicsCollisionEvent2D} .
 *
 * @see {@link CRCPhysicsCollisionEvent2D}
 * @see {@link CRCPhysicsColliderConfiguration2D}
 */
export type CRCPhysicsCollisionHandler2D = (
  event: CRCPhysicsCollisionEvent2D,
) => void;
/**
 * Receives contact impulse information for a collider hit.
 *
 * @param event - Collision pair and contact information for this notification. See
 * {@link CRCPhysicsCollisionEvent2D} .
 *
 * @see {@link CRCPhysicsCollisionEvent2D}
 * @see {@link CRCPhysicsColliderConfiguration2D}
 */
export type CRCPhysicsHitHandler2D = (
  event: CRCPhysicsCollisionEvent2D,
) => void;
/**
 * Receives sensor overlap-start or overlap-end notifications.
 *
 * @param event - Sensor overlap pair and overlap lifecycle information. See
 * {@link CRCPhysicsOverlapEvent2D} .
 *
 * @see {@link CRCPhysicsOverlapEvent2D}
 * @see {@link CRCPhysicsColliderConfiguration2D}
 */
export type CRCPhysicsOverlapHandler2D = (
  event: CRCPhysicsOverlapEvent2D,
) => void;
/**
 * Receives body sleeping-state changes at a simulation tick.
 *
 * @param event - Body state change notification. See {@link CRCPhysicsBodyStateEvent2D}.
 *
 * @see {@link CRCPhysicsBodyStateEvent2D}
 */
export type CRCPhysicsBodyStateHandler2D = (
  event: CRCPhysicsBodyStateEvent2D,
) => void;

/**
 * Shape, material, mass contribution, filtering, tags, and callbacks for a collider attachment.
 *
 * @see {@link CRCPhysicsShape2D}
 * @see {@link CRCPhysicsVector2}
 * @see {@link CRCPhysicsCollisionFilter}
 * @see {@link CRCPhysicsCollisionHandler2D}
 * @see {@link CRCPhysicsHitHandler2D}
 * @see {@link CRCPhysicsOverlapHandler2D}
 */
export interface CRCPhysicsColliderConfiguration2D {
  /** Immutable collision geometry or particle spawn shape. See {@link CRCPhysicsShape2D}. */
  readonly shape?: "self" | CRCPhysicsShape2D;
  /** Collider displacement relative to its owning body. See {@link CRCPhysicsVector2}. */
  readonly offset?: CRCPhysicsVector2;
  /** Rotation in degrees. See {@link CRCPhysicsColliderConfiguration2D}. */
  readonly rotationDegrees?: number;
  /**
   * Mass per unit area used to derive automatic mass properties. See
   * {@link CRCPhysicsColliderConfiguration2D}.
   */
  readonly density?: number;
  /** Contact friction coefficient. See {@link CRCPhysicsColliderConfiguration2D}. */
  readonly friction?: number;
  /**
   * Contact restitution coefficient controlling bounce. See
   * {@link CRCPhysicsColliderConfiguration2D}.
   */
  readonly restitution?: number;
  /**
   * Whether the collider reports overlaps instead of producing contact response. See
   * {@link CRCPhysicsColliderConfiguration2D}.
   */
  readonly sensor?: boolean;
  /**
   * Whether this collider contributes to its body's automatic mass properties. See
   * {@link CRCPhysicsColliderConfiguration2D}.
   */
  readonly contributesToMass?: boolean;
  /**
   * Category, mask, and group filtering for collision or query participation. See
   * {@link CRCPhysicsCollisionFilter}.
   */
  readonly collisionFilter?: CRCPhysicsCollisionFilter;
  /**
   * Application payload carried through physics queries and events. See
   * {@link CRCPhysicsColliderConfiguration2D}.
   */
  readonly tag?: unknown;
  /**
   * Receives the start of a contact pair involving this collider. See
   * {@link CRCPhysicsCollisionHandler2D}.
   */
  readonly onCollisionStart?: CRCPhysicsCollisionHandler2D;
  /**
   * Receives the end of a contact pair involving this collider. See
   * {@link CRCPhysicsCollisionHandler2D}.
   */
  readonly onCollisionEnd?: CRCPhysicsCollisionHandler2D;
  /** Receives contact impulse information for this collider. See {@link CRCPhysicsHitHandler2D}. */
  readonly onHit?: CRCPhysicsHitHandler2D;
  /**
   * Receives the start of a sensor overlap involving this collider. See
   * {@link CRCPhysicsOverlapHandler2D}.
   */
  readonly onOverlapStart?: CRCPhysicsOverlapHandler2D;
  /**
   * Receives the end of a sensor overlap involving this collider. See
   * {@link CRCPhysicsOverlapHandler2D}.
   */
  readonly onOverlapEnd?: CRCPhysicsOverlapHandler2D;
}

/**
 * Initial motion, mass, damping, gravity, sleeping, and collider configuration of a dynamic body.
 *
 * @see {@link CRCPhysicsBodyHandle2D}
 * @see {@link CRCPhysicsVector2}
 * @see {@link CRCPhysicsColliderConfiguration2D}
 * @see {@link CRCPhysicsShape2D}
 * @see {@link dynamicBody2D}
 */
export interface CRCPhysicsDynamicBody2DOptions {
  /**
   * Whether this operation or resource participates in updates. See
   * {@link CRCPhysicsDynamicBody2DOptions}.
   */
  readonly enabled?: boolean;
  /** Handle identity associated with the operation or body. See {@link CRCPhysicsBodyHandle2D}. */
  readonly handle?: CRCPhysicsBodyHandle2D;
  /**
   * Linear velocity in the simulation coordinate system per second. See {@link CRCPhysicsVector2}
   * .
   */
  readonly linearVelocity?: CRCPhysicsVector2;
  /** Angular velocity in degrees per second. See {@link CRCPhysicsDynamicBody2DOptions}. */
  readonly angularVelocityDegreesPerSecond?: number;
  /** Damping applied to linear motion. See {@link CRCPhysicsDynamicBody2DOptions}. */
  readonly linearDamping?: number;
  /** Damping applied to angular motion. See {@link CRCPhysicsDynamicBody2DOptions}. */
  readonly angularDamping?: number;
  /**
   * Multiplier applied to world gravity for this body. See {@link CRCPhysicsDynamicBody2DOptions}
   * .
   */
  readonly gravityScale?: number;
  /** Mass used by the spring or physics calculation. See {@link CRCPhysicsDynamicBody2DOptions}. */
  readonly mass?: "auto" | number;
  /** Whether angular motion is locked. See {@link CRCPhysicsDynamicBody2DOptions}. */
  readonly fixedRotation?: boolean;
  /** Whether the body may enter the sleeping state. See {@link CRCPhysicsDynamicBody2DOptions}. */
  readonly allowSleep?: boolean;
  /**
   * Whether continuous collision detection is enabled for the body. See
   * {@link CRCPhysicsDynamicBody2DOptions}.
   */
  readonly ccd?: boolean;
  /**
   * Whether re-enabling restores or clears the body's velocity. See
   * {@link CRCPhysicsDynamicBody2DOptions}.
   */
  readonly reenableVelocity?: "zero" | "preserve";
  /**
   * Collider configuration or identity associated with this body or query. See
   * {@link CRCPhysicsColliderConfiguration2D}, {@link CRCPhysicsShape2D}.
   */
  readonly collider?: false | CRCPhysicsColliderConfiguration2D | CRCPhysicsShape2D;
}

/**
 * Enablement, handle, and collider configuration of a static body.
 *
 * @see {@link CRCPhysicsBodyHandle2D}
 * @see {@link CRCPhysicsColliderConfiguration2D}
 * @see {@link CRCPhysicsShape2D}
 * @see {@link staticBody2D}
 */
export interface CRCPhysicsStaticBody2DOptions {
  /**
   * Whether this operation or resource participates in updates. See
   * {@link CRCPhysicsStaticBody2DOptions}.
   */
  readonly enabled?: boolean;
  /** Handle identity associated with the operation or body. See {@link CRCPhysicsBodyHandle2D}. */
  readonly handle?: CRCPhysicsBodyHandle2D;
  /**
   * Collider configuration or identity associated with this body or query. See
   * {@link CRCPhysicsColliderConfiguration2D}, {@link CRCPhysicsShape2D}.
   */
  readonly collider?: false | CRCPhysicsColliderConfiguration2D | CRCPhysicsShape2D;
}

/**
 * Reactive position and rotation targets for a kinematic body.
 *
 * @see {@link Signal}
 * @see {@link CRCPhysicsVector2}
 * @see {@link CRCPhysicsKinematicBody2DOptions}
 */
export interface CRCPhysicsKinematicTarget2D {
  /**
   * Position of the geometry, source, or selected resize handle. See {@link Signal},
   * {@link CRCPhysicsVector2}.
   */
  readonly position?: Signal<CRCPhysicsVector2>;
  /** Rotation in degrees. See {@link Signal}. */
  readonly rotationDegrees?: Signal<number>;
}

/**
 * Target signals, handle, enablement, and collider configuration of a kinematic body.
 *
 * @see {@link CRCPhysicsBodyHandle2D}
 * @see {@link CRCPhysicsKinematicTarget2D}
 * @see {@link CRCPhysicsColliderConfiguration2D}
 * @see {@link CRCPhysicsShape2D}
 * @see {@link kinematicBody2D}
 */
export interface CRCPhysicsKinematicBody2DOptions {
  /**
   * Whether this operation or resource participates in updates. See
   * {@link CRCPhysicsKinematicBody2DOptions}.
   */
  readonly enabled?: boolean;
  /** Handle identity associated with the operation or body. See {@link CRCPhysicsBodyHandle2D}. */
  readonly handle?: CRCPhysicsBodyHandle2D;
  /**
   * The selected logical target or target configuration. See {@link CRCPhysicsKinematicTarget2D}.
   */
  readonly target?: CRCPhysicsKinematicTarget2D;
  /**
   * Whether the body may enter the sleeping state. See {@link CRCPhysicsKinematicBody2DOptions}.
   */
  readonly allowSleep?: boolean;
  /**
   * Collider configuration or identity associated with this body or query. See
   * {@link CRCPhysicsColliderConfiguration2D}, {@link CRCPhysicsShape2D}.
   */
  readonly collider?: false | CRCPhysicsColliderConfiguration2D | CRCPhysicsShape2D;
}

declare const physicsAttachment2DBrand: unique symbol;
/**
 * A branded body descriptor attached to supported Canvas primitives.
 *
 * @see {@link CRCPhysicsAttachment2D}
 * @see {@link dynamicBody2D}
 * @see {@link kinematicBody2D}
 */
export interface CRCPhysicsBodyAttachment2D {
  readonly [physicsAttachment2DBrand]: "body";
}
/**
 * A branded collider descriptor attached under a physics body.
 *
 * @see {@link CRCPhysicsAttachment2D}
 * @see {@link collider2D}
 */
export interface CRCPhysicsColliderAttachment2D {
  readonly [physicsAttachment2DBrand]: "collider";
}
/**
 * A body or collider descriptor accepted by a physics-aware primitive.
 *
 * @see {@link CRCPhysicsBodyAttachment2D}
 * @see {@link CRCPhysicsColliderAttachment2D}
 * @see {@link CRCPhysicsPrimitiveProps2D}
 */
export type CRCPhysicsAttachment2D =
  CRCPhysicsBodyAttachment2D | CRCPhysicsColliderAttachment2D;

declare module "@crc/core" {
  interface CRCPhysics2DPropExtension {
    readonly physics?: CRCPhysicsAttachment2D;
  }
}

/**
 * Iteration budgets controlling the 2D solver's velocity and position work.
 *
 * @see {@link CRCPhysicsWorld2DProps}
 */
export interface CRCPhysicsSolverOptions {
  /** Solver iteration budget for velocity constraints. See {@link CRCPhysicsSolverOptions}. */
  readonly velocityIterations?: number;
  /** Solver iteration budget for position constraints. See {@link CRCPhysicsSolverOptions}. */
  readonly positionIterations?: number;
}

interface CRCPhysicsWorld2DValues {
  /**
   * Local space follows the world component viewport; root preserves root-logical coordinates.
   * Creation-only.
   */
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

/**
 * World configuration with signal-capable values and ordinary CRC children.
 *
 * @see {@link SignalValue}
 * @see {@link CRCPhysicsSolverOptions}
 * @see {@link PhysicsWorld2D}
 */
export type CRCPhysicsWorld2DProps = {
  readonly [K in keyof CRCPhysicsWorld2DValues]: K extends "children"
    ? CRCPhysicsWorld2DValues[K]
    : SignalValue<CRCPhysicsWorld2DValues[K]>;
};

/**
 * Interaction and physics attachment props shared by physics-aware primitives.
 *
 * @see {@link CRCEventHandlers}
 * @see {@link CRCEventParticipationOptions}
 * @see {@link LayoutBox}
 * @see {@link CRCPhysicsAttachment2D}
 * @see {@link PhysicsShape2DProps}
 * @see {@link Capsule2DProps}
 */
export interface CRCPhysicsPrimitiveProps2D
  extends CRCEventHandlers, CRCEventParticipationOptions {
  /** Whether the target may receive keyboard focus. See {@link CRCPhysicsPrimitiveProps2D}. */
  readonly keyboardFocusable?: boolean;
  /** Logical rectangle used for directional keyboard navigation. See {@link LayoutBox}. */
  readonly keyboardNavigationBounds?: Readonly<LayoutBox>;
  /**
   * Declarative body or collider attachment for this primitive. See {@link CRCPhysicsAttachment2D}
   * .
   */
  readonly physics?: CRCPhysicsAttachment2D;
}

/**
 * Authored inputs for PhysicsShape2D, including the declared data and presentation options.
 *
 * @see {@link CRCPhysicsPrimitiveProps2D}
 * @see {@link PhysicsShape2D}
 */
export interface PhysicsShape2DProps extends CRCPhysicsPrimitiveProps2D {}
/**
 * Supported geometry and presentation properties for PhysicsShape2D.
 *
 * @see {@link SystemStyle}
 * @see {@link PaintStyle}
 * @see {@link CursorStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link CRCPhysicsShape2D}
 * @see {@link PhysicsShape2D}
 */
export interface PhysicsShape2DStyle
  extends SystemStyle, PaintStyle, CursorStyle, BoxStyle, LayoutItemStyle {
  /** Immutable collision geometry or particle spawn shape. See {@link CRCPhysicsShape2D}. */
  readonly shape: CRCPhysicsShape2D;
  /**
   * Width used for line hit testing independently of the visible stroke width. See
   * {@link PhysicsShape2DStyle}.
   */
  readonly lineInteractionWidth?: number;
}

/**
 * Authored inputs for Capsule2D, including the declared data and presentation options.
 *
 * @see {@link CRCPhysicsPrimitiveProps2D}
 * @see {@link Capsule2D}
 */
export interface Capsule2DProps extends CRCPhysicsPrimitiveProps2D {}
/**
 * Supported geometry and presentation properties for Capsule2D.
 *
 * @see {@link SystemStyle}
 * @see {@link PaintStyle}
 * @see {@link CursorStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link CRCPhysicsVector2}
 * @see {@link Capsule2D}
 */
export interface Capsule2DStyle
  extends SystemStyle, PaintStyle, CursorStyle, BoxStyle, LayoutItemStyle {
  /** First endpoint of the shape. See {@link CRCPhysicsVector2}. */
  readonly start: CRCPhysicsVector2;
  /** Last endpoint of the shape. See {@link CRCPhysicsVector2}. */
  readonly end: CRCPhysicsVector2;
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
 * @see {@link CRCPhysicsPrimitiveProps2D}
 * @see {@link Segment2D}
 */
export interface Segment2DProps extends CRCPhysicsPrimitiveProps2D {}
/**
 * Supported geometry and presentation properties for Segment2D.
 *
 * @see {@link SystemStyle}
 * @see {@link PaintStyle}
 * @see {@link CursorStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link CRCPhysicsVector2}
 * @see {@link Segment2D}
 */
export interface Segment2DStyle
  extends SystemStyle, Omit<PaintStyle, "fill">, CursorStyle, BoxStyle, LayoutItemStyle {
  /** First endpoint of the shape. See {@link CRCPhysicsVector2}. */
  readonly start: CRCPhysicsVector2;
  /** Last endpoint of the shape. See {@link CRCPhysicsVector2}. */
  readonly end: CRCPhysicsVector2;
  /**
   * Width used for line hit testing independently of the visible stroke width. See
   * {@link Segment2DStyle}.
   */
  readonly lineInteractionWidth?: number;
}

/**
 * Authored inputs for Chain2D, including the declared data and presentation options.
 *
 * @see {@link CRCPhysicsPrimitiveProps2D}
 * @see {@link Chain2D}
 */
export interface Chain2DProps extends CRCPhysicsPrimitiveProps2D {}
/**
 * Supported geometry and presentation properties for Chain2D.
 *
 * @see {@link SystemStyle}
 * @see {@link PaintStyle}
 * @see {@link CursorStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link CRCPhysicsVector2}
 * @see {@link Chain2D}
 */
export interface Chain2DStyle
  extends SystemStyle, PaintStyle, CursorStyle, BoxStyle, LayoutItemStyle {
  /**
   * Points defining the geometry or reported by the contact query. See {@link CRCPhysicsVector2}.
   */
  readonly points: readonly CRCPhysicsVector2[];
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
 * @see {@link CRCPhysicsVector2}
 * @see {@link CRCPhysicsDynamicBody2DOptions}
 * @see {@link CRCPhysicsStaticBody2DOptions}
 * @see {@link CRCPhysicsKinematicBody2DOptions}
 */
export interface CRCPhysicsBodyHandle2D {
  readonly [bodyHandle2DBrand]: true;
  /**
   * Position of the geometry, source, or selected resize handle. See {@link Signal},
   * {@link CRCPhysicsVector2}.
   */
  readonly position: Signal<CRCPhysicsVector2>;
  /** Rotation in degrees. See {@link Signal}. */
  readonly rotationDegrees: Signal<number>;
  /**
   * Linear velocity in the simulation coordinate system per second. See {@link Signal},
   * {@link CRCPhysicsVector2}.
   */
  readonly linearVelocity: Signal<CRCPhysicsVector2>;
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
 * @see {@link CRCPhysicsQueryOptions2D}
 * @see {@link CRCPhysicsQueryHit2D}
 * @see {@link CRCPhysicsQueryMatch2D}
 */
export interface CRCPhysicsColliderHandle2D {
  readonly [colliderHandle2DBrand]: true;
}

declare const worldHandle2DBrand: unique symbol;
/**
 * Stable world identity with a reactive committed-state revision.
 *
 * @see {@link Signal}
 * @see {@link crcPhysicsWorld2D}
 * @see {@link raycast2D}
 * @see {@link shapeCast2D}
 */
export interface CRCPhysicsWorldHandle2D {
  readonly [worldHandle2DBrand]: true;
  /** Revision used to detect changes to the underlying state or geometry. See {@link Signal}. */
  readonly revision: Signal<number>;
}

/**
 * Whether a query returns its closest match, any-match boolean, or all matches.
 *
 * @see {@link CRCPhysicsQueryOptions2D}
 * @see {@link CRCPhysicsQueryResult2D}
 * @see {@link raycast2D}
 */
export type CRCPhysicsQueryMode = "closest" | "any" | "all";

/**
 * Result mode, sensor policy, collision filtering, and body/collider exclusions for world queries.
 *
 * @see {@link CRCPhysicsQueryMode}
 * @see {@link CRCPhysicsCollisionFilter}
 * @see {@link CRCPhysicsBodyHandle2D}
 * @see {@link CRCPhysicsColliderHandle2D}
 */
export interface CRCPhysicsQueryOptions2D<Mode extends CRCPhysicsQueryMode = "closest"> {
  /**
   * Selects the supported mapping, placement, or result policy. See
   * {@link CRCPhysicsQueryOptions2D}.
   */
  readonly mode?: Mode;
  /**
   * Selects `"include"` , `"exclude"` , `"only"` for sensors. See {@link CRCPhysicsQueryOptions2D}
   * .
   */
  readonly sensors?: "include" | "exclude" | "only";
  /**
   * Category, mask, and group filtering for collision or query participation. See
   * {@link CRCPhysicsCollisionFilter}.
   */
  readonly collisionFilter?: CRCPhysicsCollisionFilter;
  /** Body identity omitted from query candidates. See {@link CRCPhysicsBodyHandle2D}. */
  readonly excludeBody?: CRCPhysicsBodyHandle2D;
  /** Collider identity omitted from query candidates. See {@link CRCPhysicsColliderHandle2D}. */
  readonly excludeCollider?: CRCPhysicsColliderHandle2D;
}

/**
 * Cast geometry plus matched body/collider identities, generations, and application tag.
 *
 * @see {@link CRCPhysicsShapeHit2D}
 * @see {@link CRCPhysicsBodyHandle2D}
 * @see {@link CRCPhysicsColliderHandle2D}
 * @see {@link raycast2D}
 */
export interface CRCPhysicsQueryHit2D extends CRCPhysicsShapeHit2D {
  /** Body identity associated with this event or result. See {@link CRCPhysicsBodyHandle2D}. */
  readonly body: CRCPhysicsBodyHandle2D;
  /**
   * Collider configuration or identity associated with this body or query. See
   * {@link CRCPhysicsColliderHandle2D}.
   */
  readonly collider: CRCPhysicsColliderHandle2D;
  /** Committed generation of the matched body identity. See {@link CRCPhysicsQueryHit2D}. */
  readonly bodyGeneration: number;
  /** Committed generation of the matched collider identity. See {@link CRCPhysicsQueryHit2D}. */
  readonly colliderGeneration: number;
  /**
   * Application payload carried through physics queries and events. See
   * {@link CRCPhysicsQueryHit2D}.
   */
  readonly tag: unknown;
}

/**
 * Matched body/collider identities, generations, and tag for an overlap query.
 *
 * @see {@link CRCPhysicsBodyHandle2D}
 * @see {@link CRCPhysicsColliderHandle2D}
 * @see {@link overlapShape2D}
 * @see {@link queryAabb2D}
 */
export interface CRCPhysicsQueryMatch2D {
  /** Body identity associated with this event or result. See {@link CRCPhysicsBodyHandle2D}. */
  readonly body: CRCPhysicsBodyHandle2D;
  /**
   * Collider configuration or identity associated with this body or query. See
   * {@link CRCPhysicsColliderHandle2D}.
   */
  readonly collider: CRCPhysicsColliderHandle2D;
  /** Committed generation of the matched body identity. See {@link CRCPhysicsQueryMatch2D}. */
  readonly bodyGeneration: number;
  /** Committed generation of the matched collider identity. See {@link CRCPhysicsQueryMatch2D}. */
  readonly colliderGeneration: number;
  /**
   * Application payload carried through physics queries and events. See
   * {@link CRCPhysicsQueryMatch2D}.
   */
  readonly tag: unknown;
}

/**
 * Selects a boolean, readonly result list, or nullable closest result from the query mode.
 *
 * @see {@link CRCPhysicsQueryMode}
 * @see {@link raycast2D}
 * @see {@link shapeCast2D}
 */
export type CRCPhysicsQueryResult2D<
  Mode extends CRCPhysicsQueryMode,
  Result,
> = Mode extends "any"
  ? boolean
  : Mode extends "all"
    ? readonly Result[]
    : Result | null;

/**
 * Bodies, colliders, contact geometry, impulse, tags, and tick for a collision event.
 *
 * @see {@link CRCPhysicsBodyHandle2D}
 * @see {@link CRCPhysicsColliderHandle2D}
 * @see {@link CRCPhysicsVector2}
 * @see {@link CRCPhysicsContactPoint2D}
 * @see {@link CRCPhysicsCollisionHandler2D}
 * @see {@link CRCPhysicsHitHandler2D}
 */
export interface CRCPhysicsCollisionEvent2D {
  /** Body receiving the collision or overlap notification. See {@link CRCPhysicsBodyHandle2D}. */
  readonly selfBody: CRCPhysicsBodyHandle2D;
  /**
   * Collider receiving the collision or overlap notification. See
   * {@link CRCPhysicsColliderHandle2D}.
   */
  readonly selfCollider: CRCPhysicsColliderHandle2D;
  /** The other body in the collision or overlap pair. See {@link CRCPhysicsBodyHandle2D}. */
  readonly otherBody: CRCPhysicsBodyHandle2D;
  /**
   * The other collider in the collision or overlap pair. See {@link CRCPhysicsColliderHandle2D}.
   */
  readonly otherCollider: CRCPhysicsColliderHandle2D;
  /** Direction from other toward self. */
  readonly normal: CRCPhysicsVector2;
  /**
   * Points defining the geometry or reported by the contact query. See
   * {@link CRCPhysicsContactPoint2D}.
   */
  readonly points: readonly CRCPhysicsContactPoint2D[];
  /** Total normal contact impulse reported for the pair. See {@link CRCPhysicsCollisionEvent2D}. */
  readonly totalNormalImpulse: number;
  /** Simulation tick associated with this observation. See {@link CRCPhysicsCollisionEvent2D}. */
  readonly tick: number;
  /** Application tag attached to the receiving collider. See {@link CRCPhysicsCollisionEvent2D}. */
  readonly selfTag: unknown;
  /** Application tag attached to the other collider. See {@link CRCPhysicsCollisionEvent2D}. */
  readonly otherTag: unknown;
}

/**
 * Bodies, colliders, tags, and tick for a sensor-overlap event.
 *
 * @see {@link CRCPhysicsBodyHandle2D}
 * @see {@link CRCPhysicsColliderHandle2D}
 * @see {@link CRCPhysicsOverlapHandler2D}
 */
export interface CRCPhysicsOverlapEvent2D {
  /** Body receiving the collision or overlap notification. See {@link CRCPhysicsBodyHandle2D}. */
  readonly selfBody: CRCPhysicsBodyHandle2D;
  /**
   * Collider receiving the collision or overlap notification. See
   * {@link CRCPhysicsColliderHandle2D}.
   */
  readonly selfCollider: CRCPhysicsColliderHandle2D;
  /** The other body in the collision or overlap pair. See {@link CRCPhysicsBodyHandle2D}. */
  readonly otherBody: CRCPhysicsBodyHandle2D;
  /**
   * The other collider in the collision or overlap pair. See {@link CRCPhysicsColliderHandle2D}.
   */
  readonly otherCollider: CRCPhysicsColliderHandle2D;
  /** Simulation tick associated with this observation. See {@link CRCPhysicsOverlapEvent2D}. */
  readonly tick: number;
  /** Application tag attached to the receiving collider. See {@link CRCPhysicsOverlapEvent2D}. */
  readonly selfTag: unknown;
  /** Application tag attached to the other collider. See {@link CRCPhysicsOverlapEvent2D}. */
  readonly otherTag: unknown;
}

/**
 * Body identity and sleeping state at the reported simulation tick.
 *
 * @see {@link CRCPhysicsBodyHandle2D}
 * @see {@link CRCPhysicsBodyStateHandler2D}
 */
export interface CRCPhysicsBodyStateEvent2D {
  /** Body identity associated with this event or result. See {@link CRCPhysicsBodyHandle2D}. */
  readonly body: CRCPhysicsBodyHandle2D;
  /** Whether the body is currently sleeping. See {@link CRCPhysicsBodyStateEvent2D}. */
  readonly sleeping: boolean;
  /** Simulation tick associated with this observation. See {@link CRCPhysicsBodyStateEvent2D}. */
  readonly tick: number;
}

export type {
  CRCPhysicsAabb2D,
  CRCPhysicsShape2D,
  CRCPhysicsShapeHit2D,
  CRCPhysicsVector2,
};

import type {
  CRCPhysicsAabb2D,
  CRCPhysicsContactPoint2D,
  CRCPhysicsPose2D,
  CRCPhysicsVector2,
} from "../../2d-geometry.js";

/**
 * Diagnostic body identity, committed and presented poses, motion, sleeping state, and mass.
 *
 * @see {@link CRCPhysicsPose2D}
 * @see {@link CRCPhysicsVector2}
 * @see {@link CRCPhysicsInspection2D}
 */
export interface CRCPhysicsBodyInspection2D {
  /** Stable identifier of this resource or connection. See {@link CRCPhysicsBodyInspection2D}. */
  readonly id: number;
  /**
   * Generation counter distinguishing successive bindings of a stable identity. See
   * {@link CRCPhysicsBodyInspection2D}.
   */
  readonly generation: number;
  /**
   * Selects `"dynamic"` , `"kinematic"` , `"static"` for type. See
   * {@link CRCPhysicsBodyInspection2D}.
   */
  readonly type: "dynamic" | "kinematic" | "static";
  /**
   * Whether this operation or resource participates in updates. See
   * {@link CRCPhysicsBodyInspection2D}.
   */
  readonly enabled: boolean;
  /** Whether the body is currently sleeping. See {@link CRCPhysicsBodyInspection2D}. */
  readonly sleeping: boolean;
  /** Committed physical position and rotation. See {@link CRCPhysicsPose2D}. */
  readonly pose: CRCPhysicsPose2D;
  /** Interpolated pose currently used for drawing. See {@link CRCPhysicsPose2D}. */
  readonly presentationPose: CRCPhysicsPose2D;
  /** Center of mass in the reported physics coordinate system. See {@link CRCPhysicsVector2}. */
  readonly centerOfMass: CRCPhysicsVector2;
  /**
   * Linear velocity in the simulation coordinate system per second. See {@link CRCPhysicsVector2}
   * .
   */
  readonly linearVelocity: CRCPhysicsVector2;
  /** Angular velocity in degrees per second. See {@link CRCPhysicsBodyInspection2D}. */
  readonly angularVelocityDegreesPerSecond: number;
  /** Mass used by the spring or physics calculation. See {@link CRCPhysicsBodyInspection2D}. */
  readonly mass: number | null;
}
/**
 * Serializable collider identity, shape kinds, bounds, sensor state, and string label.
 *
 * @see {@link CRCPhysicsAabb2D}
 * @see {@link CRCPhysicsInspection2D}
 */
export interface CRCPhysicsColliderInspection2D {
  /**
   * Stable identifier of this resource or connection. See {@link CRCPhysicsColliderInspection2D}.
   */
  readonly id: number;
  /**
   * Generation counter distinguishing successive bindings of a stable identity. See
   * {@link CRCPhysicsColliderInspection2D}.
   */
  readonly generation: number;
  /** Identifier of the collider's owning body. See {@link CRCPhysicsColliderInspection2D}. */
  readonly bodyId: number;
  /**
   * Whether the collider reports overlaps instead of producing contact response. See
   * {@link CRCPhysicsColliderInspection2D}.
   */
  readonly sensor: boolean;
  /** String tags only. Arbitrary application objects are never serialized. */
  readonly label: string | null;
  /**
   * Kinds of shape geometry represented by the collider. See
   * {@link CRCPhysicsColliderInspection2D}.
   */
  readonly shapeKinds: readonly string[];
  /** Logical region constraining the content or query. See {@link CRCPhysicsAabb2D}. */
  readonly bounds: CRCPhysicsAabb2D;
}
/**
 * Diagnostic contact geometry and impulse between two collider identities.
 *
 * @see {@link CRCPhysicsVector2}
 * @see {@link CRCPhysicsContactPoint2D}
 * @see {@link CRCPhysicsInspection2D}
 */
export interface CRCPhysicsContactInspection2D {
  /**
   * Identifier of the first collider in the contact pair. See
   * {@link CRCPhysicsContactInspection2D}.
   */
  readonly firstColliderId: number;
  /**
   * Identifier of the second collider in the contact pair. See
   * {@link CRCPhysicsContactInspection2D}.
   */
  readonly secondColliderId: number;
  /**
   * Whether the collider reports overlaps instead of producing contact response. See
   * {@link CRCPhysicsContactInspection2D}.
   */
  readonly sensor: boolean;
  /** Contact or surface normal returned by this query. See {@link CRCPhysicsVector2}. */
  readonly normal: CRCPhysicsVector2;
  /**
   * Points defining the geometry or reported by the contact query. See
   * {@link CRCPhysicsContactPoint2D}.
   */
  readonly points: readonly CRCPhysicsContactPoint2D[];
  /** Normal contact impulse reported by the solver. See {@link CRCPhysicsContactInspection2D}. */
  readonly normalImpulse: number;
}
/**
 * Read-only observations, not an engine serialization/restore format.
 *
 * @see {@link CRCPhysicsBodyInspection2D}
 * @see {@link CRCPhysicsColliderInspection2D}
 * @see {@link CRCPhysicsContactInspection2D}
 */
export interface CRCPhysicsInspection2D {
  /**
   * The literal "rapier-2d@0.21.0" identifying this variant. See {@link CRCPhysicsInspection2D}.
   */
  readonly engine: "rapier-2d@0.21.0";
  /** Selects `"root"`, `"local"` for space. See {@link CRCPhysicsInspection2D}. */
  readonly space: "root" | "local";
  /**
   * Revision used to detect changes to the underlying state or geometry. See
   * {@link CRCPhysicsInspection2D}.
   */
  readonly revision: number;
  /** Simulation tick associated with this observation. See {@link CRCPhysicsInspection2D}. */
  readonly tick: number;
  /**
   * Whether the inspected world is actively advancing simulation. See
   * {@link CRCPhysicsInspection2D}.
   */
  readonly advancing: boolean;
  /**
   * Number of scheduler frames in which this world failed to advance. See
   * {@link CRCPhysicsInspection2D}.
   */
  readonly failedFrames: number;
  /**
   * Diagnostic information about the most recent simulation failure. See
   * {@link CRCPhysicsInspection2D}.
   */
  readonly lastFailure: string | null;
  /** Committed body snapshots in the inspected world. See {@link CRCPhysicsBodyInspection2D}. */
  readonly bodies: readonly CRCPhysicsBodyInspection2D[];
  /**
   * Committed collider snapshots in the inspected world. See
   * {@link CRCPhysicsColliderInspection2D}.
   */
  readonly colliders: readonly CRCPhysicsColliderInspection2D[];
  /**
   * Committed contact snapshots in the inspected world. See {@link CRCPhysicsContactInspection2D}
   * .
   */
  readonly contacts: readonly CRCPhysicsContactInspection2D[];
}

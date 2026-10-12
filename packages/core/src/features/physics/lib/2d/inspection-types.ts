import type {
  PibblPhysicsAabb2D,
  PibblPhysicsContactPoint2D,
  PibblPhysicsPose2D,
  PibblPhysicsVector2,
} from "../../2d-geometry.js";

/**
 * Diagnostic body identity, committed and presented poses, motion, sleeping state, and mass.
 *
 * @see {@link PibblPhysicsPose2D}
 * @see {@link PibblPhysicsVector2}
 * @see {@link PibblPhysicsInspection2D}
 */
export interface PibblPhysicsBodyInspection2D {
  /** Stable identifier of this resource or connection. See {@link PibblPhysicsBodyInspection2D}. */
  readonly id: number;
  /**
   * Generation counter distinguishing successive bindings of a stable identity. See
   * {@link PibblPhysicsBodyInspection2D}.
   */
  readonly generation: number;
  /**
   * Selects `"dynamic"` , `"kinematic"` , `"static"` for type. See
   * {@link PibblPhysicsBodyInspection2D}.
   */
  readonly type: "dynamic" | "kinematic" | "static";
  /**
   * Whether this operation or resource participates in updates. See
   * {@link PibblPhysicsBodyInspection2D}.
   */
  readonly enabled: boolean;
  /** Whether the body is currently sleeping. See {@link PibblPhysicsBodyInspection2D}. */
  readonly sleeping: boolean;
  /** Committed physical position and rotation. See {@link PibblPhysicsPose2D}. */
  readonly pose: PibblPhysicsPose2D;
  /** Interpolated pose currently used for drawing. See {@link PibblPhysicsPose2D}. */
  readonly presentationPose: PibblPhysicsPose2D;
  /** Center of mass in the reported physics coordinate system. See {@link PibblPhysicsVector2}. */
  readonly centerOfMass: PibblPhysicsVector2;
  /**
   * Linear velocity in the simulation coordinate system per second. See {@link PibblPhysicsVector2}
   * .
   */
  readonly linearVelocity: PibblPhysicsVector2;
  /** Angular velocity in degrees per second. See {@link PibblPhysicsBodyInspection2D}. */
  readonly angularVelocityDegreesPerSecond: number;
  /** Mass used by the spring or physics calculation. See {@link PibblPhysicsBodyInspection2D}. */
  readonly mass: number | null;
}
/**
 * Serializable collider identity, shape kinds, bounds, sensor state, and string label.
 *
 * @see {@link PibblPhysicsAabb2D}
 * @see {@link PibblPhysicsInspection2D}
 */
export interface PibblPhysicsColliderInspection2D {
  /**
   * Stable identifier of this resource or connection. See {@link PibblPhysicsColliderInspection2D}.
   */
  readonly id: number;
  /**
   * Generation counter distinguishing successive bindings of a stable identity. See
   * {@link PibblPhysicsColliderInspection2D}.
   */
  readonly generation: number;
  /** Identifier of the collider's owning body. See {@link PibblPhysicsColliderInspection2D}. */
  readonly bodyId: number;
  /**
   * Whether the collider reports overlaps instead of producing contact response. See
   * {@link PibblPhysicsColliderInspection2D}.
   */
  readonly sensor: boolean;
  /** String tags only. Arbitrary application objects are never serialized. */
  readonly label: string | null;
  /**
   * Kinds of shape geometry represented by the collider. See
   * {@link PibblPhysicsColliderInspection2D}.
   */
  readonly shapeKinds: readonly string[];
  /** Logical region constraining the content or query. See {@link PibblPhysicsAabb2D}. */
  readonly bounds: PibblPhysicsAabb2D;
}
/**
 * Diagnostic contact geometry and impulse between two collider identities.
 *
 * @see {@link PibblPhysicsVector2}
 * @see {@link PibblPhysicsContactPoint2D}
 * @see {@link PibblPhysicsInspection2D}
 */
export interface PibblPhysicsContactInspection2D {
  /**
   * Identifier of the first collider in the contact pair. See
   * {@link PibblPhysicsContactInspection2D}.
   */
  readonly firstColliderId: number;
  /**
   * Identifier of the second collider in the contact pair. See
   * {@link PibblPhysicsContactInspection2D}.
   */
  readonly secondColliderId: number;
  /**
   * Whether the collider reports overlaps instead of producing contact response. See
   * {@link PibblPhysicsContactInspection2D}.
   */
  readonly sensor: boolean;
  /** Contact or surface normal returned by this query. See {@link PibblPhysicsVector2}. */
  readonly normal: PibblPhysicsVector2;
  /**
   * Points defining the geometry or reported by the contact query. See
   * {@link PibblPhysicsContactPoint2D}.
   */
  readonly points: readonly PibblPhysicsContactPoint2D[];
  /** Normal contact impulse reported by the solver. See {@link PibblPhysicsContactInspection2D}. */
  readonly normalImpulse: number;
}
/**
 * Read-only observations, not an engine serialization/restore format.
 *
 * @see {@link PibblPhysicsBodyInspection2D}
 * @see {@link PibblPhysicsColliderInspection2D}
 * @see {@link PibblPhysicsContactInspection2D}
 */
export interface PibblPhysicsInspection2D {
  /**
   * The literal "rapier-2d@0.21.0" identifying this variant. See {@link PibblPhysicsInspection2D}.
   */
  readonly engine: "rapier-2d@0.21.0";
  /** Selects `"root"`, `"local"` for space. See {@link PibblPhysicsInspection2D}. */
  readonly space: "root" | "local";
  /**
   * Revision used to detect changes to the underlying state or geometry. See
   * {@link PibblPhysicsInspection2D}.
   */
  readonly revision: number;
  /** Simulation tick associated with this observation. See {@link PibblPhysicsInspection2D}. */
  readonly tick: number;
  /**
   * Whether the inspected world is actively advancing simulation. See
   * {@link PibblPhysicsInspection2D}.
   */
  readonly advancing: boolean;
  /**
   * Number of scheduler frames in which this world failed to advance. See
   * {@link PibblPhysicsInspection2D}.
   */
  readonly failedFrames: number;
  /**
   * Diagnostic information about the most recent simulation failure. See
   * {@link PibblPhysicsInspection2D}.
   */
  readonly lastFailure: string | null;
  /** Committed body snapshots in the inspected world. See {@link PibblPhysicsBodyInspection2D}. */
  readonly bodies: readonly PibblPhysicsBodyInspection2D[];
  /**
   * Committed collider snapshots in the inspected world. See
   * {@link PibblPhysicsColliderInspection2D}.
   */
  readonly colliders: readonly PibblPhysicsColliderInspection2D[];
  /**
   * Committed contact snapshots in the inspected world. See {@link PibblPhysicsContactInspection2D}
   * .
   */
  readonly contacts: readonly PibblPhysicsContactInspection2D[];
}

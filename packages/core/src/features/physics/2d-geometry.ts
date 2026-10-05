import type { boundsOfShape2D, massProperties2D, transformShape2D } from './lib/2d/shapes.js';
import type { queryAabb2D, raycast2D } from './2d.js';
import type { raycastShape2D, shapeCastAgainstShape2D } from './lib/2d/collision/casts.js';
import type { PibblPhysicsCollisionEvent2D, PibblPhysicsQueryHit2D } from './lib/2d/types.js';
import type { PibblPhysicsContactInspection2D } from './lib/2d/inspection-types.js';
/**
 * An x/y pair in the 2D physics coordinate system.
 *
 * @see {@link PibblPhysicsPose2D}
 * @see {@link PibblPhysicsAabb2D}
 * @see {@link PibblPhysicsRay2D}
 */
export type PibblPhysicsVector2 = readonly [x: number, y: number];

/**
 * Position and rotation in degrees for a 2D shape or body.
 *
 * @see {@link PibblPhysicsVector2}
 * @see {@link PibblPhysicsTransform2D}
 * @see {@link containsPoint2D}
 */
export interface PibblPhysicsPose2D {
  /** Position of the geometry, source, or selected resize handle. See {@link PibblPhysicsVector2}. */
  readonly position: PibblPhysicsVector2;
  /** Rotation in degrees. See {@link PibblPhysicsPose2D}. */
  readonly rotationDegrees: number;
}

/**
 * A rigid 2D transform expressed as position and rotation in degrees.
 *
 * @see {@link PibblPhysicsPose2D}
 * @see {@link transformShape2D}
 */
export type PibblPhysicsTransform2D = PibblPhysicsPose2D;

/**
 * Axis-aligned bounds expressed as minimum and maximum coordinates.
 *
 * @see {@link PibblPhysicsVector2}
 * @see {@link boundsOfShape2D}
 * @see {@link queryAabb2D}
 */
export interface PibblPhysicsAabb2D {
  /** Lower bound of the coordinate or sampling interval. See {@link PibblPhysicsVector2}. */
  readonly min: PibblPhysicsVector2;
  /** Upper bound of the coordinate or sampling interval. See {@link PibblPhysicsVector2}. */
  readonly max: PibblPhysicsVector2;
}

/**
 * Origin, direction, and maximum travel distance of a 2D query ray.
 *
 * @see {@link PibblPhysicsVector2}
 * @see {@link raycastShape2D}
 * @see {@link raycast2D}
 */
export interface PibblPhysicsRay2D {
  /** Origin of the transform or geometric query. See {@link PibblPhysicsVector2}. */
  readonly origin: PibblPhysicsVector2;
  /** Direction in which this operation proceeds. See {@link PibblPhysicsVector2}. */
  readonly direction: PibblPhysicsVector2;
  /** Maximum distance accepted by the query. See {@link PibblPhysicsRay2D}. */
  readonly maxDistance: number;
}

declare const physicsShape2DBrand: unique symbol;
/**
 * An immutable branded shape created by the public 2D geometry constructors.
 *
 * @see {@link containsPoint2D}
 * @see {@link distanceBetweenShapes2D}
 * @see {@link overlapShapes2D}
 */
export interface PibblPhysicsShape2D {
  readonly [physicsShape2DBrand]: true;
}

/**
 * Area, centroid, mass, and rotational inertia derived from a shape and density.
 *
 * @see {@link PibblPhysicsVector2}
 * @see {@link massProperties2D}
 */
export interface PibblPhysicsMassProperties2D {
  /** Area enclosed by the shape. See {@link PibblPhysicsMassProperties2D}. */
  readonly area: number;
  /** Area-weighted center of the shape. See {@link PibblPhysicsVector2}. */
  readonly centroid: PibblPhysicsVector2;
  /** Mass used by the spring or physics calculation. See {@link PibblPhysicsMassProperties2D}. */
  readonly mass: number;
  /** Moment of inertia about the shape's center of mass. See {@link PibblPhysicsMassProperties2D}. */
  readonly rotationalInertia: number;
}

/**
 * Signed separation, witness points, and normal between two posed shapes.
 *
 * @see {@link PibblPhysicsVector2}
 * @see {@link distanceBetweenShapes2D}
 */
export interface PibblPhysicsDistance2D {
  /** Signed distance between the witness points. See {@link PibblPhysicsDistance2D}. */
  readonly separation: number;
  /** Witness point on the first shape. See {@link PibblPhysicsVector2}. */
  readonly pointOnFirst: PibblPhysicsVector2;
  /** Witness point on the second shape. See {@link PibblPhysicsVector2}. */
  readonly pointOnSecond: PibblPhysicsVector2;
  /** Direction from the second shape toward the first. */
  readonly normal: PibblPhysicsVector2;
}

/**
 * A pair of contact witness points and their signed separation.
 *
 * @see {@link PibblPhysicsVector2}
 * @see {@link PibblPhysicsShapeContact2D}
 * @see {@link PibblPhysicsCollisionEvent2D}
 * @see {@link PibblPhysicsContactInspection2D}
 */
export interface PibblPhysicsContactPoint2D {
  /** Witness point on the first shape. See {@link PibblPhysicsVector2}. */
  readonly pointOnFirst: PibblPhysicsVector2;
  /** Witness point on the second shape. See {@link PibblPhysicsVector2}. */
  readonly pointOnSecond: PibblPhysicsVector2;
  /** Signed distance between the witness points. See {@link PibblPhysicsContactPoint2D}. */
  readonly separation: number;
}

/**
 * Contact normal and witness-point pairs for two overlapping or touching shapes.
 *
 * @see {@link PibblPhysicsVector2}
 * @see {@link PibblPhysicsContactPoint2D}
 * @see {@link contactBetweenShapes2D}
 */
export interface PibblPhysicsShapeContact2D {
  /** Direction from the second shape toward the first. */
  readonly normal: PibblPhysicsVector2;
  /**
   * Points defining the geometry or reported by the contact query. See
   * {@link PibblPhysicsContactPoint2D}.
   */
  readonly points: readonly PibblPhysicsContactPoint2D[];
}

/**
 * Point, normal, distance, and time of impact returned by a geometry cast.
 *
 * @see {@link PibblPhysicsVector2}
 * @see {@link raycastShape2D}
 * @see {@link shapeCastAgainstShape2D}
 * @see {@link PibblPhysicsQueryHit2D}
 */
export interface PibblPhysicsShapeHit2D {
  /** A point in the operation's coordinate system. See {@link PibblPhysicsVector2}. */
  readonly point: PibblPhysicsVector2;
  /** Contact or surface normal returned by this query. See {@link PibblPhysicsVector2}. */
  readonly normal: PibblPhysicsVector2;
  /**
   * Distance measured in this query or guide's coordinate system. See {@link PibblPhysicsShapeHit2D}
   * .
   */
  readonly distance: number;
  /** Position along the cast at which contact first occurs. See {@link PibblPhysicsShapeHit2D}. */
  readonly timeOfImpact: number;
}

export {
  arcShape2D,
  boundsOfShape2D,
  boxShape2D,
  capsuleShape2D,
  chainShape2D,
  circleShape2D,
  ellipseShape2D,
  massProperties2D,
  polygonShape2D,
  roundedBoxShape2D,
  segmentShape2D,
  transformShape2D,
  wedgeShape2D,
} from './lib/2d/shapes.js';

import {
  contactBetweenPreparedShapes2D,
  containsPointInShape2D,
  distanceBetweenPreparedShapes2D,
  overlapPreparedShapes2D,
} from './lib/2d/collision/pairs.js';
export {
  raycastShape2D,
  shapeCastAgainstShape2D,
} from './lib/2d/collision/casts.js';

/**
 * Tests whether a point lies within a posed shape without creating a physics world.
 *
 * @param shape - Shape to test. See {@link PibblPhysicsShape2D}.
 * @param pose - Shape pose. See {@link PibblPhysicsPose2D}.
 * @param point - Point in the same coordinate space as the posed shape. See
 * {@link PibblPhysicsVector2} .
 * @returns Whether the posed shape contains the point.
 *
 * @see {@link PibblPhysicsShape2D}
 * @see {@link PibblPhysicsPose2D}
 * @see {@link PibblPhysicsVector2}
 */
export function containsPoint2D(
  shape: PibblPhysicsShape2D,
  pose: PibblPhysicsPose2D,
  point: PibblPhysicsVector2,
): boolean {
  return containsPointInShape2D(shape, pose, point);
}

/**
 * Computes signed separation and witness geometry between two posed shapes.
 *
 * @param first - First shape. See {@link PibblPhysicsShape2D}.
 * @param firstPose - Pose of the first shape. See {@link PibblPhysicsPose2D}.
 * @param second - Second shape. See {@link PibblPhysicsShape2D}.
 * @param secondPose - Pose of the second shape. See {@link PibblPhysicsPose2D}.
 * @returns Distance and closest-point information for the two posed shapes. See
 * {@link PibblPhysicsDistance2D} .
 *
 * @see {@link PibblPhysicsShape2D}
 * @see {@link PibblPhysicsPose2D}
 * @see {@link PibblPhysicsDistance2D}
 */
export function distanceBetweenShapes2D(
  first: PibblPhysicsShape2D,
  firstPose: PibblPhysicsPose2D,
  second: PibblPhysicsShape2D,
  secondPose: PibblPhysicsPose2D,
): PibblPhysicsDistance2D {
  return distanceBetweenPreparedShapes2D(first, firstPose, second, secondPose);
}

/**
 * Tests whether two posed shapes overlap without creating a physics world.
 *
 * @param first - First shape. See {@link PibblPhysicsShape2D}.
 * @param firstPose - Pose of the first shape. See {@link PibblPhysicsPose2D}.
 * @param second - Second shape. See {@link PibblPhysicsShape2D}.
 * @param secondPose - Pose of the second shape. See {@link PibblPhysicsPose2D}.
 * @returns Whether the two posed shapes overlap.
 *
 * @see {@link PibblPhysicsShape2D}
 * @see {@link PibblPhysicsPose2D}
 */
export function overlapShapes2D(
  first: PibblPhysicsShape2D,
  firstPose: PibblPhysicsPose2D,
  second: PibblPhysicsShape2D,
  secondPose: PibblPhysicsPose2D,
): boolean {
  return overlapPreparedShapes2D(first, firstPose, second, secondPose);
}

/**
 * Computes contact geometry for two posed shapes, or null when they do not contact.
 *
 * @param first - First shape. See {@link PibblPhysicsShape2D}.
 * @param firstPose - Pose of the first shape. See {@link PibblPhysicsPose2D}.
 * @param second - Second shape. See {@link PibblPhysicsShape2D}.
 * @param secondPose - Pose of the second shape. See {@link PibblPhysicsPose2D}.
 * @returns Contact information, or null when the shapes do not contact. See
 * {@link PibblPhysicsShapeContact2D} .
 *
 * @see {@link PibblPhysicsShape2D}
 * @see {@link PibblPhysicsPose2D}
 * @see {@link PibblPhysicsShapeContact2D}
 */
export function contactBetweenShapes2D(
  first: PibblPhysicsShape2D,
  firstPose: PibblPhysicsPose2D,
  second: PibblPhysicsShape2D,
  secondPose: PibblPhysicsPose2D,
): PibblPhysicsShapeContact2D | null {
  return contactBetweenPreparedShapes2D(first, firstPose, second, secondPose);
}

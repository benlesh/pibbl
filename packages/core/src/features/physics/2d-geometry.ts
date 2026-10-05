import type { boundsOfShape2D, massProperties2D, transformShape2D } from './lib/2d/shapes.js';
import type { queryAabb2D, raycast2D } from './2d.js';
import type { raycastShape2D, shapeCastAgainstShape2D } from './lib/2d/collision/casts.js';
import type { CRCPhysicsCollisionEvent2D, CRCPhysicsQueryHit2D } from './lib/2d/types.js';
import type { CRCPhysicsContactInspection2D } from './lib/2d/inspection-types.js';
/**
 * An x/y pair in the 2D physics coordinate system.
 *
 * @see {@link CRCPhysicsPose2D}
 * @see {@link CRCPhysicsAabb2D}
 * @see {@link CRCPhysicsRay2D}
 */
export type CRCPhysicsVector2 = readonly [x: number, y: number];

/**
 * Position and rotation in degrees for a 2D shape or body.
 *
 * @see {@link CRCPhysicsVector2}
 * @see {@link CRCPhysicsTransform2D}
 * @see {@link containsPoint2D}
 */
export interface CRCPhysicsPose2D {
  /** Position of the geometry, source, or selected resize handle. See {@link CRCPhysicsVector2}. */
  readonly position: CRCPhysicsVector2;
  /** Rotation in degrees. See {@link CRCPhysicsPose2D}. */
  readonly rotationDegrees: number;
}

/**
 * A rigid 2D transform expressed as position and rotation in degrees.
 *
 * @see {@link CRCPhysicsPose2D}
 * @see {@link transformShape2D}
 */
export type CRCPhysicsTransform2D = CRCPhysicsPose2D;

/**
 * Axis-aligned bounds expressed as minimum and maximum coordinates.
 *
 * @see {@link CRCPhysicsVector2}
 * @see {@link boundsOfShape2D}
 * @see {@link queryAabb2D}
 */
export interface CRCPhysicsAabb2D {
  /** Lower bound of the coordinate or sampling interval. See {@link CRCPhysicsVector2}. */
  readonly min: CRCPhysicsVector2;
  /** Upper bound of the coordinate or sampling interval. See {@link CRCPhysicsVector2}. */
  readonly max: CRCPhysicsVector2;
}

/**
 * Origin, direction, and maximum travel distance of a 2D query ray.
 *
 * @see {@link CRCPhysicsVector2}
 * @see {@link raycastShape2D}
 * @see {@link raycast2D}
 */
export interface CRCPhysicsRay2D {
  /** Origin of the transform or geometric query. See {@link CRCPhysicsVector2}. */
  readonly origin: CRCPhysicsVector2;
  /** Direction in which this operation proceeds. See {@link CRCPhysicsVector2}. */
  readonly direction: CRCPhysicsVector2;
  /** Maximum distance accepted by the query. See {@link CRCPhysicsRay2D}. */
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
export interface CRCPhysicsShape2D {
  readonly [physicsShape2DBrand]: true;
}

/**
 * Area, centroid, mass, and rotational inertia derived from a shape and density.
 *
 * @see {@link CRCPhysicsVector2}
 * @see {@link massProperties2D}
 */
export interface CRCPhysicsMassProperties2D {
  /** Area enclosed by the shape. See {@link CRCPhysicsMassProperties2D}. */
  readonly area: number;
  /** Area-weighted center of the shape. See {@link CRCPhysicsVector2}. */
  readonly centroid: CRCPhysicsVector2;
  /** Mass used by the spring or physics calculation. See {@link CRCPhysicsMassProperties2D}. */
  readonly mass: number;
  /** Moment of inertia about the shape's center of mass. See {@link CRCPhysicsMassProperties2D}. */
  readonly rotationalInertia: number;
}

/**
 * Signed separation, witness points, and normal between two posed shapes.
 *
 * @see {@link CRCPhysicsVector2}
 * @see {@link distanceBetweenShapes2D}
 */
export interface CRCPhysicsDistance2D {
  /** Signed distance between the witness points. See {@link CRCPhysicsDistance2D}. */
  readonly separation: number;
  /** Witness point on the first shape. See {@link CRCPhysicsVector2}. */
  readonly pointOnFirst: CRCPhysicsVector2;
  /** Witness point on the second shape. See {@link CRCPhysicsVector2}. */
  readonly pointOnSecond: CRCPhysicsVector2;
  /** Direction from the second shape toward the first. */
  readonly normal: CRCPhysicsVector2;
}

/**
 * A pair of contact witness points and their signed separation.
 *
 * @see {@link CRCPhysicsVector2}
 * @see {@link CRCPhysicsShapeContact2D}
 * @see {@link CRCPhysicsCollisionEvent2D}
 * @see {@link CRCPhysicsContactInspection2D}
 */
export interface CRCPhysicsContactPoint2D {
  /** Witness point on the first shape. See {@link CRCPhysicsVector2}. */
  readonly pointOnFirst: CRCPhysicsVector2;
  /** Witness point on the second shape. See {@link CRCPhysicsVector2}. */
  readonly pointOnSecond: CRCPhysicsVector2;
  /** Signed distance between the witness points. See {@link CRCPhysicsContactPoint2D}. */
  readonly separation: number;
}

/**
 * Contact normal and witness-point pairs for two overlapping or touching shapes.
 *
 * @see {@link CRCPhysicsVector2}
 * @see {@link CRCPhysicsContactPoint2D}
 * @see {@link contactBetweenShapes2D}
 */
export interface CRCPhysicsShapeContact2D {
  /** Direction from the second shape toward the first. */
  readonly normal: CRCPhysicsVector2;
  /**
   * Points defining the geometry or reported by the contact query. See
   * {@link CRCPhysicsContactPoint2D}.
   */
  readonly points: readonly CRCPhysicsContactPoint2D[];
}

/**
 * Point, normal, distance, and time of impact returned by a geometry cast.
 *
 * @see {@link CRCPhysicsVector2}
 * @see {@link raycastShape2D}
 * @see {@link shapeCastAgainstShape2D}
 * @see {@link CRCPhysicsQueryHit2D}
 */
export interface CRCPhysicsShapeHit2D {
  /** A point in the operation's coordinate system. See {@link CRCPhysicsVector2}. */
  readonly point: CRCPhysicsVector2;
  /** Contact or surface normal returned by this query. See {@link CRCPhysicsVector2}. */
  readonly normal: CRCPhysicsVector2;
  /**
   * Distance measured in this query or guide's coordinate system. See {@link CRCPhysicsShapeHit2D}
   * .
   */
  readonly distance: number;
  /** Position along the cast at which contact first occurs. See {@link CRCPhysicsShapeHit2D}. */
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
 * @param shape - Shape to test. See {@link CRCPhysicsShape2D}.
 * @param pose - Shape pose. See {@link CRCPhysicsPose2D}.
 * @param point - Point in the same coordinate space as the posed shape. See
 * {@link CRCPhysicsVector2} .
 * @returns Whether the posed shape contains the point.
 *
 * @see {@link CRCPhysicsShape2D}
 * @see {@link CRCPhysicsPose2D}
 * @see {@link CRCPhysicsVector2}
 */
export function containsPoint2D(
  shape: CRCPhysicsShape2D,
  pose: CRCPhysicsPose2D,
  point: CRCPhysicsVector2,
): boolean {
  return containsPointInShape2D(shape, pose, point);
}

/**
 * Computes signed separation and witness geometry between two posed shapes.
 *
 * @param first - First shape. See {@link CRCPhysicsShape2D}.
 * @param firstPose - Pose of the first shape. See {@link CRCPhysicsPose2D}.
 * @param second - Second shape. See {@link CRCPhysicsShape2D}.
 * @param secondPose - Pose of the second shape. See {@link CRCPhysicsPose2D}.
 * @returns Distance and closest-point information for the two posed shapes. See
 * {@link CRCPhysicsDistance2D} .
 *
 * @see {@link CRCPhysicsShape2D}
 * @see {@link CRCPhysicsPose2D}
 * @see {@link CRCPhysicsDistance2D}
 */
export function distanceBetweenShapes2D(
  first: CRCPhysicsShape2D,
  firstPose: CRCPhysicsPose2D,
  second: CRCPhysicsShape2D,
  secondPose: CRCPhysicsPose2D,
): CRCPhysicsDistance2D {
  return distanceBetweenPreparedShapes2D(first, firstPose, second, secondPose);
}

/**
 * Tests whether two posed shapes overlap without creating a physics world.
 *
 * @param first - First shape. See {@link CRCPhysicsShape2D}.
 * @param firstPose - Pose of the first shape. See {@link CRCPhysicsPose2D}.
 * @param second - Second shape. See {@link CRCPhysicsShape2D}.
 * @param secondPose - Pose of the second shape. See {@link CRCPhysicsPose2D}.
 * @returns Whether the two posed shapes overlap.
 *
 * @see {@link CRCPhysicsShape2D}
 * @see {@link CRCPhysicsPose2D}
 */
export function overlapShapes2D(
  first: CRCPhysicsShape2D,
  firstPose: CRCPhysicsPose2D,
  second: CRCPhysicsShape2D,
  secondPose: CRCPhysicsPose2D,
): boolean {
  return overlapPreparedShapes2D(first, firstPose, second, secondPose);
}

/**
 * Computes contact geometry for two posed shapes, or null when they do not contact.
 *
 * @param first - First shape. See {@link CRCPhysicsShape2D}.
 * @param firstPose - Pose of the first shape. See {@link CRCPhysicsPose2D}.
 * @param second - Second shape. See {@link CRCPhysicsShape2D}.
 * @param secondPose - Pose of the second shape. See {@link CRCPhysicsPose2D}.
 * @returns Contact information, or null when the shapes do not contact. See
 * {@link CRCPhysicsShapeContact2D} .
 *
 * @see {@link CRCPhysicsShape2D}
 * @see {@link CRCPhysicsPose2D}
 * @see {@link CRCPhysicsShapeContact2D}
 */
export function contactBetweenShapes2D(
  first: CRCPhysicsShape2D,
  firstPose: CRCPhysicsPose2D,
  second: CRCPhysicsShape2D,
  secondPose: CRCPhysicsPose2D,
): CRCPhysicsShapeContact2D | null {
  return contactBetweenPreparedShapes2D(first, firstPose, second, secondPose);
}

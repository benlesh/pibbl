export type CRCPhysicsVector2 = readonly [x: number, y: number];

export interface CRCPhysicsPose2D {
  readonly position: CRCPhysicsVector2;
  readonly rotationDegrees: number;
}

export type CRCPhysicsTransform2D = CRCPhysicsPose2D;

export interface CRCPhysicsAabb2D {
  readonly min: CRCPhysicsVector2;
  readonly max: CRCPhysicsVector2;
}

export interface CRCPhysicsRay2D {
  readonly origin: CRCPhysicsVector2;
  readonly direction: CRCPhysicsVector2;
  readonly maxDistance: number;
}

declare const physicsShape2DBrand: unique symbol;
export interface CRCPhysicsShape2D {
  readonly [physicsShape2DBrand]: true;
}

export interface CRCPhysicsMassProperties2D {
  readonly area: number;
  readonly centroid: CRCPhysicsVector2;
  readonly mass: number;
  readonly rotationalInertia: number;
}

export interface CRCPhysicsDistance2D {
  readonly separation: number;
  readonly pointOnFirst: CRCPhysicsVector2;
  readonly pointOnSecond: CRCPhysicsVector2;
  /** Direction from the second shape toward the first. */
  readonly normal: CRCPhysicsVector2;
}

export interface CRCPhysicsContactPoint2D {
  readonly pointOnFirst: CRCPhysicsVector2;
  readonly pointOnSecond: CRCPhysicsVector2;
  readonly separation: number;
}

export interface CRCPhysicsShapeContact2D {
  /** Direction from the second shape toward the first. */
  readonly normal: CRCPhysicsVector2;
  readonly points: readonly CRCPhysicsContactPoint2D[];
}

export interface CRCPhysicsShapeHit2D {
  readonly point: CRCPhysicsVector2;
  readonly normal: CRCPhysicsVector2;
  readonly distance: number;
  readonly timeOfImpact: number;
}

export function circleShape2D(
  input: Readonly<{
    radius: number;
    center?: CRCPhysicsVector2;
  }>,
): CRCPhysicsShape2D {
  void input;
  return unavailable('circleShape2D');
}

export function ellipseShape2D(
  input: Readonly<{
    radiusX: number;
    radiusY: number;
    center?: CRCPhysicsVector2;
    rotationDegrees?: number;
  }>,
): CRCPhysicsShape2D {
  void input;
  return unavailable('ellipseShape2D');
}

export function boxShape2D(
  input: Readonly<{
    width: number;
    height: number;
    center?: CRCPhysicsVector2;
  }>,
): CRCPhysicsShape2D {
  void input;
  return unavailable('boxShape2D');
}

export function roundedBoxShape2D(
  input: Readonly<{
    width: number;
    height: number;
    radius:
      | number
      | readonly [
          topLeft: number,
          topRight: number,
          bottomRight: number,
          bottomLeft: number,
        ];
    center?: CRCPhysicsVector2;
  }>,
): CRCPhysicsShape2D {
  void input;
  return unavailable('roundedBoxShape2D');
}

export function capsuleShape2D(
  input: Readonly<{
    start: CRCPhysicsVector2;
    end: CRCPhysicsVector2;
    radius: number;
  }>,
): CRCPhysicsShape2D {
  void input;
  return unavailable('capsuleShape2D');
}

export function arcShape2D(
  input: Readonly<{
    center?: CRCPhysicsVector2;
    radius: number;
    startAngleRadians: number;
    endAngleRadians: number;
    counterclockwise?: boolean;
    thickness: number;
  }>,
): CRCPhysicsShape2D {
  void input;
  return unavailable('arcShape2D');
}

export function wedgeShape2D(
  input: Readonly<{
    center?: CRCPhysicsVector2;
    radius: number;
    startAngleRadians: number;
    endAngleRadians: number;
    counterclockwise?: boolean;
  }>,
): CRCPhysicsShape2D {
  void input;
  return unavailable('wedgeShape2D');
}

export function segmentShape2D(
  input: Readonly<{
    start: CRCPhysicsVector2;
    end: CRCPhysicsVector2;
  }>,
): CRCPhysicsShape2D {
  void input;
  return unavailable('segmentShape2D');
}

export function chainShape2D(
  input: Readonly<{
    points: readonly CRCPhysicsVector2[];
    closed?: boolean;
    radius?: number;
  }>,
): CRCPhysicsShape2D {
  void input;
  return unavailable('chainShape2D');
}

export function polygonShape2D(
  input: Readonly<{
    points: readonly CRCPhysicsVector2[];
  }>,
): CRCPhysicsShape2D {
  void input;
  return unavailable('polygonShape2D');
}

export function boundsOfShape2D(
  shape: CRCPhysicsShape2D,
  pose?: CRCPhysicsPose2D,
): CRCPhysicsAabb2D {
  void shape;
  void pose;
  return unavailable('boundsOfShape2D');
}

export function massProperties2D(
  shape: CRCPhysicsShape2D,
  options?: Readonly<{ density?: number }>,
): CRCPhysicsMassProperties2D {
  void shape;
  void options;
  return unavailable('massProperties2D');
}

export function containsPoint2D(
  shape: CRCPhysicsShape2D,
  pose: CRCPhysicsPose2D,
  point: CRCPhysicsVector2,
): boolean {
  void shape;
  void pose;
  void point;
  return unavailable('containsPoint2D');
}

export function distanceBetweenShapes2D(
  first: CRCPhysicsShape2D,
  firstPose: CRCPhysicsPose2D,
  second: CRCPhysicsShape2D,
  secondPose: CRCPhysicsPose2D,
): CRCPhysicsDistance2D {
  void first;
  void firstPose;
  void second;
  void secondPose;
  return unavailable('distanceBetweenShapes2D');
}

export function overlapShapes2D(
  first: CRCPhysicsShape2D,
  firstPose: CRCPhysicsPose2D,
  second: CRCPhysicsShape2D,
  secondPose: CRCPhysicsPose2D,
): boolean {
  void first;
  void firstPose;
  void second;
  void secondPose;
  return unavailable('overlapShapes2D');
}

export function contactBetweenShapes2D(
  first: CRCPhysicsShape2D,
  firstPose: CRCPhysicsPose2D,
  second: CRCPhysicsShape2D,
  secondPose: CRCPhysicsPose2D,
): CRCPhysicsShapeContact2D | null {
  void first;
  void firstPose;
  void second;
  void secondPose;
  return unavailable('contactBetweenShapes2D');
}

export function raycastShape2D(
  shape: CRCPhysicsShape2D,
  pose: CRCPhysicsPose2D,
  ray: CRCPhysicsRay2D,
  options?: Readonly<{ includeInitialOverlap?: boolean }>,
): CRCPhysicsShapeHit2D | null {
  void shape;
  void pose;
  void ray;
  void options;
  return unavailable('raycastShape2D');
}

export function shapeCastAgainstShape2D(
  moving: CRCPhysicsShape2D,
  from: CRCPhysicsPose2D,
  translation: CRCPhysicsVector2,
  target: CRCPhysicsShape2D,
  targetPose: CRCPhysicsPose2D,
  options?: Readonly<{ includeInitialOverlap?: boolean }>,
): CRCPhysicsShapeHit2D | null {
  void moving;
  void from;
  void translation;
  void target;
  void targetPose;
  void options;
  return unavailable('shapeCastAgainstShape2D');
}

export function transformShape2D(
  shape: CRCPhysicsShape2D,
  transform: CRCPhysicsTransform2D,
): CRCPhysicsShape2D {
  void shape;
  void transform;
  return unavailable('transformShape2D');
}

function unavailable(name: string): never {
  throw new Error(
    `${name} is part of the @crc/physics public scaffold and is not ` +
    'implemented by this foundation task yet.',
  );
}

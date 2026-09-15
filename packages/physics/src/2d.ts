import type { CRCPrimitiveComponent, PrimitiveInput } from '@crc/core';
import type {
  CRCPhysicsAabb2D,
  CRCPhysicsPose2D,
  CRCPhysicsRay2D,
  CRCPhysicsShape2D,
  CRCPhysicsVector2,
} from './2d-geometry.js';
import type {
  Capsule2DProps,
  Capsule2DStyle,
  Chain2DProps,
  Chain2DStyle,
  CRCPhysicsAttachment2D,
  CRCPhysicsBodyHandle2D,
  CRCPhysicsPrimitiveProps2D,
  CRCPhysicsQueryHit2D,
  CRCPhysicsQueryMatch2D,
  CRCPhysicsQueryMode,
  CRCPhysicsQueryOptions2D,
  CRCPhysicsQueryResult2D,
  CRCPhysicsWorldHandle2D,
  PhysicsShape2DProps,
  PhysicsShape2DStyle,
  Segment2DProps,
  Segment2DStyle,
} from './lib/2d/types.js';
import {
  collider2D,
  dynamicBody2D,
  kinematicBody2D,
  staticBody2D,
} from './lib/2d/runtime/descriptors.js';
import {
  PhysicsWorld2D,
  crcPhysicsWorld2D,
} from './lib/2d/runtime/world-component.js';

export * from './2d-geometry.js';
export {
  raycastShape2D,
  shapeCastAgainstShape2D,
} from './lib/2d/collision/casts.js';
export * from './lib/2d/types.js';

export { PhysicsWorld2D };

export const PhysicsShape2D: CRCPrimitiveComponent<
  PhysicsShape2DProps,
  PrimitiveInput<PhysicsShape2DProps, PhysicsShape2DStyle>
> = unavailableComponent('PhysicsShape2D');

export const Capsule2D: CRCPrimitiveComponent<
  Capsule2DProps,
  PrimitiveInput<Capsule2DProps, Capsule2DStyle>
> = unavailableComponent('Capsule2D');

export const Segment2D: CRCPrimitiveComponent<
  Segment2DProps,
  PrimitiveInput<Segment2DProps, Segment2DStyle>
> = unavailableComponent('Segment2D');

export const Chain2D: CRCPrimitiveComponent<
  Chain2DProps,
  PrimitiveInput<Chain2DProps, Chain2DStyle>
> = unavailableComponent('Chain2D');

export { collider2D, dynamicBody2D, kinematicBody2D, staticBody2D };

export function withPhysicsShape2D<P, I, ResolvedStyle>(
  component: CRCPrimitiveComponent<P, I>,
  options: Readonly<{
    resolveShape(style: Readonly<ResolvedStyle>): CRCPhysicsShape2D;
  }>,
): CRCPrimitiveComponent<
  P & CRCPhysicsPrimitiveProps2D,
  I & { readonly physics?: CRCPhysicsAttachment2D }
> {
  void component;
  void options;
  return unavailable('withPhysicsShape2D');
}

export function crcPhysicsBody2D(): CRCPhysicsBodyHandle2D {
  return unavailable('crcPhysicsBody2D');
}

export { crcPhysicsWorld2D };

export function applyForce2D(
  body: CRCPhysicsBodyHandle2D,
  force: CRCPhysicsVector2,
  options?: Readonly<{ at?: CRCPhysicsVector2; wake?: boolean }>,
): void {
  void body;
  void force;
  void options;
  unavailable('applyForce2D');
}

export function applyImpulse2D(
  body: CRCPhysicsBodyHandle2D,
  impulse: CRCPhysicsVector2,
  options?: Readonly<{ at?: CRCPhysicsVector2; wake?: boolean }>,
): void {
  void body;
  void impulse;
  void options;
  unavailable('applyImpulse2D');
}

export function applyTorque2D(
  body: CRCPhysicsBodyHandle2D,
  torque: number,
): void {
  void body;
  void torque;
  unavailable('applyTorque2D');
}

export function setLinearVelocity2D(
  body: CRCPhysicsBodyHandle2D,
  velocity: CRCPhysicsVector2,
): void {
  void body;
  void velocity;
  unavailable('setLinearVelocity2D');
}

export function setAngularVelocity2D(
  body: CRCPhysicsBodyHandle2D,
  degreesPerSecond: number,
): void {
  void body;
  void degreesPerSecond;
  unavailable('setAngularVelocity2D');
}

export function teleportBody2D(
  body: CRCPhysicsBodyHandle2D,
  pose: CRCPhysicsPose2D,
): void {
  void body;
  void pose;
  unavailable('teleportBody2D');
}

export function wakeBody2D(body: CRCPhysicsBodyHandle2D): void {
  void body;
  unavailable('wakeBody2D');
}

export function sleepBody2D(body: CRCPhysicsBodyHandle2D): void {
  void body;
  unavailable('sleepBody2D');
}

export function enableBody2D(
  body: CRCPhysicsBodyHandle2D,
  options?: Readonly<{ velocity?: 'zero' | 'preserve' }>,
): void {
  void body;
  void options;
  unavailable('enableBody2D');
}

export function disableBody2D(body: CRCPhysicsBodyHandle2D): void {
  void body;
  unavailable('disableBody2D');
}

export function raycast2D<Mode extends CRCPhysicsQueryMode = 'closest'>(
  world: CRCPhysicsWorldHandle2D,
  ray: CRCPhysicsRay2D,
  options?: CRCPhysicsQueryOptions2D<Mode>,
): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryHit2D> {
  void world;
  void ray;
  void options;
  return unavailable('raycast2D');
}

export function shapeCast2D<Mode extends CRCPhysicsQueryMode = 'closest'>(
  world: CRCPhysicsWorldHandle2D,
  shape: CRCPhysicsShape2D,
  from: CRCPhysicsPose2D,
  translation: CRCPhysicsVector2,
  options?: CRCPhysicsQueryOptions2D<Mode>,
): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryHit2D> {
  void world;
  void shape;
  void from;
  void translation;
  void options;
  return unavailable('shapeCast2D');
}

export function overlapShape2D<Mode extends CRCPhysicsQueryMode = 'closest'>(
  world: CRCPhysicsWorldHandle2D,
  shape: CRCPhysicsShape2D,
  pose: CRCPhysicsPose2D,
  options?: CRCPhysicsQueryOptions2D<Mode>,
): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryMatch2D> {
  void world;
  void shape;
  void pose;
  void options;
  return unavailable('overlapShape2D');
}

export function queryAabb2D<Mode extends CRCPhysicsQueryMode = 'closest'>(
  world: CRCPhysicsWorldHandle2D,
  bounds: CRCPhysicsAabb2D,
  options?: CRCPhysicsQueryOptions2D<Mode>,
): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryMatch2D> {
  void world;
  void bounds;
  void options;
  return unavailable('queryAabb2D');
}

export function queryPoint2D<Mode extends CRCPhysicsQueryMode = 'closest'>(
  world: CRCPhysicsWorldHandle2D,
  point: CRCPhysicsVector2,
  options?: CRCPhysicsQueryOptions2D<Mode>,
): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryMatch2D> {
  void world;
  void point;
  void options;
  return unavailable('queryPoint2D');
}

function unavailableComponent<T extends Function>(name: string): T {
  return function unavailablePhysicsComponent(): never {
    return unavailable(name);
  } as unknown as T;
}

function unavailable(name: string): never {
  throw new Error(
    `${name} is part of the @crc/physics public scaffold and is not ` +
      'implemented by this foundation task yet.',
  );
}

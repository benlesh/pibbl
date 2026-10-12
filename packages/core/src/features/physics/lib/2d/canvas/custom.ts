import type { PibblPrimitiveComponent } from '@pibbl/core';
import {
  pibblInternalRunPurePrimitiveResolver,
  derivePrimitive,
} from '@pibbl/core/internal';
import type { PibblPhysicsShape2D } from '../../../2d-geometry.js';
import type {
  PibblPhysicsAttachment2D,
  PibblPhysicsPrimitiveProps2D,
} from '../types.js';
import { requireShapeRecord2D } from '../shape-records.js';
import { installCustomShapeResolver2D } from './inference.js';

/**
 * Adds physics-attachment support to a custom primitive using its resolved-style shape callback.
 *
 * @param component - Primitive whose rendered style determines its collision shape. See
 * {@link PibblPrimitiveComponent} .
 * @param options - Pure resolver deriving collision geometry from resolved style. See
 * {@link PibblPhysicsShape2D} .
 * @returns A derived primitive accepting the public physics attachment prop. See
 * {@link PibblPrimitiveComponent} , {@link PibblPhysicsPrimitiveProps2D} ,
 * {@link PibblPhysicsAttachment2D} .
 *
 * @see {@link PibblPrimitiveComponent}
 * @see {@link PibblPhysicsShape2D}
 * @see {@link PibblPhysicsPrimitiveProps2D}
 * @see {@link PibblPhysicsAttachment2D}
 */
export function withPhysicsShape2D<P, I, ResolvedStyle>(
  component: PibblPrimitiveComponent<P, I>,
  options: Readonly<{
    resolveShape(style: Readonly<ResolvedStyle>): PibblPhysicsShape2D;
  }>,
): PibblPrimitiveComponent<
  P & PibblPhysicsPrimitiveProps2D,
  I & { readonly physics?: PibblPhysicsAttachment2D }
> {
  if (typeof options.resolveShape !== 'function') {
    throw new TypeError('withPhysicsShape2D options.resolveShape must be a function.');
  }
  const derived = derivePrimitive(component) as PibblPrimitiveComponent<
    P & PibblPhysicsPrimitiveProps2D,
    I & { readonly physics?: PibblPhysicsAttachment2D }
  >;
  installCustomShapeResolver2D(derived, style => {
    const snapshot = immutableSnapshot(style) as Readonly<ResolvedStyle>;
    const result = pibblInternalRunPurePrimitiveResolver(() =>
      options.resolveShape(snapshot)
    );
    if (isThenable(result)) {
      throw new TypeError('A physics 2D shape resolver must return synchronously, not a Promise.');
    }
    try {
      requireShapeRecord2D(result);
    } catch {
      throw new TypeError('A physics 2D shape resolver must return a Pibbl physics 2D shape.');
    }
    return result;
  });
  return derived;
}

function immutableSnapshot(value: unknown): unknown {
  if (Array.isArray(value)) return Object.freeze(value.map(immutableSnapshot));
  if (typeof value !== 'object' || value === null) return value;
  if (
    (typeof Path2D !== 'undefined' && value instanceof Path2D) ||
    (typeof CanvasGradient !== 'undefined' && value instanceof CanvasGradient) ||
    (typeof CanvasPattern !== 'undefined' && value instanceof CanvasPattern)
  ) return value;
  const copy: Record<PropertyKey, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    copy[key] = immutableSnapshot((value as Record<PropertyKey, unknown>)[key]);
  }
  return Object.freeze(copy);
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null &&
    typeof (value as { then?: unknown }).then === 'function';
}

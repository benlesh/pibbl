import type { CRCPrimitiveComponent } from '@crc/core';
import {
  crcInternalRunPurePrimitiveResolver,
  derivePrimitive,
} from '@crc/core/internal';
import type { CRCPhysicsShape2D } from '../../../2d-geometry.js';
import type {
  CRCPhysicsAttachment2D,
  CRCPhysicsPrimitiveProps2D,
} from '../types.js';
import { requireShapeRecord2D } from '../shape-records.js';
import { installCustomShapeResolver2D } from './inference.js';

/**
 * Adds physics-attachment support to a custom primitive using its resolved-style shape callback.
 *
 * @param component - Primitive whose rendered style determines its collision shape. See
 * {@link CRCPrimitiveComponent} .
 * @param options - Pure resolver deriving collision geometry from resolved style. See
 * {@link CRCPhysicsShape2D} .
 * @returns A derived primitive accepting the public physics attachment prop. See
 * {@link CRCPrimitiveComponent} , {@link CRCPhysicsPrimitiveProps2D} ,
 * {@link CRCPhysicsAttachment2D} .
 *
 * @see {@link CRCPrimitiveComponent}
 * @see {@link CRCPhysicsShape2D}
 * @see {@link CRCPhysicsPrimitiveProps2D}
 * @see {@link CRCPhysicsAttachment2D}
 */
export function withPhysicsShape2D<P, I, ResolvedStyle>(
  component: CRCPrimitiveComponent<P, I>,
  options: Readonly<{
    resolveShape(style: Readonly<ResolvedStyle>): CRCPhysicsShape2D;
  }>,
): CRCPrimitiveComponent<
  P & CRCPhysicsPrimitiveProps2D,
  I & { readonly physics?: CRCPhysicsAttachment2D }
> {
  if (typeof options.resolveShape !== 'function') {
    throw new TypeError('withPhysicsShape2D options.resolveShape must be a function.');
  }
  const derived = derivePrimitive(component) as CRCPrimitiveComponent<
    P & CRCPhysicsPrimitiveProps2D,
    I & { readonly physics?: CRCPhysicsAttachment2D }
  >;
  installCustomShapeResolver2D(derived, style => {
    const snapshot = immutableSnapshot(style) as Readonly<ResolvedStyle>;
    const result = crcInternalRunPurePrimitiveResolver(() =>
      options.resolveShape(snapshot)
    );
    if (isThenable(result)) {
      throw new TypeError('A physics 2D shape resolver must return synchronously, not a Promise.');
    }
    try {
      requireShapeRecord2D(result);
    } catch {
      throw new TypeError('A physics 2D shape resolver must return a CRC physics 2D shape.');
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

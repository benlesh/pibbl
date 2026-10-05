import type { CRCManipulationGeometry } from './controller-types.js';
/**
 * Convert a finite degree angle to radians.
 *
 * @param value - Angle in degrees.
 * @returns The equivalent angle in radians.
 *
 * @see {@link CRCManipulationGeometry}
 */
export function degrees(value: number): number {
  if (!Number.isFinite(value))
    throw new Error("degrees requires a finite angle.");
  return value * (Math.PI / 180);
}

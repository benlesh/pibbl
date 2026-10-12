import { finiteNumber, nonnegativeNumber } from './validation.js';

/**
 * Geometry and construction options for a circle path.
 *
 * @see {@link createCirclePath}
 */
export interface CirclePathOptions {
  /** Horizontal coordinate of the center. See {@link CirclePathOptions}. */
  cx?: number;
  /** Vertical coordinate of the center. See {@link CirclePathOptions}. */
  cy?: number;
  /** Radius in the coordinate system of this geometry or effect. See {@link CirclePathOptions}. */
  radius: number;
}

/**
 * Creates a Canvas Path2D for circle geometry from validated options.
 *
 * @param options - Circle center and radius. See {@link CirclePathOptions}.
 * @returns A native Canvas path containing the circle.
 *
 * @see {@link CirclePathOptions}
 */
export function createCirclePath(options: Readonly<CirclePathOptions>): Path2D {
  const cx = finiteNumber(options.cx ?? 0, 'cx');
  const cy = finiteNumber(options.cy ?? 0, 'cy');
  const radius = nonnegativeNumber(options.radius, 'radius');
  const path = new Path2D();
  if (radius > 0) path.arc(cx, cy, radius, 0, Math.PI * 2);
  return path;
}

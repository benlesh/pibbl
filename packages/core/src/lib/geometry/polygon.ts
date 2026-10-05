import { createRoundedClosedPolygonPath, resolveNumericCornerRadii } from './rounded-corners.js';
import type { RoundedCornerPathOptions } from './rounded-corners.js';
import { validateCoordinates } from './validation.js';

/**
 * Geometry and construction options for a polygon path.
 *
 * @see {@link RoundedCornerPathOptions}
 * @see {@link createPolygonPath}
 */
export interface PolygonPathOptions extends RoundedCornerPathOptions {
  /** Ordered coordinate pairs describing the path vertices. See {@link PolygonPathOptions}. */
  coords: readonly (readonly [number, number])[];
}

/**
 * Creates a Canvas Path2D for polygon geometry from validated options.
 *
 * @param options - Ordered polygon vertices and corner rounding settings. See
 * {@link PolygonPathOptions} .
 * @returns A native Canvas path containing the polygon.
 *
 * @see {@link PolygonPathOptions}
 */
export function createPolygonPath(
  options: Readonly<PolygonPathOptions>,
): Path2D {
  const coords = validateCoordinates(options.coords);
  const radii = resolveNumericCornerRadii(coords.length, options);
  if (coords.length < 3) return new Path2D();
  return createRoundedClosedPolygonPath(coords, radii);
}

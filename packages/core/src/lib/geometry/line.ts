import { validateCoordinates } from './validation.js';

/**
 * Geometry and construction options for a line path.
 *
 * @see {@link createLinePath}
 */
export interface LinePathOptions {
  /** Ordered coordinate pairs describing the path vertices. See {@link LinePathOptions}. */
  coords: readonly (readonly [number, number])[];
  /** Whether to connect the final vertex back to the first. See {@link LinePathOptions}. */
  closePath?: boolean;
}

/**
 * Creates a Canvas Path2D for line geometry from validated options.
 *
 * @param options - Ordered vertices and whether to close the path. See {@link LinePathOptions}.
 * @returns A native Canvas path containing the line.
 *
 * @see {@link LinePathOptions}
 */
export function createLinePath(options: Readonly<LinePathOptions>): Path2D {
  const coords = validateCoordinates(options.coords);
  const path = new Path2D();
  coords.forEach(([x, y], index) => {
    if (index === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  });
  if (options.closePath) path.closePath();
  return path;
}

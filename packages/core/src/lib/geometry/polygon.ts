import { createRoundedClosedPolygonPath, resolveNumericCornerRadii } from './rounded-corners.js';
import type { RoundedCornerPathOptions } from './rounded-corners.js';
import { validateCoordinates } from './validation.js';

export interface PolygonPathOptions extends RoundedCornerPathOptions {
  coords: readonly (readonly [number, number])[];
}

export function createPolygonPath(
  options: Readonly<PolygonPathOptions>,
): Path2D {
  const coords = validateCoordinates(options.coords);
  const radii = resolveNumericCornerRadii(coords.length, options);
  if (coords.length < 3) return new Path2D();
  return createRoundedClosedPolygonPath(coords, radii);
}

import {
  resolveNumericCornerRadii,
  type RoundedCornerPathOptions,
} from './rounded-corners.js';
import { finiteNumber } from './validation.js';

/**
 * Geometry and construction options for a rectangle path.
 *
 * @see {@link RoundedCornerPathOptions}
 * @see {@link createRectanglePath}
 */
export interface RectanglePathOptions extends RoundedCornerPathOptions {
  /**
   * Horizontal coordinate or displacement in the containing coordinate system. See
   * {@link RectanglePathOptions}.
   */
  x?: number;
  /**
   * Vertical coordinate or displacement in the containing coordinate system. See
   * {@link RectanglePathOptions}.
   */
  y?: number;
  /**
   * Horizontal extent in the units of the containing geometry or surface. See
   * {@link RectanglePathOptions}.
   */
  width: number;
  /**
   * Vertical extent in the units of the containing geometry or surface. See
   * {@link RectanglePathOptions}.
   */
  height: number;
}

/**
 * Creates a Canvas Path2D for rectangle geometry from validated options.
 *
 * @param options - Rectangle bounds and corner options. See {@link RectanglePathOptions}.
 * @returns A native Canvas path containing the rectangle.
 *
 * @see {@link RectanglePathOptions}
 */
export function createRectanglePath(
  options: Readonly<RectanglePathOptions>,
): Path2D {
  const x = finiteNumber(options.x ?? 0, 'x');
  const y = finiteNumber(options.y ?? 0, 'y');
  const width = finiteNumber(options.width, 'width');
  const height = finiteNumber(options.height, 'height');
  const radii = resolveNumericCornerRadii(4, options);
  const path = new Path2D();

  if (radii.every(radius => radius === 0)) {
    path.rect(x, y, width, height);
  } else {
    path.roundRect(x, y, width, height, [...radii]);
  }

  return path;
}

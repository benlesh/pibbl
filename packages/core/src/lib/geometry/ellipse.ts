import { finiteNumber, nonnegativeNumber } from './validation.js';

/**
 * Geometry and construction options for a ellipse path.
 *
 * @see {@link createEllipsePath}
 */
export interface EllipsePathOptions {
  /** Horizontal coordinate of the center. See {@link EllipsePathOptions}. */
  cx?: number;
  /** Vertical coordinate of the center. See {@link EllipsePathOptions}. */
  cy?: number;
  /** Horizontal ellipse radius. See {@link EllipsePathOptions}. */
  radiusX: number;
  /** Vertical ellipse radius. See {@link EllipsePathOptions}. */
  radiusY: number;
  /** Rotation applied to the containing geometry. See {@link EllipsePathOptions}. */
  rotation?: number;
}

/**
 * Creates a Canvas Path2D for ellipse geometry from validated options.
 *
 * @param options - Ellipse center, radii, and rotation. See {@link EllipsePathOptions}.
 * @returns A native Canvas path containing the ellipse.
 *
 * @see {@link EllipsePathOptions}
 */
export function createEllipsePath(options: Readonly<EllipsePathOptions>): Path2D {
  const cx = finiteNumber(options.cx ?? 0, 'cx');
  const cy = finiteNumber(options.cy ?? 0, 'cy');
  const radiusX = nonnegativeNumber(options.radiusX, 'radiusX');
  const radiusY = nonnegativeNumber(options.radiusY, 'radiusY');
  const rotation = finiteNumber(options.rotation ?? 0, 'rotation');
  const path = new Path2D();
  if (radiusX > 0 && radiusY > 0) {
    path.ellipse(cx, cy, radiusX, radiusY, rotation, 0, Math.PI * 2);
  }
  return path;
}

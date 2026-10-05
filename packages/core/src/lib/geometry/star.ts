import type { LayoutBox } from '../layout/types.js';
import { createPolygonPath } from './polygon.js';
import {
  resolveNumericCornerRadii,
  type RoundedCornerPathOptions,
} from './rounded-corners.js';
import {
  finiteNumber,
  integerAtLeast,
  nonnegativeNumber,
  pathRangeError,
  type GeometryErrorFactory,
} from './validation.js';

/**
 * Geometry and construction options for a star path.
 *
 * @see {@link RoundedCornerPathOptions}
 * @see {@link createStarPath}
 */
export interface StarPathOptions extends RoundedCornerPathOptions {
  /** Points defining the geometry or reported by the contact query. See {@link StarPathOptions}. */
  points: number;
  /** Horizontal coordinate of the center. See {@link StarPathOptions}. */
  cx?: number;
  /** Vertical coordinate of the center. See {@link StarPathOptions}. */
  cy?: number;
  /** Radius of the outer boundary. See {@link StarPathOptions}. */
  outerRadius: number;
  /** Radius of the inner boundary. See {@link StarPathOptions}. */
  innerRadius: number;
  /** Rotation applied to the containing geometry. See {@link StarPathOptions}. */
  rotation?: number;
}

export interface ResolvedStarGeometry {
  path: Path2D;
  vertices: readonly (readonly [number, number])[];
  bounds?: LayoutBox;
}

export function resolveStarGeometry(
  options: Readonly<StarPathOptions>,
  errorFactory: GeometryErrorFactory = pathRangeError,
): ResolvedStarGeometry {
  const points = integerAtLeast(options.points, 3, 'points', errorFactory);
  const outerRadius = nonnegativeNumber(
    options.outerRadius,
    'outerRadius',
    errorFactory,
  );
  const innerRadius = nonnegativeNumber(
    options.innerRadius,
    'innerRadius',
    errorFactory,
  );
  if (innerRadius > outerRadius) {
    throw errorFactory(
      'innerRadius',
      innerRadius,
      `must not exceed outerRadius ${outerRadius}`,
    );
  }
  const cx = finiteNumber(options.cx ?? 0, 'cx', errorFactory);
  const cy = finiteNumber(options.cy ?? 0, 'cy', errorFactory);
  const rotation = finiteNumber(
    options.rotation ?? -Math.PI / 2,
    'rotation',
    errorFactory,
  );
  const cornerCount = points * 2;
  const radii = resolveNumericCornerRadii(
    cornerCount,
    options,
    errorFactory,
  );

  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  const vertices = Array.from({ length: cornerCount }, (_, index) => {
    const angle = rotation + (index * Math.PI) / points;
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const vertex = [
      cx + radius * Math.cos(angle),
      cy + radius * Math.sin(angle),
    ] as const;
    left = Math.min(left, vertex[0]);
    right = Math.max(right, vertex[0]);
    top = Math.min(top, vertex[1]);
    bottom = Math.max(bottom, vertex[1]);
    return vertex;
  });

  if (outerRadius === 0 || innerRadius === 0) {
    return {
      path: new Path2D(),
      vertices,
      bounds: {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
      },
    };
  }

  return {
    path: createPolygonPath({ coords: vertices, cornerRadii: radii }),
    vertices,
    bounds: {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    },
  };
}

/**
 * Creates a Canvas Path2D for star geometry from validated options.
 *
 * @param options - Star center, inner and outer radii, point count, and rotation. See
 * {@link StarPathOptions} .
 * @returns A native Canvas path containing the star.
 *
 * @see {@link StarPathOptions}
 */
export function createStarPath(
  options: Readonly<StarPathOptions>,
): Path2D {
  return resolveStarGeometry(options).path;
}

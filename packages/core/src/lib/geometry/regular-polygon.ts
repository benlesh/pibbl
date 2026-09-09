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

export interface RegularPolygonPathPosition {
  sides: number;
  cx?: number;
  cy?: number;
  rotation?: number;
}

export type RegularPolygonNumericSize =
  | { circumradius: number; inradius?: never; sideLength?: never }
  | { circumradius?: never; inradius: number; sideLength?: never }
  | { circumradius?: never; inradius?: never; sideLength: number };

export type RegularPolygonPathOptions = RegularPolygonPathPosition &
  RegularPolygonNumericSize &
  RoundedCornerPathOptions;

export interface ResolvedRegularPolygonGeometry {
  path: Path2D;
  vertices: readonly (readonly [number, number])[];
  bounds?: LayoutBox;
}

const SIZE_KEYS = ['circumradius', 'inradius', 'sideLength'] as const;

export function resolveRegularPolygonGeometry(
  options: Readonly<RegularPolygonPathOptions>,
  errorFactory: GeometryErrorFactory = pathRangeError,
): ResolvedRegularPolygonGeometry {
  const sides = integerAtLeast(options.sides, 3, 'sides', errorFactory);
  const sizeKeys = SIZE_KEYS.filter(key => options[key] !== undefined);
  if (sizeKeys.length !== 1) {
    throw errorFactory(
      'circumradius|inradius|sideLength',
      options,
      'must provide exactly one size option',
    );
  }

  const sizeKind = sizeKeys[0];
  const size = nonnegativeNumber(options[sizeKind], sizeKind, errorFactory);
  const cx = finiteNumber(options.cx ?? 0, 'cx', errorFactory);
  const cy = finiteNumber(options.cy ?? 0, 'cy', errorFactory);
  const rotation = finiteNumber(
    options.rotation ?? -Math.PI / 2,
    'rotation',
    errorFactory,
  );
  const radii = resolveNumericCornerRadii(sides, options, errorFactory);
  const circumradius = sizeKind === 'circumradius' ? size :
    sizeKind === 'inradius' ? size / Math.cos(Math.PI / sides) :
      size / (2 * Math.sin(Math.PI / sides));

  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  const vertices = Array.from({ length: sides }, (_, index) => {
    const angle = rotation + (index * Math.PI * 2) / sides;
    const vertex = [
      cx + circumradius * Math.cos(angle),
      cy + circumradius * Math.sin(angle),
    ] as const;
    left = Math.min(left, vertex[0]);
    right = Math.max(right, vertex[0]);
    top = Math.min(top, vertex[1]);
    bottom = Math.max(bottom, vertex[1]);
    return vertex;
  });

  return {
    path: circumradius === 0 ? new Path2D() :
      createPolygonPath({ coords: vertices, cornerRadii: radii }),
    vertices,
    bounds: {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    },
  };
}

export function createRegularPolygonPath(
  options: Readonly<RegularPolygonPathOptions>,
): Path2D {
  return resolveRegularPolygonGeometry(options).path;
}

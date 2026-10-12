import type { PolygonPathOptions } from './polygon.js';
import type { RectanglePathOptions } from './rectangle.js';
import type { StarPathOptions } from './star.js';
import type { RegularPolygonPathOptions } from './regular-polygon.js';
import { createLinePath } from './line.js';
import {
  nonnegativeNumber,
  pathRangeError,
  type GeometryErrorFactory,
} from './validation.js';

/**
 * Uniform or per-corner radii for rounding supported path vertices.
 *
 * @see {@link PolygonPathOptions}
 * @see {@link RectanglePathOptions}
 * @see {@link StarPathOptions}
 * @see {@link RegularPolygonPathOptions}
 */
export interface RoundedCornerPathOptions {
  /**
   * Uniform corner radius used where no per-corner override is supplied. See
   * {@link RoundedCornerPathOptions}.
   */
  cornerRadius?: number;
  /**
   * Per-corner radii; nullish entries use the uniform corner radius. See
   * {@link RoundedCornerPathOptions}.
   */
  cornerRadii?: readonly (number | null | undefined)[];
}

export type ResolvedCornerRadii = readonly number[];

export function resolveNumericCornerRadii(
  cornerCount: number,
  options: Readonly<RoundedCornerPathOptions>,
  errorFactory: GeometryErrorFactory = pathRangeError,
): ResolvedCornerRadii {
  if (options.cornerRadii && options.cornerRadii.length > cornerCount) {
    throw errorFactory(
      'cornerRadii',
      options.cornerRadii.length,
      `length must not exceed corner count ${cornerCount}`,
    );
  }

  const cornerRadius = options.cornerRadius === undefined ? 0 :
    nonnegativeNumber(options.cornerRadius, 'cornerRadius', errorFactory);
  const cornerRadii = options.cornerRadii;

  if (cornerRadii) {
    for (let index = 0; index < cornerRadii.length; index++) {
      const radius = cornerRadii[index];
      if (radius !== null && radius !== undefined) {
        nonnegativeNumber(radius, `cornerRadii[${index}]`, errorFactory);
      }
    }
  }

  return Array.from(
    { length: cornerCount },
    (_, index) => cornerRadii?.[index] ?? cornerRadius,
  );
}

interface RoundedCorner {
  x: number;
  y: number;
  towardPreviousX: number;
  towardPreviousY: number;
  towardNextX: number;
  towardNextY: number;
  radius: number;
  demand: number;
  rounded: boolean;
}

export function createRoundedClosedPolygonPath(
  coords: readonly (readonly [number, number])[],
  radii: ResolvedCornerRadii,
): Path2D {
  if (coords.length < 3) return new Path2D();
  if (radii.every(radius => radius === 0)) {
    return createLinePath({ coords, closePath: true });
  }

  const corners = coords.map(([x, y], index): RoundedCorner => {
    const [previousX, previousY] = coords[
      (index - 1 + coords.length) % coords.length
    ];
    const [nextX, nextY] = coords[(index + 1) % coords.length];
    const previousDx = previousX - x;
    const previousDy = previousY - y;
    const nextDx = nextX - x;
    const nextDy = nextY - y;
    const previousLength = Math.hypot(previousDx, previousDy);
    const nextLength = Math.hypot(nextDx, nextDy);
    const radius = radii[index];
    const hasUnitRays = previousLength !== 0 && nextLength !== 0;
    const towardPreviousX = hasUnitRays ? previousDx / previousLength : 0;
    const towardPreviousY = hasUnitRays ? previousDy / previousLength : 0;
    const towardNextX = hasUnitRays ? nextDx / nextLength : 0;
    const towardNextY = hasUnitRays ? nextDy / nextLength : 0;
    const exactlyCollinear = hasUnitRays &&
      towardPreviousX * towardNextY === towardPreviousY * towardNextX;

    if (
      radius === 0 ||
      !hasUnitRays ||
      exactlyCollinear
    ) {
      return {
        x,
        y,
        towardPreviousX: 0,
        towardPreviousY: 0,
        towardNextX: 0,
        towardNextY: 0,
        radius,
        demand: 0,
        rounded: false,
      };
    }

    const dot = Math.max(-1, Math.min(1,
      towardPreviousX * towardNextX + towardPreviousY * towardNextY,
    ));
    const theta = Math.acos(dot);

    return {
      x,
      y,
      towardPreviousX,
      towardPreviousY,
      towardNextX,
      towardNextY,
      radius,
      demand: radius / Math.tan(theta / 2),
      rounded: true,
    };
  });

  const edgeLengths = coords.map(([x, y], index) => {
    const [nextX, nextY] = coords[(index + 1) % coords.length];
    return Math.hypot(nextX - x, nextY - y);
  });
  const scale = edgeLengths.reduce((current, edgeLength, index) => {
    const next = (index + 1) % corners.length;
    const totalDemand = corners[index].demand + corners[next].demand;
    return totalDemand > 0 ?
      Math.min(current, edgeLength / totalDemand) :
      current;
  }, 1);
  const scaledDemand = (corner: RoundedCorner) =>
    scale === 0 ? 0 : corner.demand * scale;
  const first = corners[0];
  const firstDemand = scaledDemand(first);
  const path = new Path2D();
  path.moveTo(
    first.x + first.towardPreviousX * firstDemand,
    first.y + first.towardPreviousY * firstDemand,
  );

  for (const corner of corners) {
    if (!corner.rounded) {
      path.lineTo(corner.x, corner.y);
      continue;
    }
    const demand = scaledDemand(corner);
    path.arcTo(
      corner.x,
      corner.y,
      corner.x + corner.towardNextX * demand,
      corner.y + corner.towardNextY * demand,
      corner.radius * scale,
    );
  }
  path.closePath();
  return path;
}

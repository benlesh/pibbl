import { finiteNumber, nonnegativeNumber } from "./validation.js";

const fullTurn = Math.PI * 2;

export interface CircularSweep {
  readonly startAngle: number;
  readonly endAngle: number;
  readonly sweep: number;
  readonly counterclockwise: boolean;
  readonly fullCircle: boolean;
}

/**
 * Geometry and construction options for a arc path.
 *
 * @see {@link createArcPath}
 * @see {@link WedgePathOptions}
 */
export interface ArcPathOptions {
  /** Horizontal coordinate of the center. See {@link ArcPathOptions}. */
  cx?: number;
  /** Vertical coordinate of the center. See {@link ArcPathOptions}. */
  cy?: number;
  /** Radius in the coordinate system of this geometry or effect. See {@link ArcPathOptions}. */
  radius: number;
  /** Angle at which the arc or slice begins. See {@link ArcPathOptions}. */
  startAngle: number;
  /** Angle at which the arc or slice ends. See {@link ArcPathOptions}. */
  endAngle: number;
  /** Whether the arc follows the counterclockwise direction. See {@link ArcPathOptions}. */
  counterclockwise?: boolean;
}

/**
 * Geometry and construction options for a wedge path.
 *
 * @see {@link ArcPathOptions}
 * @see {@link createWedgePath}
 */
export type WedgePathOptions = ArcPathOptions;

export function resolveCircularSweep(
  startAngle: number,
  endAngle: number,
  counterclockwise: boolean,
): CircularSweep {
  const fullCircle = counterclockwise
    ? startAngle - endAngle >= fullTurn
    : endAngle - startAngle >= fullTurn;
  let sweep: number;
  if (fullCircle) {
    sweep = counterclockwise ? -fullTurn : fullTurn;
  } else if (counterclockwise) {
    const distance = positiveModulo(startAngle - endAngle, fullTurn);
    sweep = distance === 0 ? 0 : -distance;
  } else {
    sweep = positiveModulo(endAngle - startAngle, fullTurn);
  }

  return {
    startAngle,
    endAngle: startAngle + sweep,
    sweep,
    counterclockwise,
    fullCircle,
  };
}

/**
 * Creates a Canvas Path2D for arc geometry from validated options.
 *
 * @param options - Circle center, radius, angles, and sweep direction. See {@link ArcPathOptions}.
 * @returns A native Canvas path containing the arc.
 *
 * @see {@link ArcPathOptions}
 */
export function createArcPath(options: Readonly<ArcPathOptions>): Path2D {
  const normalized = validateArcOptions(options);
  const sweep = resolveCircularSweep(
    normalized.startAngle,
    normalized.endAngle,
    normalized.counterclockwise,
  );
  return buildArcPath(normalized.cx, normalized.cy, normalized.radius, sweep);
}

/**
 * Creates a Canvas Path2D for wedge geometry from validated options.
 *
 * @param options - Circle center, radius, angles, and sweep direction. See
 * {@link WedgePathOptions} .
 * @returns A native Canvas path containing the closed wedge.
 *
 * @see {@link WedgePathOptions}
 */
export function createWedgePath(options: Readonly<WedgePathOptions>): Path2D {
  const normalized = validateArcOptions(options);
  const sweep = resolveCircularSweep(
    normalized.startAngle,
    normalized.endAngle,
    normalized.counterclockwise,
  );
  return buildWedgePath(normalized.cx, normalized.cy, normalized.radius, sweep);
}

function buildArcPath(
  cx: number,
  cy: number,
  radius: number,
  sweep: Readonly<CircularSweep>,
): Path2D {
  const path = new Path2D();
  if (radius > 0 && sweep.sweep !== 0) {
    path.arc(
      cx,
      cy,
      radius,
      sweep.startAngle,
      sweep.endAngle,
      sweep.counterclockwise,
    );
  }
  return path;
}

function buildWedgePath(
  cx: number,
  cy: number,
  radius: number,
  sweep: Readonly<CircularSweep>,
): Path2D {
  const path = new Path2D();
  if (radius <= 0 || sweep.sweep === 0) return path;

  if (!sweep.fullCircle) {
    path.moveTo(cx, cy);
    path.lineTo(
      cx + radius * Math.cos(sweep.startAngle),
      cy + radius * Math.sin(sweep.startAngle),
    );
  }
  path.arc(
    cx,
    cy,
    radius,
    sweep.startAngle,
    sweep.endAngle,
    sweep.counterclockwise,
  );
  path.closePath();
  return path;
}

function validateArcOptions(options: Readonly<ArcPathOptions>): {
  cx: number;
  cy: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  counterclockwise: boolean;
} {
  return {
    cx: finiteNumber(options.cx ?? 0, "cx"),
    cy: finiteNumber(options.cy ?? 0, "cy"),
    radius: nonnegativeNumber(options.radius, "radius"),
    startAngle: finiteNumber(options.startAngle, "startAngle"),
    endAngle: finiteNumber(options.endAngle, "endAngle"),
    counterclockwise: options.counterclockwise ?? false,
  };
}

function positiveModulo(value: number, divisor: number): number {
  const result = value % divisor;
  if (result === 0) return 0;
  return result < 0 ? result + divisor : result;
}

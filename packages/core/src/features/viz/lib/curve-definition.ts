import type { LineSeriesProps } from "./types.js";
/** A mapped Cartesian coordinate used by private series curve rendering. */
export type SeriesCurvePoint = readonly [number, number];

/**
 * A private generated segment. Cubic controls reserve the representation needed by a later
 * smooth-curve implementation; current step definitions generate straight segments only.
 */
export interface SeriesCurveSegment {
  /** Endpoint of this segment. */
  readonly end: SeriesCurvePoint;
  /** First cubic Bézier control point when the segment is cubic. */
  readonly control1?: SeriesCurvePoint;
  /** Second cubic Bézier control point when the segment is cubic. */
  readonly control2?: SeriesCurvePoint;
}

/** A private immutable path beginning at one point and continuing through generated segments. */
export interface SeriesCurveGeometry {
  /** Initial coordinate for the geometry. */
  readonly start: SeriesCurvePoint;
  /** Ordered segments after {@link SeriesCurveGeometry.start}. */
  readonly segments: readonly SeriesCurveSegment[];
}

declare const seriesCurveBrand: unique symbol;

/**
 * An opaque immutable definition controlling how a series connects adjacent observations.
 *
 * Obtain a definition from one of the named curve factories. Definitions intentionally expose
 * no algorithm selector or custom callback surface.
 *
 * @see {@link LineSeriesProps}
 */
export interface SeriesCurve {
  /** Nominal marker that prevents callers from forging a recognized definition. */
  readonly [seriesCurveBrand]: true;
}

type SeriesCurveBuilder = (
  points: readonly SeriesCurvePoint[],
) => readonly SeriesCurveSegment[];

const builders = new WeakMap<SeriesCurve, SeriesCurveBuilder>();

/** @internal Creates one module-recognized immutable curve definition. */
export function createSeriesCurve(builder: SeriesCurveBuilder): SeriesCurve {
  const definition = Object.freeze({}) as unknown as SeriesCurve;
  builders.set(definition, builder);
  return definition;
}

/** @internal Rejects values that were not created by a named curve factory. */
export function resolveSeriesCurve(value: unknown): SeriesCurve | undefined {
  if (value === undefined || value === "linear") return undefined;
  if (
    typeof value !== "object" ||
    value === null ||
    !builders.has(value as SeriesCurve)
  )
    throw new TypeError(
      'Series curve must be "linear" or a definition from a named factory.',
    );
  return value as SeriesCurve;
}

/** @internal Builds the curve geometry for one already-valid contiguous run. */
export function curveGeometry(
  curve: SeriesCurve | undefined,
  points: readonly SeriesCurvePoint[],
): SeriesCurveGeometry {
  const start = points[0];
  return Object.freeze({
    start,
    segments: Object.freeze(
      curve
        ? [...builders.get(curve)!(points)]
        : points.slice(1).map((end) => Object.freeze({ end })),
    ),
  });
}

/** @internal Appends one generated geometry in its authored forward direction. */
export function appendCurveForward(
  path: Path2D,
  geometry: SeriesCurveGeometry,
): void {
  for (const segment of geometry.segments) {
    if (segment.control1 && segment.control2)
      path.bezierCurveTo(
        segment.control1[0],
        segment.control1[1],
        segment.control2[0],
        segment.control2[1],
        segment.end[0],
        segment.end[1],
      );
    else path.lineTo(segment.end[0], segment.end[1]);
  }
}

/** @internal Appends one generated geometry in reverse without rebuilding its curve strategy. */
export function appendCurveReverse(
  path: Path2D,
  geometry: SeriesCurveGeometry,
): void {
  const ends = geometry.segments.map((segment) => segment.end);
  path.lineTo(
    (ends.at(-1) ?? geometry.start)[0],
    (ends.at(-1) ?? geometry.start)[1],
  );
  for (let i = geometry.segments.length - 1; i >= 0; i--) {
    const segment = geometry.segments[i];
    const start = i === 0 ? geometry.start : geometry.segments[i - 1].end;
    if (segment.control1 && segment.control2)
      path.bezierCurveTo(
        segment.control2[0],
        segment.control2[1],
        segment.control1[0],
        segment.control1[1],
        start[0],
        start[1],
      );
    else path.lineTo(start[0], start[1]);
  }
}

function cubicValue(
  values: readonly [number, number, number, number],
  t: number,
): number {
  const [p0, p1, p2, p3] = values;
  const inverse = 1 - t;
  return (
    inverse ** 3 * p0 +
    3 * inverse ** 2 * t * p1 +
    3 * inverse * t ** 2 * p2 +
    t ** 3 * p3
  );
}

function derivativeRoots(
  values: readonly [number, number, number, number],
): readonly number[] {
  const [p0, p1, p2, p3] = values;
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 3 * p0 - 6 * p1 + 3 * p2;
  const c = -3 * p0 + 3 * p1;
  if (a === 0) {
    if (b === 0) return [];
    return [-c / (2 * b)];
  }
  const discriminant = 4 * b * b - 12 * a * c;
  if (discriminant < 0) return [];
  const root = Math.sqrt(discriminant);
  const q = -b - (b >= 0 ? root / 2 : -root / 2);
  return q === 0 ? [-b / (3 * a)] : [q / (3 * a), c / q];
}

function cubicY(
  start: SeriesCurvePoint,
  segment: SeriesCurveSegment,
): readonly [number, number, number, number] {
  const end = segment.end;
  const control1 = segment.control1 ?? [
    start[0] + (end[0] - start[0]) / 3,
    start[1] + (end[1] - start[1]) / 3,
  ];
  const control2 = segment.control2 ?? [
    start[0] + ((end[0] - start[0]) * 2) / 3,
    start[1] + ((end[1] - start[1]) * 2) / 3,
  ];
  return [start[1], control1[1], control2[1], end[1]];
}

/** @internal Rejects interval-band cubics whose paired boundaries cross between observations. */
export function validatePairedCurveGeometry(
  upper: SeriesCurveGeometry,
  lower: SeriesCurveGeometry,
): void {
  if (upper.segments.length !== lower.segments.length)
    throw new RangeError(
      "IntervalBandSeries curve boundaries have incompatible geometry.",
    );
  let upperStart = upper.start;
  let lowerStart = lower.start;
  let orientation = 0;
  for (let i = 0; i < upper.segments.length && orientation === 0; i++) {
    for (const value of [
      upperStart[1] - lowerStart[1],
      upper.segments[i].end[1] - lower.segments[i].end[1],
    ]) {
      if (value !== 0) {
        orientation = Math.sign(value);
        break;
      }
    }
    upperStart = upper.segments[i].end;
    lowerStart = lower.segments[i].end;
  }
  upperStart = upper.start;
  lowerStart = lower.start;
  for (let i = 0; i < upper.segments.length; i++) {
    const upperSegment = upper.segments[i],
      lowerSegment = lower.segments[i];
    const upperY = cubicY(upperStart, upperSegment);
    const lowerY = cubicY(lowerStart, lowerSegment);
    const difference = upperY.map((value, index) => value - lowerY[index]) as [
      number,
      number,
      number,
      number,
    ];
    if (!difference.every(Number.isFinite))
      throw new RangeError(
        "IntervalBandSeries curve boundaries must be finite.",
      );
    const magnitude = Math.max(...difference.map(Math.abs));
    const normalized = difference.map((value) =>
      magnitude === 0 ? 0 : value / magnitude,
    ) as [number, number, number, number];
    const candidates = [0, 1, ...derivativeRoots(normalized)].filter(
      (value) => value >= 0 && value <= 1,
    );
    for (const t of candidates) {
      const value = cubicValue(normalized, t);
      if (
        !Number.isFinite(value) ||
        // Relative tolerance accounts only for floating-point evaluation at tangencies.
        (orientation !== 0 && value * orientation < -64 * Number.EPSILON)
      )
        throw new RangeError("IntervalBandSeries curve boundaries cross.");
    }
    upperStart = upperSegment.end;
    lowerStart = lowerSegment.end;
  }
}

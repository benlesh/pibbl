import { Path, resolveSignalValue } from "@pibbl/core";
import type {
  FillStyle,
  PibblEventHandlers,
  PibblEventParticipationOptions,
  SignalValue,
} from "@pibbl/core";
import {
  useInternalValueMemoSlot,
  validateTexturePaint,
} from "@pibbl/core/internal";
import type { SignalStyle } from "@pibbl/core/internal";
import type { AreaSeriesStyle } from "./area-series.js";
import { opacity } from "./paint.js";
import type { LineAccessor, LineCoordinate, LineSeriesProps } from "./types.js";
import {
  appendCurveForward,
  appendCurveReverse,
  curveGeometry,
  resolveSeriesCurve,
  validatePairedCurveGeometry,
} from "./curve-definition.js";
import { useContinuousScale } from "./use-continuous-scale.js";

/**
 * Authored inputs for {@link IntervalBandSeries}.
 *
 * The data, horizontal coordinate, scales, and defined predicate use the same contract as
 * {@link LineSeriesProps}. Each contiguous run of at least two observations draws its upper
 * boundary forward and lower boundary backward.
 *
 * @see {@link AreaSeriesStyle}
 * @see {@link LineSeriesProps}
 */
export interface IntervalBandSeriesProps<D>
  extends PibblEventHandlers, PibblEventParticipationOptions {
  /** Application data supplied directly or through a signal. */
  readonly data: LineSeriesProps<D>["data"];
  /** Property key or callback extracting the horizontal coordinate. */
  readonly x: LineAccessor<D>;
  /** Property key or callback extracting the lower bound. */
  readonly lower: LineAccessor<D>;
  /** Property key or callback extracting the upper bound. */
  readonly upper: LineAccessor<D>;
  /** Continuous scale used to map horizontal data coordinates. */
  readonly xScale: LineSeriesProps<D>["xScale"];
  /** Continuous scale used to map both data bounds. */
  readonly yScale: LineSeriesProps<D>["yScale"];
  /** Selects records that participate in a matching-bounds run. */
  readonly defined?: LineSeriesProps<D>["defined"];
  /** Curve used to connect successive matching bounds. */
  readonly curve?: LineSeriesProps<D>["curve"];
  /** Shared band presentation. Individual datum styling is not supported. */
  readonly style?: SignalValue<SignalStyle<AreaSeriesStyle>>;
}

function accessor<D>(
  input: LineAccessor<D>,
): (datum: D, index: number, data: readonly D[]) => LineCoordinate {
  return typeof input === "function"
    ? input
    : (datum) => datum[input] as LineCoordinate;
}

function fill(value: unknown): FillStyle {
  if (
    typeof value === "string" ||
    value instanceof CanvasGradient ||
    value instanceof CanvasPattern
  )
    return value;
  try {
    validateTexturePaint(value as never);
    return value as FillStyle;
  } catch {
    throw new TypeError("IntervalBandSeries: invalid fill.");
  }
}

/**
 * Draws a filled band between matching lower and upper observations.
 *
 * Missing, non-finite, and excluded coordinates split runs. A lower value above its upper
 * value rejects the datum; equal bounds produce zero-area geometry. The component owns one
 * ordinary {@link Path} target, so event participation follows standard Path defaults.
 *
 * @param props - Data, coordinate accessors, continuous scales, and presentation.
 * @returns A Pibbl path node containing all drawable interval-band runs.
 * @throws When data, presentation, or bounds are invalid.
 *
 * @see {@link IntervalBandSeriesProps}
 */
export function IntervalBandSeries<D>({
  data: dataInput,
  x: xInput,
  lower: lowerInput,
  upper: upperInput,
  xScale: xId,
  yScale: yId,
  defined,
  curve,
  style: styleInput,
  ...eventProps
}: IntervalBandSeriesProps<D>) {
  const xScale = useContinuousScale(xId).get();
  const yScale = useContinuousScale(yId).get();
  const curveDefinition = resolveSeriesCurve(curve);
  const x = useInternalValueMemoSlot(
    "vizIntervalBandXAccessor",
    () => accessor(xInput),
    [xInput],
  );
  const lower = useInternalValueMemoSlot(
    "vizIntervalBandLowerAccessor",
    () => accessor(lowerInput),
    [lowerInput],
  );
  const upper = useInternalValueMemoSlot(
    "vizIntervalBandUpperAccessor",
    () => accessor(upperInput),
    [upperInput],
  );
  const data = resolveSignalValue(dataInput);
  if (!Array.isArray(data))
    throw new TypeError(
      "IntervalBandSeries data must be an array or a signal containing an array.",
    );
  const style = resolveSignalValue(styleInput) ?? {};
  if (style === null || typeof style !== "object" || Array.isArray(style))
    throw new TypeError("IntervalBandSeries: style must be an object.");
  const bandFill = fill(resolveSignalValue(style.fill) ?? "#2563eb");
  const alpha = opacity(
    resolveSignalValue(style.opacity) ?? 0.2,
    "IntervalBandSeries",
  );
  const cursor = resolveSignalValue(style.cursor);
  if (cursor !== undefined && typeof cursor !== "string")
    throw new TypeError("IntervalBandSeries: cursor must be a string.");

  const path = new Path2D();
  let run: (readonly [number, number, number])[] = [];
  const closeRun = () => {
    if (run.length >= 2) {
      const upper = curveGeometry(
        curveDefinition,
        run.map(([x, _lower, value]) => [x, value] as const),
      );
      const lower = curveGeometry(
        curveDefinition,
        run.map(([x, value]) => [x, value] as const),
      );
      validatePairedCurveGeometry(upper, lower);
      path.moveTo(upper.start[0], upper.start[1]);
      appendCurveForward(path, upper);
      appendCurveReverse(path, lower);
      path.closePath();
    }
    run = [];
  };
  for (let i = 0; i < data.length; i++) {
    const datum = data[i];
    if (defined && !defined(datum, i, data)) {
      closeRun();
      continue;
    }
    const xv = x(datum, i, data);
    const lowerValue = lower(datum, i, data);
    const upperValue = upper(datum, i, data);
    if (
      typeof xv !== "number" ||
      typeof lowerValue !== "number" ||
      typeof upperValue !== "number" ||
      !Number.isFinite(xv) ||
      !Number.isFinite(lowerValue) ||
      !Number.isFinite(upperValue)
    ) {
      closeRun();
      continue;
    }
    if (lowerValue > upperValue)
      throw new RangeError(
        `IntervalBandSeries datum at index ${i} has lower bound above upper bound.`,
      );
    const point = [
      xScale.map(xv),
      yScale.map(lowerValue),
      yScale.map(upperValue),
    ] as const;
    if (!point.every(Number.isFinite)) {
      closeRun();
      continue;
    }
    run.push(point);
  }
  closeRun();
  return (
    <Path
      {...eventProps}
      style={{ d: path, fill: bandFill, opacity: alpha, cursor }}
    />
  );
}

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
import type { LineAccessor, LineCoordinate, LineSeriesProps } from "./types.js";
import {
  appendCurveForward,
  curveGeometry,
  resolveSeriesCurve,
} from "./curve-definition.js";
import { opacity } from "./paint.js";
import { useContinuousScale } from "./use-continuous-scale.js";

/**
 * Presentation properties for an {@link AreaSeries}.
 *
 * @see {@link FillStyle}
 * @see {@link AreaSeriesProps}
 */
export interface AreaSeriesStyle {
  /** Paint used for the area interior. */
  readonly fill?: FillStyle;
  /** Opacity of the painted area, from zero through one. */
  readonly opacity?: number;
  /** Cursor shown while the area target owns pointer presentation. */
  readonly cursor?: string;
}

/**
 * Authored inputs for {@link AreaSeries}.
 *
 * The data, coordinate accessors, scales, and defined predicate use the same
 * contract as {@link LineSeriesProps}. Each contiguous run of at least two
 * valid observations is closed to `baseline` in data space.
 *
 * @see {@link LineSeriesProps}
 * @see {@link AreaSeriesStyle}
 */
export interface AreaSeriesProps<D>
  extends PibblEventHandlers, PibblEventParticipationOptions {
  /** Application data supplied directly or through a signal. */
  readonly data: LineSeriesProps<D>["data"];
  /** Property key or callback extracting the horizontal coordinate. */
  readonly x: LineAccessor<D>;
  /** Property key or callback extracting the vertical coordinate. */
  readonly y: LineAccessor<D>;
  /** Continuous scale used to map horizontal data coordinates. */
  readonly xScale: LineSeriesProps<D>["xScale"];
  /** Continuous scale used to map vertical data coordinates and baseline. */
  readonly yScale: LineSeriesProps<D>["yScale"];
  /** Selects records that participate in an observed run. */
  readonly defined?: LineSeriesProps<D>["defined"];
  /** Curve used to connect successive observed samples. */
  readonly curve?: LineSeriesProps<D>["curve"];
  /** Finite data-space value to which each observed run closes. */
  readonly baseline: SignalValue<number>;
  /** Shared area presentation. Individual datum styling is not supported. */
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
    throw new TypeError("AreaSeries: invalid fill.");
  }
}

/**
 * Draws each contiguous observed run as a filled polygon closed to an explicit baseline.
 *
 * Missing, non-finite, and excluded coordinates split runs. A lone observation has no area.
 * The component owns one ordinary {@link Path} target, so event participation follows the
 * standard Path defaults; callers may wrap it in `Clip` when clipping is needed.
 *
 * @param props - Data, coordinate accessors, continuous scales, baseline, and presentation.
 * @returns A Pibbl path node containing all drawable area runs.
 * @throws When `data` is not an array, the baseline is not finite, or presentation is invalid.
 *
 * @see {@link AreaSeriesProps}
 */
export function AreaSeries<D>({
  data: dataInput,
  x: xInput,
  y: yInput,
  xScale: xId,
  yScale: yId,
  baseline: baselineInput,
  defined,
  curve,
  style: styleInput,
  ...eventProps
}: AreaSeriesProps<D>) {
  const xScale = useContinuousScale(xId).get();
  const yScale = useContinuousScale(yId).get();
  const curveDefinition = resolveSeriesCurve(curve);
  const x = useInternalValueMemoSlot(
    "vizAreaXAccessor",
    () => accessor(xInput),
    [xInput],
  );
  const y = useInternalValueMemoSlot(
    "vizAreaYAccessor",
    () => accessor(yInput),
    [yInput],
  );
  const data = resolveSignalValue(dataInput);
  if (!Array.isArray(data))
    throw new TypeError(
      "AreaSeries data must be an array or a signal containing an array.",
    );
  const baseline = resolveSignalValue(baselineInput);
  if (typeof baseline !== "number" || !Number.isFinite(baseline))
    throw new RangeError("AreaSeries baseline must be finite.");
  const baselineY = yScale.map(baseline);
  if (!Number.isFinite(baselineY))
    throw new RangeError(
      "AreaSeries baseline must map to a finite coordinate.",
    );
  const style = resolveSignalValue(styleInput) ?? {};
  if (style === null || typeof style !== "object" || Array.isArray(style))
    throw new TypeError("AreaSeries: style must be an object.");
  const areaFill = fill(resolveSignalValue(style.fill) ?? "#2563eb");
  const alpha = opacity(resolveSignalValue(style.opacity) ?? 0.2, "AreaSeries");
  const cursor = resolveSignalValue(style.cursor);
  if (cursor !== undefined && typeof cursor !== "string")
    throw new TypeError("AreaSeries: cursor must be a string.");

  const path = new Path2D();
  let run: (readonly [number, number])[] = [];
  const closeRun = () => {
    if (run.length >= 2) {
      const first = run[0];
      const last = run[run.length - 1];
      const geometry = curveGeometry(curveDefinition, run);
      path.moveTo(geometry.start[0], geometry.start[1]);
      appendCurveForward(path, geometry);
      path.lineTo(last[0], baselineY);
      path.lineTo(first[0], baselineY);
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
    const yv = y(datum, i, data);
    if (
      typeof xv !== "number" ||
      typeof yv !== "number" ||
      !Number.isFinite(xv) ||
      !Number.isFinite(yv)
    ) {
      closeRun();
      continue;
    }
    const point = [xScale.map(xv), yScale.map(yv)] as const;
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
      closeRun();
      continue;
    }
    run.push(point);
  }
  closeRun();
  return (
    <Path
      {...eventProps}
      style={{ d: path, fill: areaFill, opacity: alpha, cursor }}
    />
  );
}

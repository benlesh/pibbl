import { resolveTexturePaint } from "@pibbl/core/internal";
import { Path, resolveSignalValue, useCanvasContext } from "@pibbl/core";
import type {
  FillStyle,
  PibblEventHandlers,
  PibblEventParticipationOptions,
  SignalValue,
  StrokeStyle,
} from "@pibbl/core";
import type { SignalStyle } from "@pibbl/core/internal";
import { validateTexturePaint, withHooksForbidden } from "@pibbl/core/internal";
import type { LineAccessor, ScaleId, SeriesAccessor } from "./types.js";
import { pointAccessor, pointData } from "./point-data.js";
import { appendPointTarget, pointPath } from "./point-geometry.js";
import { opacity, width } from "./paint.js";
import {
  mapSeriesPosition,
  seriesAccessor,
  useSeriesPosition,
} from "./series-position.js";

const fields = ["fill", "stroke", "strokeWidth", "opacity", "cursor"];

/**
 * A data property or callback extracting a nonnegative research weight.
 *
 * @see {@link WeightedPointSeriesProps}
 */
export type WeightAccessor<D> = LineAccessor<D>;

/** Shared presentation for {@link WeightedPointSeries}. */
export interface WeightedPointSeriesStyle {
  /** Paint used for point interiors. Defaults to `#087f8c`. */
  readonly fill?: FillStyle;
  /** Paint used for point outlines. Defaults to no outline. */
  readonly stroke?: StrokeStyle;
  /** Outline width in local coordinate units. Defaults to 1. */
  readonly strokeWidth?: number;
  /** Opacity in the inclusive range [0, 1]. Defaults to 1. */
  readonly opacity?: number;
  /** Pointer cursor while the series owns a target. */
  readonly cursor?: string;
}

/**
 * Authored inputs for {@link WeightedPointSeries}.
 *
 * Weights are supplied data, not calculated precision, sample size, or evidence.
 * The zero baseline and squared-radius interpolation make displayed area linear in
 * the supplied weight.
 */
export interface WeightedPointSeriesProps<D>
  extends PibblEventHandlers, PibblEventParticipationOptions {
  /** Readonly data or a signal containing it. */
  readonly data: SignalValue<readonly D[]>;
  /** Horizontal coordinate property or synchronous accessor. */
  readonly x: SeriesAccessor<D>;
  /** Vertical coordinate property or synchronous accessor. */
  readonly y: SeriesAccessor<D>;
  /** Nonnegative supplied weight property or synchronous accessor. */
  readonly weight: WeightAccessor<D>;
  /** Scale used to map x coordinates. */
  readonly xScale: ScaleId;
  /** Scale used to map y coordinates. */
  readonly yScale: ScaleId;
  /** Supplied inclusive weight extent. The lower bound must be zero. */
  readonly weightDomain: readonly [0, number];
  /** Radius extent `[0, maximumRadius]`; defaults to `[0, 6]`. */
  readonly radiusRange?: readonly [0, number];
  /**
   * Excludes a datum before coordinate and weight accessors run.
   * @param datum - Candidate source datum.
   * @param index - Zero-based source index.
   * @param data - Complete source data array.
   * @returns Whether this datum contributes a mark.
   */
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
  /** Shared presentation. Whole-object and shallow field signals are supported. */
  readonly style?: SignalValue<SignalStyle<WeightedPointSeriesStyle>>;
}

function paint(
  value: unknown,
  name: string,
): FillStyle | StrokeStyle | undefined {
  if (
    value === undefined ||
    typeof value === "string" ||
    value instanceof CanvasGradient ||
    value instanceof CanvasPattern
  )
    return value;
  try {
    validateTexturePaint(value as never);
    return value as FillStyle | StrokeStyle;
  } catch {
    // Normalize all unsupported public paint values to the series error.
  }
  throw new TypeError(`WeightedPointSeries: invalid ${name}.`);
}

function styleObject(input: unknown): WeightedPointSeriesStyle {
  if (input === null || typeof input !== "object" || Array.isArray(input))
    throw new TypeError("WeightedPointSeries: style must be an object.");
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(input)) {
    if (!fields.includes(key))
      throw new TypeError(
        `WeightedPointSeries: unsupported style field ${key}.`,
      );
    result[key] = resolveSignalValue((input as Record<string, unknown>)[key]);
  }
  return result as WeightedPointSeriesStyle;
}

function normalized(style: WeightedPointSeriesStyle) {
  if (style.cursor !== undefined && typeof style.cursor !== "string")
    throw new TypeError("WeightedPointSeries: cursor must be a string.");
  return {
    fill: paint(style.fill ?? "#087f8c", "fill"),
    stroke: paint(style.stroke, "stroke"),
    strokeWidth: width(
      style.strokeWidth ?? 1,
      "WeightedPointSeries strokeWidth",
    ),
    opacity: opacity(style.opacity ?? 1, "WeightedPointSeries opacity"),
    cursor: style.cursor,
  };
}

function range(
  value: readonly [number, number] | undefined,
): readonly [number, number] {
  const actual: readonly [number, number] = value ?? [0, 6];
  if (
    !Array.isArray(actual) ||
    actual.length !== 2 ||
    actual[0] !== 0 ||
    !Number.isFinite(actual[1]) ||
    actual[1] < 0
  )
    throw new RangeError(
      "WeightedPointSeries: radiusRange must be [0, a finite nonnegative maximum].",
    );
  return actual;
}

function domain(value: readonly [0, number]): readonly [number, number] {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    value[0] !== 0 ||
    !Number.isFinite(value[1]) ||
    value[1] <= 0
  )
    throw new RangeError(
      "WeightedPointSeries: weightDomain must be [0, a finite positive maximum].",
    );
  return value;
}

/**
 * Draws batched circles whose visible area is proportional to supplied weights.
 *
 * Nullish weights and zero weights omit their marks. Finite positive weights must
 * fall inside `weightDomain`; the component never clamps or infers weights.
 * `data` and shared style signals schedule ordinary Pibbl updates. The component
 * owns no retained resources and returns one ordinary Pibbl pointer target.
 *
 * @param props - Supplied observations, coordinate and weight accessors, scales, and paint.
 * See {@link WeightedPointSeriesProps}.
 * @returns One batched Pibbl Path whose mark area is proportional to each supplied weight.
 * @see {@link WeightedPointSeriesProps}
 */
export function WeightedPointSeries<D>({
  data: input,
  x: xInput,
  y: yInput,
  weight: weightInput,
  xScale: xId,
  yScale: yId,
  weightDomain,
  radiusRange,
  defined,
  style: styleInput,
  ...events
}: WeightedPointSeriesProps<D>) {
  const xs = useSeriesPosition(xId);
  const ys = useSeriesPosition(yId);
  const data = pointData(resolveSignalValue(input), "WeightedPointSeries");
  const x = seriesAccessor(xInput);
  const y = seriesAccessor(yInput);
  const weight = pointAccessor(weightInput);
  const [, maximumWeight] = domain(weightDomain);
  const [, maximumRadius] = range(radiusRange);
  const style = normalized(styleObject(resolveSignalValue(styleInput) ?? {}));
  const ctx = useCanvasContext();
  const target = new Path2D();
  const marks: {
    readonly x: number;
    readonly y: number;
    readonly radius: number;
  }[] = [];
  for (let i = 0; i < data.length; i++) {
    const datum = data[i];
    const values = withHooksForbidden(
      "WeightedPointSeries: accessors cannot call hooks.",
      () => {
        if (defined && !defined(datum, i, data)) return undefined;
        return {
          x: x(datum, i, data),
          y: y(datum, i, data),
          weight: weight(datum, i, data),
        };
      },
    );
    if (!values) continue;
    const mappedX = mapSeriesPosition(xs, values.x);
    const mappedY = mapSeriesPosition(ys, values.y);
    if (mappedX === undefined || mappedY === undefined) continue;
    const supplied = values.weight;
    if (supplied == null) continue;
    if (typeof supplied !== "number" || !Number.isFinite(supplied))
      throw new TypeError(
        "WeightedPointSeries: weight must be a finite number.",
      );
    if (supplied < 0)
      throw new RangeError("WeightedPointSeries: weight must be nonnegative.");
    if (supplied > maximumWeight)
      throw new RangeError("WeightedPointSeries: weight exceeds weightDomain.");
    if (supplied === 0 || maximumRadius === 0) continue;
    const radius = maximumRadius * Math.sqrt(supplied / maximumWeight);
    marks.push({ x: mappedX, y: mappedY, radius });
  }
  for (const { x, y, radius } of marks) {
    appendPointTarget(
      target,
      x,
      y,
      radius,
      !!style.fill,
      style.stroke ? style.strokeWidth : 0,
    );
    const path = pointPath(x, y, radius);
    ctx.save();
    try {
      ctx.globalAlpha *= style.opacity;
      if (style.fill) {
        ctx.fillStyle = resolveTexturePaint(style.fill, ctx, {
          x: x - radius,
          y: y - radius,
          width: radius * 2,
          height: radius * 2,
        });
        ctx.fill(path);
      }
      if (style.stroke && style.strokeWidth > 0) {
        ctx.strokeStyle = resolveTexturePaint(style.stroke, ctx, {
          x: x - radius,
          y: y - radius,
          width: radius * 2,
          height: radius * 2,
        });
        ctx.lineWidth = style.strokeWidth;
        ctx.stroke(path);
      }
    } finally {
      ctx.restore();
    }
  }
  return (
    <Path
      {...events}
      style={{ d: target, fill: "transparent", cursor: style.cursor }}
    />
  );
}

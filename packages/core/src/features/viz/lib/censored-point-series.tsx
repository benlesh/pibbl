import { Path, resolveSignalValue } from "@pibbl/core";
import type {
  FillStyle,
  PibblEventHandlers,
  PibblEventParticipationOptions,
  SignalValue,
  StrokeStyle,
} from "@pibbl/core";
import type { SignalStyle } from "@pibbl/core/internal";
import { validateTexturePaint, withHooksForbidden } from "@pibbl/core/internal";
import type { LineAccessor, ScaleId } from "./types.js";
import { finiteCoordinate, pointAccessor, pointData } from "./point-data.js";
import { opacity, width } from "./paint.js";
import { useContinuousScale } from "./use-continuous-scale.js";

/** A supplied assay reporting status. `below` and `above` retain the supplied reporting limit.
 * @see {@link CensoredPointSeriesProps}
 */
export type CensoringStatus = "observed" | "below" | "above";

/** Extracts an observation's supplied reporting status.
 * @param datum - Original record being read.
 * @param index - Zero-based source index.
 * @param data - Complete supplied record array.
 * @returns The supplied status, or a nullish sentinel that omits the record.
 * @see {@link CensoringStatus}
 */
export type CensoringAccessor<D> =
  | {
      [K in keyof D]-?: D[K] extends CensoringStatus | null | undefined
        ? K
        : never;
    }[keyof D]
  | ((
      datum: D,
      index: number,
      data: readonly D[],
    ) => CensoringStatus | null | undefined);

/** Shared mark paint and local-pixel geometry for {@link CensoredPointSeries}. */
export interface CensoredPointSeriesStyle {
  /** Circle and open censor marker radius in local pixels; defaults to 4. */
  readonly radius?: number;
  /** Fill for observed circles; defaults to #087f8c. Censor markers remain open. */
  readonly fill?: FillStyle;
  /** Outline for circles and open directional censor markers; defaults to #087f8c. */
  readonly stroke?: StrokeStyle;
  /** Outline width in local pixels; defaults to 1.5. */
  readonly strokeWidth?: number;
  /** Shared paint opacity from zero to one; defaults to 1. */
  readonly opacity?: number;
  /** Cursor for painted mark targets. */
  readonly cursor?: string;
}

/** Authored inputs for supplied observed and censored numeric observations.
 * @see {@link CensoredPointSeries}
 */
export interface CensoredPointSeriesProps<D>
  extends PibblEventHandlers, PibblEventParticipationOptions {
  /** Original records, or a signal of records. The series performs no imputation or inference. */
  readonly data: SignalValue<readonly D[]>;
  /** Property or callback supplying the numeric horizontal coordinate. */
  readonly x: LineAccessor<D>;
  /** Property or callback supplying the numeric vertical value or reporting limit. */
  readonly y: LineAccessor<D>;
  /** Property or callback yielding `observed`, `below`, or `above`. */
  readonly censoring: CensoringAccessor<D>;
  /** Ancestor continuous numeric scale mapping x. */
  readonly xScale: ScaleId;
  /** Ancestor continuous numeric scale mapping y and its reporting limit. */
  readonly yScale: ScaleId;
  /** Optional synchronous predicate; excluded rows contribute no mark.
   * @param datum - Original record being tested.
   * @param index - Zero-based source index.
   * @param data - Complete supplied record array.
   * @returns Whether this record contributes a mark.
   */
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
  /** Shared style; whole-object and shallow field signals are observed by the series. */
  readonly style?: SignalValue<SignalStyle<CensoredPointSeriesStyle>>;
}

const fields = ["radius", "fill", "stroke", "strokeWidth", "opacity", "cursor"];

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
    // Fall through to the local series error rather than leaking protocol detail.
  }
  throw new TypeError(`CensoredPointSeries: invalid ${name}.`);
}

function triangle(
  path: Path2D,
  x: number,
  y: number,
  radius: number,
  direction: number,
) {
  path.moveTo(x, y + direction * radius);
  path.lineTo(x - radius * 0.78, y - direction * radius * 0.55);
  path.lineTo(x + radius * 0.78, y - direction * radius * 0.55);
  path.closePath();
}

/**
 * Draws supplied numeric observations as circles and below/above reporting limits as open arrows.
 *
 * `below` points toward decreasing y-domain values and `above` toward increasing y-domain values,
 * including when the y scale uses a reversed domain or range. The supplied `y` value remains the
 * reporting limit; this component never substitutes a measurement, imputes a value, or fits a model.
 *
 * @param props - Supplied observations, coordinates, reporting statuses, scales, and paint.
 * See {@link CensoredPointSeriesProps}.
 * @returns Two ordinary batched paths for observed and open censored marks.
 * @see {@link CensoredPointSeriesProps}
 */
export function CensoredPointSeries<D>({
  data: input,
  x: xInput,
  y: yInput,
  censoring: censoringInput,
  xScale: xId,
  yScale: yId,
  defined,
  style: styleInput,
  pointerEvents,
  ...events
}: CensoredPointSeriesProps<D>) {
  const xScale = useContinuousScale(xId).get();
  const yScale = useContinuousScale(yId).get();
  const data = pointData(resolveSignalValue(input), "CensoredPointSeries");
  const x = pointAccessor(xInput),
    y = pointAccessor(yInput);
  const censoring =
    typeof censoringInput === "function"
      ? censoringInput
      : (datum: D) =>
          datum[censoringInput] as CensoringStatus | null | undefined;
  const specified = resolveSignalValue(styleInput) ?? {};
  if (
    specified === null ||
    typeof specified !== "object" ||
    Array.isArray(specified)
  )
    throw new TypeError("CensoredPointSeries: style must be an object.");
  const style: Record<string, unknown> = {};
  for (const key of Object.keys(specified)) {
    if (!fields.includes(key))
      throw new TypeError(
        `CensoredPointSeries: unsupported style field ${key}.`,
      );
    style[key] = resolveSignalValue(
      (specified as Record<string, unknown>)[key],
    );
  }
  const resolved = style as CensoredPointSeriesStyle;
  const radius = width(resolved.radius ?? 4, "CensoredPointSeries radius");
  const strokeWidth = width(resolved.strokeWidth ?? 1.5, "CensoredPointSeries");
  const alpha = opacity(resolved.opacity ?? 1, "CensoredPointSeries");
  if (resolved.cursor !== undefined && typeof resolved.cursor !== "string")
    throw new TypeError("CensoredPointSeries: cursor must be a string.");
  const fill = paint(resolved.fill ?? "#087f8c", "fill");
  const stroke = paint(resolved.stroke ?? "#087f8c", "stroke");
  const observed = new Path2D();
  const censored = new Path2D();
  // The sign is a property of the domain-to-range mapping, rather than canvas orientation.
  const increasingY = Math.sign(
    (yScale.domain[1] - yScale.domain[0]) * (yScale.range[1] - yScale.range[0]),
  );
  for (let i = 0; i < data.length; i++) {
    const datum = data[i];
    const coordinates = withHooksForbidden(
      "CensoredPointSeries: accessors cannot call hooks.",
      () => {
        if (defined && !defined(datum, i, data)) return undefined;
        return {
          x: x(datum, i, data),
          y: y(datum, i, data),
          censoring: censoring(datum, i, data),
        };
      },
    );
    if (
      !coordinates ||
      !finiteCoordinate(coordinates.x) ||
      !finiteCoordinate(coordinates.y) ||
      coordinates.censoring == null
    )
      continue;
    if (
      !(["observed", "below", "above"] as const).includes(coordinates.censoring)
    )
      throw new TypeError(
        `CensoredPointSeries: unknown censoring status ${String(coordinates.censoring)} (row ${i}).`,
      );
    const px = xScale.map(coordinates.x),
      py = yScale.map(coordinates.y);
    if (!Number.isFinite(px) || !Number.isFinite(py))
      throw new RangeError(
        `CensoredPointSeries: mapped coordinates must be finite (row ${i}).`,
      );
    if (radius === 0) continue;
    if (coordinates.censoring === "observed") {
      observed.moveTo(px + radius, py);
      observed.arc(px, py, radius, 0, Math.PI * 2);
      observed.closePath();
    } else {
      const direction =
        coordinates.censoring === "above" ? increasingY : -increasingY;
      triangle(censored, px, py, radius, direction || 1);
    }
  }
  const common = {
    stroke,
    strokeWidth,
    opacity: alpha,
    cursor: resolved.cursor,
  };
  return (
    <>
      <Path
        {...events}
        pointerEvents={pointerEvents}
        style={{ d: observed, fill, ...common }}
      />
      <Path
        {...events}
        pointerEvents={pointerEvents}
        style={{ d: censored, fill: "transparent", ...common }}
      />
    </>
  );
}

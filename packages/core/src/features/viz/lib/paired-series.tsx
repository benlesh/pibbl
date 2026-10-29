import { Path, resolveSignalValue } from "@pibbl/core";
import type {
  PibblEventHandlers,
  PibblEventParticipationOptions,
  SignalValue,
  StrokeStyle,
} from "@pibbl/core";
import { withHooksForbidden } from "@pibbl/core/internal";
import type { SignalStyle } from "@pibbl/core/internal";
import type { LineAccessor, ScaleId, SeriesCoordinate } from "./types.js";
import type { TrajectorySeriesStyle } from "./trajectory-series.js";
import { pointAccessor, pointData } from "./point-data.js";
import { opacity, width } from "./paint.js";
import {
  mapSeriesPosition,
  useNumericPosition,
  useSeriesPosition,
} from "./series-position.js";

/** Shared connector appearance for {@link PairedSeries}. */
export type PairedSeriesStyle = TrajectorySeriesStyle;

/** Authored wide-record inputs for {@link PairedSeries}. */
export interface PairedSeriesProps<D>
  extends PibblEventHandlers, PibblEventParticipationOptions {
  /** Source records or a signal containing them. */
  readonly data: SignalValue<readonly D[]>;
  /** Numeric baseline or first-observation value. */
  readonly before: LineAccessor<D>;
  /** Numeric follow-up or second-observation value. */
  readonly after: LineAccessor<D>;
  /** Fixed x coordinate used for every `before` endpoint. */
  readonly beforeX: SeriesCoordinate;
  /** Fixed x coordinate used for every `after` endpoint. */
  readonly afterX: SeriesCoordinate;
  /** Scale mapping the two endpoint coordinates. */
  readonly xScale: ScaleId;
  /** Numeric scale mapping both endpoint values. */
  readonly yScale: ScaleId;
  /**
   * Excludes a record before before/after accessors run.
   * @param datum - Candidate source datum.
   * @param index - Zero-based source index.
   * @param data - Complete source data array.
   * @returns Whether this record contributes a connector.
   */
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
  /** Shared connector style, including whole-object and shallow field signals. */
  readonly style?: SignalValue<SignalStyle<PairedSeriesStyle>>;
}

interface ResolvedPairedStyle {
  readonly stroke: StrokeStyle;
  readonly strokeWidth: number;
  readonly lineInteractionWidth: number;
  readonly opacity: number;
  readonly cursor?: string;
}

function style(input: unknown): ResolvedPairedStyle {
  if (input === null || typeof input !== "object" || Array.isArray(input))
    throw new TypeError("PairedSeries: style must be an object.");
  const value = input as Record<string, unknown>;
  for (const field of Object.keys(value))
    if (
      ![
        "stroke",
        "strokeWidth",
        "lineInteractionWidth",
        "opacity",
        "cursor",
      ].includes(field)
    )
      throw new TypeError(`PairedSeries: unsupported style field ${field}.`);
  const stroke = resolveSignalValue(value.stroke) ?? "#2563eb";
  const strokeWidth = width(
    (resolveSignalValue(value.strokeWidth) ?? 2) as number,
    "PairedSeries strokeWidth",
  );
  const lineInteractionWidth = width(
    (resolveSignalValue(value.lineInteractionWidth) ?? strokeWidth) as number,
    "PairedSeries lineInteractionWidth",
  );
  const cursor = resolveSignalValue(value.cursor);
  if (cursor !== undefined && typeof cursor !== "string")
    throw new TypeError("PairedSeries: cursor must be a string.");
  return {
    stroke: stroke as StrokeStyle,
    strokeWidth,
    lineInteractionWidth,
    opacity: opacity(
      (resolveSignalValue(value.opacity) ?? 1) as number,
      "PairedSeries opacity",
    ),
    cursor,
  };
}

/**
 * Draws a connector for each complete wide-record before/after pair.
 *
 * The component does not manufacture point marks, calculate change, select a
 * baseline, or impute missing observations. Compose `PointSeries` for endpoints.
 *
 * @param props - Wide records, endpoint accessors and coordinates, scales, and shared paint.
 * @returns One batched ordinary Pibbl path containing source-ordered pair connectors.
 * @see {@link PairedSeriesProps}
 */
export function PairedSeries<D>({
  data: input,
  before: beforeInput,
  after: afterInput,
  beforeX,
  afterX,
  xScale: xId,
  yScale: yId,
  defined,
  style: styleInput,
  ...events
}: PairedSeriesProps<D>) {
  const xs = useSeriesPosition(xId);
  const ys = useNumericPosition(yId);
  const data = pointData(resolveSignalValue(input), "PairedSeries");
  const before = pointAccessor(beforeInput);
  const after = pointAccessor(afterInput);
  const startX = mapSeriesPosition(xs, beforeX);
  const endX = mapSeriesPosition(xs, afterX);
  const resolved = style(resolveSignalValue(styleInput) ?? {});
  const path = new Path2D();
  if (startX !== undefined && endX !== undefined)
    for (let i = 0; i < data.length; i++) {
      const datum = data[i];
      const row = withHooksForbidden(
        "PairedSeries: accessors cannot call hooks.",
        () => {
          if (defined && !defined(datum, i, data)) return undefined;
          return {
            before: before(datum, i, data),
            after: after(datum, i, data),
          };
        },
      );
      if (!row) continue;
      const startY = mapSeriesPosition(ys, row.before);
      const endY = mapSeriesPosition(ys, row.after);
      if (startY === undefined || endY === undefined) continue;
      path.moveTo(startX, startY);
      path.lineTo(endX, endY);
    }
  return <Path {...events} style={{ d: path, ...resolved }} />;
}

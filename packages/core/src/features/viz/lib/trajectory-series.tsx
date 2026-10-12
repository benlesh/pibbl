import { Path, resolveSignalValue } from "@pibbl/core";
import type {
  PibblEventHandlers,
  PibblEventParticipationOptions,
  SignalValue,
  StrokeStyle,
} from "@pibbl/core";
import { withHooksForbidden } from "@pibbl/core/internal";
import type { SignalStyle } from "@pibbl/core/internal";
import type { LineAccessor, ScaleId, SeriesAccessor } from "./types.js";
import { opacity, width } from "./paint.js";
import { pointAccessor, pointData } from "./point-data.js";
import {
  mapSeriesPosition,
  seriesAccessor,
  useNumericPosition,
  useSeriesPosition,
} from "./series-position.js";

/** Shared path appearance for {@link TrajectorySeries}. */
export interface TrajectorySeriesStyle {
  /** Path paint. Defaults to `#2563eb`. */
  readonly stroke?: StrokeStyle;
  /** Visible path width in local units. Defaults to 2. */
  readonly strokeWidth?: number;
  /** Pointer targeting width. Defaults to `strokeWidth`. */
  readonly lineInteractionWidth?: number;
  /** Path opacity in [0, 1]. Defaults to 1. */
  readonly opacity?: number;
  /** Cursor while the batched path owns pointer presentation. */
  readonly cursor?: string;
}

/**
 * A participant or specimen identity property or callback.
 *
 * Nullish identities deliberately omit a row. Numeric identities must be finite.
 * @param datum - Source observation.
 * @param index - Zero-based source index.
 * @param data - Complete source data array.
 * @returns A finite numeric or string identity, or a nullish omitted identity.
 * @see {@link TrajectorySeriesProps}
 */
export type TrajectoryGroupAccessor<D> =
  | {
      [K in keyof D]-?: D[K] extends string | number | null | undefined
        ? K
        : never;
    }[keyof D]
  | ((
      datum: D,
      index: number,
      data: readonly D[],
    ) => string | number | null | undefined);

/**
 * Authoring inputs for {@link TrajectorySeries}.
 *
 * Rows are connected in source encounter order within each group. The component
 * neither sorts time values nor invents visits, summaries, or missing values.
 */
export interface TrajectorySeriesProps<D>
  extends PibblEventHandlers, PibblEventParticipationOptions {
  /** Source observations or a signal containing them. */
  readonly data: SignalValue<readonly D[]>;
  /** Stable participant or specimen identity. Nullish identities omit that row. */
  readonly group: TrajectoryGroupAccessor<D>;
  /** Encounter-time or scheduled-visit coordinate. */
  readonly x: SeriesAccessor<D>;
  /** Numeric observed outcome coordinate. */
  readonly y: LineAccessor<D>;
  /** Scale mapping encounter-time or visit coordinates. */
  readonly xScale: ScaleId;
  /** Numeric scale mapping outcomes. */
  readonly yScale: ScaleId;
  /**
   * Ends that group's current run without reading coordinate accessors.
   * @param datum - Candidate source datum.
   * @param index - Zero-based source index.
   * @param data - Complete source data array.
   * @returns Whether this datum contributes a coordinate to its group.
   */
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
  /** Shared path style, including whole-object and shallow field signals. */
  readonly style?: SignalValue<SignalStyle<TrajectorySeriesStyle>>;
}

interface ResolvedTrajectoryStyle {
  readonly stroke: StrokeStyle;
  readonly strokeWidth: number;
  readonly lineInteractionWidth: number;
  readonly opacity: number;
  readonly cursor?: string;
}

function style(input: unknown): ResolvedTrajectoryStyle {
  if (input === null || typeof input !== "object" || Array.isArray(input))
    throw new TypeError("TrajectorySeries: style must be an object.");
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
      throw new TypeError(
        `TrajectorySeries: unsupported style field ${field}.`,
      );
  const stroke = resolveSignalValue(value.stroke) ?? "#2563eb";
  const strokeWidth = width(
    (resolveSignalValue(value.strokeWidth) ?? 2) as number,
    "TrajectorySeries strokeWidth",
  );
  const lineInteractionWidth = width(
    (resolveSignalValue(value.lineInteractionWidth) ?? strokeWidth) as number,
    "TrajectorySeries lineInteractionWidth",
  );
  const cursor = resolveSignalValue(value.cursor);
  if (cursor !== undefined && typeof cursor !== "string")
    throw new TypeError("TrajectorySeries: cursor must be a string.");
  return {
    stroke: stroke as StrokeStyle,
    strokeWidth,
    lineInteractionWidth,
    opacity: opacity(
      (resolveSignalValue(value.opacity) ?? 1) as number,
      "TrajectorySeries opacity",
    ),
    cursor,
  };
}

/**
 * Draws one shared-style path connecting each participant or specimen trajectory.
 *
 * A missing, excluded, or non-finite coordinate ends only that group's current
 * run. Interleaved groups retain their source encounter order; trajectories are
 * never sorted by either actual or scheduled time.
 *
 * @param props - Observations, identities, coordinates, scales, and shared path paint.
 * @returns One batched ordinary Pibbl path containing source-ordered trajectory segments.
 * @see {@link TrajectorySeriesProps}
 */
export function TrajectorySeries<D>({
  data: input,
  group: groupInput,
  x: xInput,
  y: yInput,
  xScale: xId,
  yScale: yId,
  defined,
  style: styleInput,
  ...events
}: TrajectorySeriesProps<D>) {
  const xs = useSeriesPosition(xId);
  const ys = useNumericPosition(yId);
  const data = pointData(resolveSignalValue(input), "TrajectorySeries");
  const x = seriesAccessor(xInput);
  const y = pointAccessor(yInput);
  const group =
    typeof groupInput === "function"
      ? groupInput
      : (datum: D) => datum[groupInput] as string | number | null | undefined;
  const resolved = style(resolveSignalValue(styleInput) ?? {});
  const last = new Map<string | number, readonly [number, number]>();
  const path = new Path2D();
  for (let i = 0; i < data.length; i++) {
    const datum = data[i];
    const row = withHooksForbidden(
      "TrajectorySeries: accessors cannot call hooks.",
      () => {
        const identity = group(datum, i, data);
        if (defined && !defined(datum, i, data)) return { group: identity };
        return {
          group: identity,
          x: x(datum, i, data),
          y: y(datum, i, data),
        };
      },
    );
    if (!row || row.group == null) continue;
    if (
      (typeof row.group !== "string" && typeof row.group !== "number") ||
      (typeof row.group === "number" && !Number.isFinite(row.group))
    )
      throw new TypeError(
        "TrajectorySeries: group must be a string or number.",
      );
    if (!("x" in row) || !("y" in row)) {
      last.delete(row.group);
      continue;
    }
    const px = mapSeriesPosition(xs, row.x);
    const py = mapSeriesPosition(ys, row.y);
    if (px === undefined || py === undefined) {
      last.delete(row.group);
      continue;
    }
    const prior = last.get(row.group);
    if (prior) {
      path.moveTo(prior[0], prior[1]);
      path.lineTo(px, py);
    }
    last.set(row.group, [px, py]);
  }
  return <Path {...events} style={{ d: path, ...resolved }} />;
}

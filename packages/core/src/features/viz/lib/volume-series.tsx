import { useNumericPosition } from "./series-position.js";
import {
  Group,
  Path,
  resolveSignalValue,
  type FillStyle,
  type StrokeStyle,
  type SignalValue,
  type PibblEventHandlers,
  type PibblEventParticipationOptions,
  type PibblNode,
} from "@pibbl/core";
import { withHooksForbidden } from "@pibbl/core/internal";
import type { LineAccessor, ScaleId } from "./types.js";
import type {
  VolumeInspectionRef,
  CapturedVolumeMark,
} from "../inspection/volume.js";
import { useContinuousScale } from "./use-continuous-scale.js";
import { pointAccessor, pointData, finiteCoordinate } from "./point-data.js";
import { financialMarkWidth, volumeGeometry } from "./financial-geometry.js";
import { opacity, width } from "./paint.js";

/** Local column presentation; color meaning is supplied by the application.
 * @see {@link VolumeSeries}
 */
export interface VolumeSeriesStyle {
  /** Positive column width in local logical units; default 70% spacing capped at 12. */
  readonly width?: number;
  /** Interior paint; defaults to teal. */
  readonly fill?: FillStyle;
  /** Optional column outline paint. */
  readonly stroke?: StrokeStyle;
  /** Nonnegative outline width in local units; default 1. */
  readonly strokeWidth?: number;
  /** Paint opacity from zero through one; default 1. */
  readonly opacity?: number;
  /** Cursor when the series owns coordinate targeting. */
  readonly cursor?: string;
}
/** Time-aligned volume columns with an independent numeric y-scale.
 * @see {@link VolumeSeries}
 */
export interface VolumeSeriesProps<D>
  extends PibblEventHandlers, PibblEventParticipationOptions {
  /** Original records or a signal of records; never sorted or mutated. */
  readonly data: SignalValue<readonly D[]>;
  /** UTC-millisecond property or callback; missing/nonfinite values skip the row. */
  readonly time: LineAccessor<D>;
  /** Nonnegative volume property or callback; missing/nonfinite values skip the row. */
  readonly volume: LineAccessor<D>;
  /** Selects source records before evaluating accessors.
   * @param datum - Original record.
   * @param index - Original source index.
   * @param data - Complete source array.
   * @returns Whether the row participates.
   */
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
  /** Numeric time scale identity. */
  readonly xScale: ScaleId;
  /** Independent numeric volume scale identity; the baseline is zero. */
  readonly yScale: ScaleId;
  /** Constant presentation or a hook-free per-record resolver.
   * @param datum - Original record.
   * @param index - Original source index.
   * @param data - Complete source array.
   * @returns Column presentation.
   */
  readonly style?:
    | SignalValue<VolumeSeriesStyle>
    | ((datum: D, index: number, data: readonly D[]) => VolumeSeriesStyle);
  /** Optional committed capture; importing the renderer does not import inspection queries. */
  readonly inspection?: VolumeInspectionRef<D>;
}
/**
 * Paints source-ordered time-aligned volume columns, batching adjacent equal styles.
 * Zero volume is recorded but has no painted coverage. Finite negative volume rejects.
 * @param props - Original records, numeric scales, accessors and optional capture.
 * @returns Ordinary Pibbl paint/event composition.
 * @see {@link VolumeSeriesProps}
 */
export function VolumeSeries<D>({
  data: input,
  time: timeInput,
  volume: volumeInput,
  xScale,
  yScale,
  defined,
  style: styleInput,
  inspection,
  pointerEvents,
  ...events
}: VolumeSeriesProps<D>): PibblNode {
  const xs = useNumericPosition(xScale),
    ys = useContinuousScale(yScale).get();
  const data = pointData(resolveSignalValue(input), "VolumeSeries");
  const time = pointAccessor(timeInput),
    volume = pointAccessor(volumeInput);
  const rows: {
    datum: D;
    sourceIndex: number;
    time: number;
    volume: number;
    x: number;
    y: number;
  }[] = [];
  for (let i = 0; i < data.length; i++) {
    const datum = data[i];
    if (defined && !defined(datum, i, data)) continue;
    const t = time(datum, i, data),
      v = volume(datum, i, data);
    if (!finiteCoordinate(t) || !finiteCoordinate(v)) continue;
    if (v < 0)
      throw new RangeError(
        `VolumeSeries: negative volume at source index ${i}.`,
      );
    rows.push({
      datum,
      sourceIndex: i,
      time: t,
      volume: v,
      x: xs.map(t),
      y: ys.map(v),
    });
  }
  const positions = rows.map((row) => row.x),
    baselineY = ys.map(0),
    defaultWidth = financialMarkWidth(positions);
  const specified =
    typeof styleInput === "function"
      ? styleInput
      : resolveSignalValue(styleInput);
  const marks: CapturedVolumeMark<D>[] | undefined = inspection
    ? []
    : undefined;
  const batches: {
    path: Path2D;
    fill: FillStyle;
    stroke: StrokeStyle | undefined;
    strokeWidth: number;
    opacity: number;
    cursor: string | undefined;
    minX: number;
    maxX: number;
  }[] = [];
  for (const row of rows) {
    const style =
      typeof specified === "function"
        ? withHooksForbidden("VolumeSeries style callback", () =>
            specified(row.datum, row.sourceIndex, data),
          )
        : (specified ?? {});
    const markWidth =
      style.width === undefined
        ? defaultWidth
        : financialMarkWidth([], { width: style.width });
    const b = volumeGeometry({
      centerX: row.x,
      valueY: row.y,
      baselineY,
      width: markWidth,
    });
    const fill = style.fill ?? "#087f8c",
      stroke = style.stroke,
      strokeWidth = width(style.strokeWidth ?? 1, "VolumeSeries"),
      alpha = opacity(style.opacity ?? 1, "VolumeSeries");
    marks?.push(
      Object.freeze({
        datum: row.datum,
        sourceIndex: row.sourceIndex,
        time: row.time,
        volume: row.volume,
        baseline: 0,
        anchorLocal: Object.freeze({ x: row.x, y: row.y }),
        boundsLocal: b,
        fill: !!fill && alpha > 0,
        strokeWidthLocal: stroke && alpha > 0 ? strokeWidth : 0,
      }),
    );
    if (b.height === 0 || alpha === 0) continue;
    let batch = batches.at(-1);
    const half = stroke ? strokeWidth / 2 : 0,
      minX = b.x - half,
      maxX = b.x + b.width + half;
    if (
      !batch ||
      (minX < batch.maxX && maxX > batch.minX) ||
      batch.fill !== fill ||
      batch.stroke !== stroke ||
      batch.strokeWidth !== strokeWidth ||
      batch.opacity !== alpha ||
      batch.cursor !== style.cursor
    ) {
      batch = {
        path: new Path2D(),
        fill,
        stroke,
        strokeWidth,
        opacity: alpha,
        cursor: style.cursor,
        minX,
        maxX,
      };
      batches.push(batch);
    }
    batch.minX = Math.min(batch.minX, minX);
    batch.maxX = Math.max(batch.maxX, maxX);
    batch.path.rect(b.x, b.y, b.width, b.height);
  }
  inspection?.capture({ marks: marks!, xScale: xs, yScale: ys });
  return (
    <Group {...events}>
      {batches.map((batch, index) => (
        <Path
          key={index}
          pointerEvents={pointerEvents}
          style={{
            d: batch.path,
            fill: batch.fill,
            stroke: batch.stroke,
            strokeWidth: batch.strokeWidth,
            opacity: batch.opacity,
            cursor: batch.cursor,
          }}
        />
      ))}
    </Group>
  );
}

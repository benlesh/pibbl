import { Path, resolveSignalValue } from "@pibbl/core";
import type {
  FillStyle,
  PibblEventHandlers,
  PibblEventParticipationOptions,
  SignalValue,
  StrokeStyle,
} from "@pibbl/core";
import { useInternalValueMemoSlot, validateTexturePaint } from "@pibbl/core/internal";
import type { SignalStyle } from "@pibbl/core/internal";
import type { LineAccessor, LineSeriesProps, ScaleId } from "./types.js";
import { useNumericPosition } from "./series-position.js";
import { opacity, width } from "./paint.js";
import { finiteCoordinate, pointAccessor, pointData } from "./point-data.js";

/** Shared paint for one side of a baseline. See {@link BaselineSeries}. */
export interface BaselineSideStyle {
  /** Area fill for this side of the baseline. */
  readonly fill?: FillStyle;
  /** Line stroke for this side of the baseline. */
  readonly stroke?: StrokeStyle;
}

/** Shared presentation for a linear baseline series. See {@link BaselineSeries}. */
export interface BaselineSeriesStyle {
  /** Paint for y values greater than or equal to baseline. */
  readonly above?: BaselineSideStyle;
  /** Paint for y values less than baseline. */
  readonly below?: BaselineSideStyle;
  /** Opacity for both area fills; defaults to 0.2. */
  readonly fillOpacity?: number;
  /** Width for both line strokes; defaults to 2. */
  readonly strokeWidth?: number;
  /** Cursor while a painted series path owns targeting. */
  readonly cursor?: string;
}

/** A linear connected series split into independently painted regions at baseline crossings. See
 * {@link BaselineSeries}.
 */
export interface BaselineSeriesProps<D>
  extends PibblEventHandlers, PibblEventParticipationOptions {
  /** Application records or a signal of records; source order is retained. */
  readonly data: SignalValue<readonly D[]>;
  /** Property key or callback extracting horizontal coordinates. */
  readonly x: LineAccessor<D>;
  /** Property key or callback extracting vertical coordinates. */
  readonly y: LineAccessor<D>;
  /** Numeric or trading-time horizontal scale identity. */
  readonly xScale: ScaleId;
  /** Linear vertical scale identity. */
  readonly yScale: ScaleId;
  /** Finite data-space division between the above and below presentations. */
  readonly baseline: SignalValue<number>;
  /** Excludes a record before its accessors run. */
  readonly defined?: LineSeriesProps<D>["defined"];
  /** Optional committed original-record capture on the standard numeric inspection foundation. */
  readonly inspection?: import("../inspection/capture-types.js").NumericInspectionRef<D>;
  /** Shared above/below paint and interaction presentation. */
  readonly style?: SignalValue<SignalStyle<BaselineSeriesStyle>>;
}

interface Point<D> {
  readonly datum: D;
  readonly domainX: number;
  readonly domainY: number;
  readonly x: number;
  readonly y: number;
}

interface Piece {
  readonly side: "above" | "below";
  readonly fill: Path2D | undefined;
  readonly stroke: Path2D;
}

function fill(value: unknown, receiver: string): FillStyle {
  if (typeof value === "string" || value instanceof CanvasGradient || value instanceof CanvasPattern)
    return value;
  try {
    validateTexturePaint(value as never);
    return value as FillStyle;
  } catch {
    throw new TypeError(`${receiver}: invalid fill.`);
  }
}

function side(value: number, baseline: number): "above" | "below" {
  return value >= baseline ? "above" : "below";
}

/**
 * Draws a linear connected series with independently painted regions above and below a baseline.
 * Equal values belong to the above stroke; zero-area spans never receive a fill. Gaps split runs,
 * and optional inspection captures only original records.
 * @param props - Records, a numeric or trading-time x scale, linear price y scale, baseline, event props, and shared side paint.
 * @returns Filled and stroked Pibbl paths in source paint order.
 * @see {@link LineSeriesProps}
 */
export function BaselineSeries<D>({
  data: dataInput,
  x: xInput,
  y: yInput,
  xScale: xId,
  yScale: yId,
  baseline: baselineInput,
  defined,
  inspection,
  style: styleInput,
  ...eventProps
}: BaselineSeriesProps<D>) {
  const xScale = useNumericPosition(xId), yScale = useNumericPosition(yId);
  if (yScale.type !== "linear")
    throw new TypeError("BaselineSeries requires LinearScale for yScale.");
  const x = useInternalValueMemoSlot("vizBaselineXAccessor", () => pointAccessor(xInput), [xInput]);
  const y = useInternalValueMemoSlot("vizBaselineYAccessor", () => pointAccessor(yInput), [yInput]);
  const data = pointData(resolveSignalValue(dataInput), "BaselineSeries");
  const baseline = resolveSignalValue(baselineInput);
  if (typeof baseline !== "number" || !Number.isFinite(baseline))
    throw new RangeError("BaselineSeries baseline must be finite.");
  const baselineY = yScale.map(baseline);
  if (!Number.isFinite(baselineY)) throw new RangeError("BaselineSeries baseline must map to a finite coordinate.");
  const style = resolveSignalValue(styleInput) ?? {};
  if (style === null || typeof style !== "object" || Array.isArray(style))
    throw new TypeError("BaselineSeries style must be an object.");
  const above = resolveSignalValue(style.above) ?? {}, below = resolveSignalValue(style.below) ?? {};
  const aboveFill = fill(resolveSignalValue(above.fill) ?? "#087f8c", "BaselineSeries above");
  const belowFill = fill(resolveSignalValue(below.fill) ?? "#d9674c", "BaselineSeries below");
  const aboveStroke = resolveSignalValue(above.stroke) ?? "#087f8c";
  const belowStroke = resolveSignalValue(below.stroke) ?? "#d9674c";
  const fillOpacity = opacity(resolveSignalValue(style.fillOpacity) ?? 0.2, "BaselineSeries fill");
  const strokeWidth = width(resolveSignalValue(style.strokeWidth) ?? 2, "BaselineSeries stroke");
  const cursor = resolveSignalValue(style.cursor);
  if (cursor !== undefined && typeof cursor !== "string") throw new TypeError("BaselineSeries cursor must be a string.");

  const pieces: Piece[] = [];
  const captured: import("../inspection/capture-types.js").CapturedNumericObservation<D>[] | undefined = inspection ? [] : undefined;
  let previous: Point<D> | undefined;
  let run = 0;
  const breakRun = () => { previous = undefined; run++; };
  const segment = (first: Point<D>, second: Point<D>) => {
    const firstSide = side(first.domainY, baseline), secondSide = side(second.domainY, baseline);
    const points: { point: Point<D> | { x: number; y: number; domainY: number }; side: "above" | "below" }[] = [
      { point: first, side: firstSide },
    ];
    if (firstSide !== secondSide) {
      const firstDistance = Math.abs(first.domainY - baseline);
      const secondDistance = Math.abs(second.domainY - baseline);
      const amount = firstDistance > secondDistance
        ? 1 / (1 + secondDistance / firstDistance)
        : (firstDistance / secondDistance) / (1 + firstDistance / secondDistance);
      points.push({
        point: { x: first.x + (second.x - first.x) * amount, y: baselineY, domainY: baseline },
        side: firstSide,
      });
      points.push({
        point: { x: first.x + (second.x - first.x) * amount, y: baselineY, domainY: baseline },
        side: secondSide,
      });
    }
    points.push({ point: second, side: secondSide });
    for (let index = 1; index < points.length; index++) {
      const start = points[index - 1]!, end = points[index]!;
      const kind = start.side;
      const a = start.point, b = end.point;
      const stroke = new Path2D();
      stroke.moveTo(a.x, a.y);
      stroke.lineTo(b.x, b.y);
      if (a.y === baselineY && b.y === baselineY) {
        pieces.push({ side: kind, fill: undefined, stroke });
        continue;
      }
      const fill = new Path2D();
      fill.moveTo(a.x, baselineY);
      fill.lineTo(a.x, a.y);
      fill.lineTo(b.x, b.y);
      fill.lineTo(b.x, baselineY);
      fill.closePath();
      pieces.push({ side: kind, fill, stroke });
    }
  };
  for (let index = 0; index < data.length; index++) {
    const datum = data[index]!;
    if (defined && !defined(datum, index, data)) { breakRun(); continue; }
    const domainX = x(datum, index, data), domainY = y(datum, index, data);
    if (!finiteCoordinate(domainX) || !finiteCoordinate(domainY)) { breakRun(); continue; }
    const mappedX = xScale.map(domainX), mappedY = yScale.map(domainY);
    if (!Number.isFinite(mappedX) || !Number.isFinite(mappedY)) { breakRun(); continue; }
    const point: Point<D> = { datum, domainX, domainY, x: mappedX, y: mappedY };
    captured?.push(Object.freeze({ datum, sourceIndex: index, domainX: point.domainX, domainY: point.domainY, anchorLocal: Object.freeze({ x: point.x, y: point.y }), run }));
    if (previous) segment(previous, point);
    previous = point;
  }
  if (inspection) inspection.capture({ observations: captured!, xScale, yScale });
  return (
    <>
      {pieces.flatMap((piece, index) => {
        const fill = piece.side === "above" ? aboveFill : belowFill;
        const stroke = piece.side === "above" ? aboveStroke : belowStroke;
        return [
          ...(piece.fill ? [<Path key={`${index}:fill`} {...eventProps} style={{ d: piece.fill, fill, opacity: fillOpacity, cursor }} />] : []),
          <Path key={`${index}:stroke`} {...eventProps} style={{ d: piece.stroke, stroke, strokeWidth, cursor }} />,
        ];
      })}
    </>
  );
}

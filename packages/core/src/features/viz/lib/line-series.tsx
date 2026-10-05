import { Path, resolveSignalValue } from "@pibbl/core";
import { useInternalValueMemoSlot } from "@pibbl/core/internal";
import type { LineAccessor, LineCoordinate, LineSeriesProps } from "./types.js";
import { useContinuousScale } from "./use-continuous-scale.js";
import { width, opacity } from "./paint.js";
function accessor<D>(
  input: LineAccessor<D>,
): (datum: D, index: number, data: readonly D[]) => LineCoordinate {
  return typeof input === "function"
    ? input
    : (datum) => datum[input] as LineCoordinate;
}
/**
 * Draws a scaled line through defined data values, leaving gaps for undefined values.
 *
 * @param props - Data, coordinate accessors, scales, and line styling. See {@link LineSeriesProps}
 * .
 * @returns Pibbl nodes drawing the data as a line series.
 *
 * @see {@link LineSeriesProps}
 */
export function LineSeries<D>({
  data: dataInput,
  x: xInput,
  y: yInput,
  xScale: xId,
  yScale: yId,
  defined,
  curve,
  style: styleInput,
  ...eventProps
}: LineSeriesProps<D>) {
  const xScale = useContinuousScale(xId).get();
  const yScale = useContinuousScale(yId).get();
  const x = useInternalValueMemoSlot("vizXAccessor", () => accessor(xInput), [
    xInput,
  ]);
  const y = useInternalValueMemoSlot("vizYAccessor", () => accessor(yInput), [
    yInput,
  ]);
  if (curve !== undefined && curve !== "linear")
    throw new TypeError('LineSeries supports curve="linear" only.');
  const data = resolveSignalValue(dataInput);
  if (!Array.isArray(data))
    throw new TypeError(
      "LineSeries data must be an array or a signal containing an array.",
    );
  const style = resolveSignalValue(styleInput) ?? {};
  const stroke = resolveSignalValue(style.stroke) ?? "#2563eb";
  const strokeWidth = width(
    resolveSignalValue(style.strokeWidth) ?? 2,
    "LineSeries",
  );
  const alpha = opacity(resolveSignalValue(style.opacity) ?? 1, "LineSeries");
  const cursor = resolveSignalValue(style.cursor);
  const lineInteractionWidth = width(
    resolveSignalValue(style.lineInteractionWidth) ?? strokeWidth,
    "LineSeries",
  );
  const path = new Path2D();
  let previous: readonly [number, number] | undefined;
  let inRun = false;
  for (let i = 0; i < data.length; i++) {
    const datum = data[i];
    if (defined && !defined(datum, i, data)) {
      previous = undefined;
      inRun = false;
      continue;
    }
    const xv = x(datum, i, data),
      yv = y(datum, i, data);
    if (
      typeof xv !== "number" ||
      typeof yv !== "number" ||
      !Number.isFinite(xv) ||
      !Number.isFinite(yv)
    ) {
      previous = undefined;
      inRun = false;
      continue;
    }
    const point = [xScale.map(xv), yScale.map(yv)] as const;
    if (previous) {
      if (!inRun) path.moveTo(previous[0], previous[1]);
      path.lineTo(point[0], point[1]);
      inRun = true;
    }
    previous = point;
  }
  return (
    <Path
      {...eventProps}
      style={{
        d: path,
        stroke,
        strokeWidth,
        opacity: alpha,
        cursor,
        lineInteractionWidth,
      }}
    />
  );
}

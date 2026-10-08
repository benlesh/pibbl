import { Path, resolveSignalValue } from "@pibbl/core";
import { useInternalValueMemoSlot } from "@pibbl/core/internal";
import type { LineSeriesProps } from "./types.js";
import {
  appendCurveForward,
  curveGeometry,
  resolveSeriesCurve,
} from "./curve-definition.js";
import {
  useSeriesPosition,
  seriesAccessor,
  mapSeriesPosition,
} from "./series-position.js";
import { width, opacity } from "./paint.js";
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
  inspection,
  curve,
  style: styleInput,
  ...eventProps
}: LineSeriesProps<D>) {
  const xScale = useSeriesPosition(xId);
  const yScale = useSeriesPosition(yId);
  const x = useInternalValueMemoSlot(
    "vizXAccessor",
    () => seriesAccessor(xInput),
    [xInput],
  );
  const y = useInternalValueMemoSlot(
    "vizYAccessor",
    () => seriesAccessor(yInput),
    [yInput],
  );
  const curveDefinition = resolveSeriesCurve(curve);
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
  const captured: import("../inspection/capture-types.js").CapturedNumericObservation<D>[] | undefined = inspection ? [] : undefined;
  let runId = 0;
  if (inspection && (xScale.type === "point" || yScale.type === "point")) throw new TypeError("Numeric line inspection requires numeric continuous scales.");
  let run: (readonly [number, number])[] = [];
  const flushRun = () => {
    if (run.length >= 2) {
      const geometry = curveGeometry(curveDefinition, run);
      path.moveTo(geometry.start[0], geometry.start[1]);
      appendCurveForward(path, geometry);
    }
    run = [];
  };
  for (let i = 0; i < data.length; i++) {
    const datum = data[i];
    if (defined && !defined(datum, i, data)) {
      flushRun();
      runId++;
      continue;
    }
    const xv = x(datum, i, data),
      yv = y(datum, i, data);
    const px = mapSeriesPosition(xScale, xv),
      py = mapSeriesPosition(yScale, yv);
    if (px === undefined || py === undefined) {
      flushRun();
      runId++;
      continue;
    }
    captured?.push(Object.freeze({datum,sourceIndex:i,domainX:xv as number,domainY:yv as number,anchorLocal:Object.freeze({x:px,y:py}),run:runId}));
    const point = [px, py] as const;
    run.push(point);
  }
  flushRun();
  if (inspection && xScale.type !== "point" && yScale.type !== "point") inspection.capture({observations:captured!,xScale,yScale});
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

import {
  closestPoint,
  closestX,
  defineSeries,
  interpolateX,
  linearInterpolation,
  type ClosestPointHit,
  type ClosestPointOptions,
  type ClosestXHit,
  type ClosestXOptions,
  type HoverHit,
  type HoverInterpolation,
  type HoverPoint,
  type HoverQuery,
  type HoverQueryContext,
  type HoverSample,
  type HoverSeries,
  type HoverSeriesMap,
  type InterpolateXOptions,
  type ResolvedLinearScale,
} from "@crc/core/viz";

type Reading = { time: number; value: number };
const readings: readonly Reading[] = [
  { time: 0, value: 2 },
  { time: 1, value: 5 },
  { time: 2, value: 3 },
];
const series: HoverSeries<Reading> = defineSeries({
  data: readings,
  x: "time",
  y: "value",
});
const seriesMap = { measurements: series } satisfies HoverSeriesMap;
const position: HoverPoint = { x: 100, y: 60 };
const pointOptions: ClosestPointOptions<typeof seriesMap> = {
  series: seriesMap,
  position,
  xScale: "time",
  yScale: "value",
};
const pointQuery: HoverQuery<ClosestPointHit<typeof seriesMap>> =
  closestPoint(pointOptions);
const xOptions: ClosestXOptions<Reading> = {
  series,
  x: 0.5,
  xScale: "time",
  yScale: "value",
};
const xQuery: HoverQuery<ClosestXHit<Reading>> = closestX(xOptions);
const interpolation: HoverInterpolation = linearInterpolation();
const sampleOptions: InterpolateXOptions<Reading> = {
  ...xOptions,
  interpolation,
  maxGap: 1,
};
const sampleQuery: HoverQuery<HoverSample<Reading>> =
  interpolateX(sampleOptions);
const scale: ResolvedLinearScale = {
  type: "linear",
  domain: [0, 10],
  range: [0, 200],
  frame: { x: 0, y: 0, width: 200, height: 200 },
  map: (value) => value * 20,
  invert: (pixel) => pixel / 20,
  ticks: () => [0, 5, 10],
};
const context: HoverQueryContext = { scale: () => scale };
const hit: HoverHit<Reading> | undefined = pointQuery(context);
const nearest: ClosestXHit<Reading> | undefined = xQuery(context);
const sample: HoverSample<Reading> | undefined = sampleQuery(context);
console.log(hit?.datum.value, nearest?.delta, sample?.y);

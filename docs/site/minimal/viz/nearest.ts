import {
  nearestDomainValue,
  nearestPoint,
  type NearestPoint,
  type NearestPointOptions,
  type ResolvedLinearScale,
} from "@crc/core/viz";

const horizontal: ResolvedLinearScale = {
  type: "linear",
  domain: [0, 10],
  range: [0, 300],
  frame: { x: 0, y: 0, width: 300, height: 200 },
  map: (value) => value * 30,
  invert: (pixel) => pixel / 30,
  ticks: () => [0, 5, 10],
};
const vertical: ResolvedLinearScale = {
  ...horizontal,
  range: [200, 0],
  map: (value) => 200 - value * 20,
  invert: (pixel) => (200 - pixel) / 20,
};
const readings = [
  { time: 1, value: 3 },
  { time: 5, value: 7 },
];
const options: NearestPointOptions<(typeof readings)[number]> = {
  x: "time",
  y: "value",
  xScale: horizontal,
  yScale: vertical,
  maxDistance: 30,
};
const hit: NearestPoint<(typeof readings)[number]> | undefined = nearestPoint(
  readings,
  { x: 150, y: 60 },
  options,
);
const time = nearestDomainValue(
  readings.map((row) => row.time),
  140,
  horizontal,
);
console.log(hit?.datum.value, time);

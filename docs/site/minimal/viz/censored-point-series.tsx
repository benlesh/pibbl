import { createElement, pibbl } from "@pibbl/core";
import {
  CensoredPointSeries,
  LinearScale,
  type CensoredPointSeriesProps,
  type CensoredPointSeriesStyle,
  type CensoringStatus,
  type CensoringAccessor,
} from "@pibbl/core/viz";

const samples = [
  { hour: 1, concentration: 0.5, reporting: "below" as const },
  { hour: 2, concentration: 1.4, reporting: "observed" as const },
  { hour: 4, concentration: 80, reporting: "above" as const },
];
const observed: CensoringStatus = "observed";
const censoring: CensoringAccessor<(typeof samples)[number]> = (row) =>
  row.reporting ?? observed;
const style: CensoredPointSeriesStyle = { radius: 4, fill: "#087f8c" };
const props: CensoredPointSeriesProps<(typeof samples)[number]> = {
  data: samples,
  x: "hour",
  y: "concentration",
  censoring,
  style,
  xScale: "hour",
  yScale: "concentration",
};

export const minimalCensoredPointSeries = createElement(LinearScale, {
  id: "hour",
  domain: [0, 6],
  range: [0, 360],
  style: { width: 360, height: 220 },
  children: createElement(LinearScale, {
    id: "concentration",
    domain: [0, 100],
    range: [220, 0],
    children: createElement(CensoredPointSeries, props),
  }),
});

const canvas = document.createElement("canvas");
canvas.width = 360;
canvas.height = 220;
document.body.append(canvas);
const app = pibbl(canvas, minimalCensoredPointSeries);
window.addEventListener("pagehide", () => app.dispose(), { once: true });

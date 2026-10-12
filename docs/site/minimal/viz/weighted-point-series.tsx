import { pibbl } from "@pibbl/core";
import {
  LinearScale,
  WeightedPointSeries,
  type WeightedPointSeriesProps,
  type WeightedPointSeriesStyle,
  type WeightAccessor,
} from "@pibbl/core/viz";

const observations = [
  { concentration: 0.3, inhibition: 18, precision: 16 },
  { concentration: 1, inhibition: 49, precision: 64 },
  { concentration: 3, inhibition: 78, precision: 100 },
];
const weight: WeightAccessor<(typeof observations)[number]> = "precision";
const style: WeightedPointSeriesStyle = {
  fill: "#087f8c",
  stroke: "#04575b",
  strokeWidth: 1,
};
const points: WeightedPointSeriesProps<(typeof observations)[number]> = {
  data: observations,
  x: "concentration",
  y: "inhibition",
  weight,
  xScale: "concentration",
  yScale: "inhibition",
  weightDomain: [0, 100],
  radiusRange: [0, 10],
  style,
};
const canvas = document.createElement("canvas");
canvas.width = 400;
canvas.height = 300;
document.body.append(canvas);
const app = pibbl(
  canvas,
  <LinearScale id="concentration" domain={[0, 4]} range={[40, 360]}>
    <LinearScale id="inhibition" domain={[0, 100]} range={[260, 30]}>
      <WeightedPointSeries {...points} />
    </LinearScale>
  </LinearScale>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });

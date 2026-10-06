import { Group, Text, pibbl } from "@pibbl/core";
import {
  IntervalBandSeries,
  LinearScale,
  type IntervalBandSeriesProps,
} from "@pibbl/core/viz";
// NOAA/NCEI GHCN-Daily USW00094728, Jan 1–4 2020, metric TMIN/TMAX.
// https://www.ncei.noaa.gov/access/services/data/v1?dataset=daily-summaries&stations=USW00094728&startDate=2020-01-01&endDate=2020-01-04&format=json&units=metric
// Daily observed extremes, not uncertainty; frozen 2026-10-06 snapshot.
const data = [
  [1.1, 5],
  [0.6, 9.4],
  [6.7, 9.4],
  [5, 10.6],
].map(([lower, upper], day) => ({ day, lower, upper }));
const band: IntervalBandSeriesProps<(typeof data)[number]> = {
  data,
  x: "day",
  lower: "lower",
  upper: "upper",
  xScale: "x",
  yScale: "y",
  style: { fill: "#087f8c", opacity: 0.3 },
};
const canvas = document.createElement("canvas");
canvas.width = 360;
canvas.height = 240;
document.body.append(canvas);
const app = pibbl(
  canvas,
  <>
    <Text style={{ left: 12, top: 12, font: "14px sans-serif" }}>
      Daily observed min–max · °C
    </Text>
    <Group style={{ translateX: 20, translateY: 45 }}>
      <LinearScale id="x" domain={[0, 3]} range={[0, 320]}>
        <LinearScale id="y" domain={[0, 12]} range={[150, 0]}>
          <IntervalBandSeries {...band} />
        </LinearScale>
      </LinearScale>
    </Group>
    <Text style={{ left: 12, top: 212, font: "10px sans-serif" }}>
      NOAA/NCEI · Central Park · Jan 1–4 2020
    </Text>
  </>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });

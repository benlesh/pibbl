import { Group, Text, pibbl } from "@pibbl/core";
import {
  Axis,
  LineSeries,
  PointSeries,
  PointScale,
  LinearScale,
  type SeriesCoordinate,
  type SeriesAccessor,
} from "@pibbl/core/viz";
// NOAA / Scripps Mauna Loa monthly CO2, ppm, Jan–Jun 1980.
// https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv
const data = [337.9, 338.34, 340.07, 340.93, 341.45, 341.36].map((ppm, i) => ({
  month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"][i],
  ppm,
}));
const month: SeriesAccessor<(typeof data)[number]> = (row): SeriesCoordinate =>
  row.month;
const canvas = document.createElement("canvas");
canvas.width = 360;
canvas.height = 240;
document.body.append(canvas);
const app = pibbl(
  canvas,
  <Group style={{ translateX: 25, translateY: 20 }}>
    <PointScale id="month" domain={data.map((d) => d.month)} range={[0, 300]}>
      <LinearScale id="ppm" domain={[337, 342]} range={[160, 0]}>
        <LineSeries data={data} x={month} y="ppm" xScale="month" yScale="ppm" />
        <PointSeries
          data={data}
          x={month}
          y="ppm"
          xScale="month"
          yScale="ppm"
        />
        <Axis
          scale="month"
          position="bottom"
          tickValues={data.map((d) => d.month)}
        />
      </LinearScale>
    </PointScale>
    <Text style={{ top: 205, font: "10px sans-serif" }}>
      NOAA / Scripps · Jan–Jun 1980 · ppm
    </Text>
  </Group>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });

import { Group, Text, pibbl } from "@pibbl/core";
import { LineSeries, LinearScale, monotoneX } from "@pibbl/core/viz";
// NOAA / Scripps Mauna Loa monthly CO2, ppm, Jan–Jun 1980.
// https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv
const data = [337.9, 338.34, 340.07, 340.93, 341.45, 341.36].map((ppm, i) => ({
  month: i,
  ppm,
}));
const canvas = document.createElement("canvas");
canvas.width = 360;
canvas.height = 240;
document.body.append(canvas);
const app = pibbl(
  canvas,
  <Group style={{ translateX: 20, translateY: 20 }}>
    <LinearScale id="x" domain={[0, 5]} range={[0, 320]}>
      <LinearScale id="y" domain={[337, 342]} range={[170, 0]}>
        <LineSeries
          data={data}
          x="month"
          y="ppm"
          xScale="x"
          yScale="y"
          curve={monotoneX()}
        />
      </LinearScale>
    </LinearScale>
    <Text style={{ top: 190, font: "10px sans-serif" }}>
      NOAA / Scripps · Jan–Jun 1980 · ppm
    </Text>
    <Text style={{ top: 205, font: "10px sans-serif" }}>
      Smooth interpolation is not another measurement.
    </Text>
  </Group>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });

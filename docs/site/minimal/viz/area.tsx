import { Group, Text, pibbl } from "@pibbl/core";
import {
  AreaSeries,
  LinearScale,
  type AreaSeriesProps,
  type AreaSeriesStyle,
} from "@pibbl/core/viz";
// NOAA GML / Scripps Jan–Jun 1980 Mauna Loa CO2 monthly means (ppm).
// https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv
// Reused repository snapshot; March deliberately omitted to demonstrate a gap.
const data = [337.9, 338.34, null, 340.93, 341.45, 341.36].map(
  (ppm, month) => ({ month, ppm }),
);
const style: AreaSeriesStyle = { fill: "#087f8c", opacity: 0.3 };
const area: AreaSeriesProps<(typeof data)[number]> = {
  data,
  x: "month",
  y: "ppm",
  xScale: "x",
  yScale: "y",
  baseline: 330,
  style,
};
const canvas = document.createElement("canvas");
canvas.width = 360;
canvas.height = 240;
document.body.append(canvas);
const app = pibbl(
  canvas,
  <>
    <Text style={{ left: 12, top: 12, font: "13px sans-serif" }}>
      CO₂ above 330 ppm · March omitted
    </Text>
    <Group style={{ translateX: 20, translateY: 45 }}>
      <LinearScale id="x" domain={[0, 5]} range={[0, 320]}>
        <LinearScale id="y" domain={[330, 345]} range={[150, 0]}>
          <AreaSeries {...area} />
        </LinearScale>
      </LinearScale>
    </Group>
    <Text style={{ left: 12, top: 212, font: "10px sans-serif" }}>
      NOAA / Scripps · Jan–Jun 1980 · not emissions
    </Text>
  </>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });

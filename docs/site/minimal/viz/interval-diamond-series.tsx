import { pibbl, signal } from "@pibbl/core";
import {
  IntervalDiamondSeries,
  LinearScale,
  PointScale,
  type IntervalDiamondSeriesProps,
  type IntervalDiamondSeriesStyle,
} from "@pibbl/core/viz";
const rows = [
  { analysis: "Summary", estimate: 0.72, lower: 0.58, upper: 0.89 },
];
const style: IntervalDiamondSeriesStyle = { height: 12, fill: "#087f8c" };
const props: IntervalDiamondSeriesProps<(typeof rows)[number]> = {
  data: signal(rows),
  category: "analysis",
  estimate: "estimate",
  lower: "lower",
  upper: "upper",
  categoryScale: "analyses",
  valueScale: "effect",
  style,
};
const canvas = document.createElement("canvas");
canvas.width = 360;
canvas.height = 120;
document.body.append(canvas);
const app = pibbl(
  canvas,
  <PointScale id="analyses" domain={["Summary"]} range={[60, 60]}>
    <LinearScale id="effect" domain={[0, 1.5]} range={[20, 340]}>
      <IntervalDiamondSeries {...props} />
    </LinearScale>
  </PointScale>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });

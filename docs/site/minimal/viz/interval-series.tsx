import { Group, pibbl, signal } from "@pibbl/core";
import {
  BarScale,
  LinearScale,
  HorizontalIntervalSeries,
  VerticalIntervalSeries,
  type HorizontalIntervalSeriesProps,
  type VerticalIntervalSeriesProps,
  type IntervalSeriesProps,
  type IntervalSeriesStyle,
} from "@pibbl/core/viz";

const rows = [{ study: "A", estimate: 0.8, lower: 0.5, upper: 1.1 }];
const style: IntervalSeriesStyle = { radius: 4, capSize: 8, stroke: "#087f8c" };
const shared: IntervalSeriesProps<(typeof rows)[number]> = {
  data: signal(rows),
  category: "study",
  estimate: "estimate",
  lower: "lower",
  upper: "upper",
  categoryScale: "study",
  valueScale: "effect",
  style,
};
const horizontal: HorizontalIntervalSeriesProps<(typeof rows)[number]> = shared;
const vertical: VerticalIntervalSeriesProps<(typeof rows)[number]> = shared;
const canvas = document.createElement("canvas");
canvas.width = 400;
canvas.height = 300;
document.body.append(canvas);
const app = pibbl(
  canvas,
  <Group>
    <BarScale id="study" domain={["A"]} range={[30, 90]}>
      <LinearScale id="effect" domain={[0, 1.5]} range={[20, 300]}>
        <HorizontalIntervalSeries {...horizontal} />
      </LinearScale>
    </BarScale>
    <BarScale id="study" domain={["A"]} range={[30, 90]}>
      <LinearScale id="effect" domain={[0, 1.5]} range={[270, 140]}>
        <VerticalIntervalSeries {...vertical} />
      </LinearScale>
    </BarScale>
  </Group>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });

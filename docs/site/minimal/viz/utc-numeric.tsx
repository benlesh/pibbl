import { pibbl, Overlay, Text } from "@pibbl/core";
import {
  utcTickLabels,
  type UTCTickLabelOptions,
  UTCScale,
  useUTCScale,
  Axis,
} from "@pibbl/core/viz";
const start = Date.UTC(2025, 11, 30),
  end = Date.UTC(2026, 0, 2);
function Dates() {
  const scale = useUTCScale("date").get();
  const ticks = scale.ticks(4);
  const options: UTCTickLabelOptions = { locale: "en-US" };
  const labels = utcTickLabels(ticks, options);
  return (
    <>
      <Axis
        scale="date"
        position="bottom"
        tickValues={ticks}
        tickFormat={(value) => labels[ticks.indexOf(Number(value))]}
      />
      <Text style={{ top: -5, font: "14px sans-serif", fill: "#183153" }}>
        {"Across New Year · UTC calendar labels"}
      </Text>
    </>
  );
}
const canvas = document.createElement("canvas");
canvas.width = 640;
canvas.height = 140;
document.body.append(canvas);
const app = pibbl(
  canvas,
  <Overlay style={{ left: 35, top: 15, width: 570, height: 70 }}>
    <UTCScale
      id="date"
      domain={[start, end]}
      range="width"
      style={{ width: 570, height: 70 }}
    >
      <Dates />
    </UTCScale>
  </Overlay>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });

import { pibbl, Overlay, Text } from "@pibbl/core";
import {
  UTCScale,
  useUTCScale,
  Axis,
  linearTicks,
  niceLinearDomain,
  formatNumber,
  type LinearTickOptions,
  type NumberFormatOptions,
} from "@pibbl/core/viz";
const tickOptions: LinearTickOptions = { count: 5 };
const formatOptions: NumberFormatOptions = {
  maximumFractionDigits: 1,
  suffix: " °C",
};
const domain = niceLinearDomain([3.7, 27.4], tickOptions);
const output = document.createElement("p");
output.textContent = linearTicks(domain, tickOptions)
  .map((value) => formatNumber(value, formatOptions))
  .join(", ");
document.body.append(output);
const start = Date.UTC(2026, 0, 1),
  end = Date.UTC(2026, 0, 8);
function Dates() {
  const scale = useUTCScale("date").get();
  return (
    <>
      <Axis
        scale="date"
        position="bottom"
        tickCount={4}
        tickFormat={(value) => new Date(Number(value)).toISOString().slice(5, 10)}
      />
      <Text
        style={{ top: 20, font: "14px sans-serif", fill: "#183153" }}
      >{`Start position: ${scale.map(start)}`}</Text>
    </>
  );
}
const canvas = document.createElement("canvas");
canvas.width = 420;
canvas.height = 140;
document.body.append(canvas);
const app = pibbl(
  canvas,
  <Overlay style={{ left: 35, top: 15, width: 340, height: 70 }}>
    <UTCScale
      id="date"
      domain={[start, end]}
      range="width"
      style={{ width: 340, height: 70 }}
    >
      <Dates />
    </UTCScale>
  </Overlay>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });

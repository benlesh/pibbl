import { Group, Overlay, Rectangle, Text, pibbl, useLayoutBox, type PibblController } from "@pibbl/core";
import { Axis, LinearScale, LineSeries, linearTicks, niceLinearDomain, formatNumber, useLinearScale } from "@pibbl/core/viz";
// NOAA GML / Scripps, Mauna Loa monthly CO2, Jan–Jun 1980, ppm.
// https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv
// Repository snapshot retrieved 2026-09-28. No runtime requests.
const data = [337.9, 338.34, 340.07, 340.93, 341.45, 341.36].map((ppm, month) => ({ month, ppm }));
const domain = niceLinearDomain([337.9, 341.45]);
function Axes() {
  const y = useLinearScale("ppm").get();
  return <>
    <Axis scale="ppm" position="left" tickValues={linearTicks(y.domain, { count: Math.max(2, Math.min(8, Math.floor(y.frame.height / 42))) })}
      labelOverlap="skip" tickFormat={v => formatNumber(Number(v), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} />
    <Axis scale="month" position="bottom" tickValues={[0, 1, 2, 3, 4, 5]} labelOverlap="skip" tickFormat={v => ["Jan", "Feb", "Mar", "Apr", "May", "Jun"][Number(v)]} />
  </>;
}
function Scene() {
  const { width, height } = useLayoutBox();
  return <>
    <Rectangle style={{ width, height, fill: "#f7faf9" }} />
    <Text style={{ left: 20, top: 20, font: "600 23px sans-serif", fill: "#172f3d", when: [{ query: { maxWidth: 380 }, style: { font: "600 19px sans-serif" } }, { query: { maxHeight: 280 }, style: { top: 12 } }] }}>Readable numeric axes</Text>
    <Text style={{ left: 20, top: 50, font: "12px sans-serif", fill: "#617783", when: [{ query: { maxHeight: 280 }, style: { top: 38 } }] }}>Mauna Loa CO₂ · ppm · January–June 1980</Text>
    <Group style={{ translateX: 58, translateY: 88, when: [{ query: { maxHeight: 280 }, style: { translateY: 70 } }] }}>
      <Overlay style={{ width: Math.max(1, width - 88), height: Math.max(1, height - 154), when: [{ query: { maxHeight: 280 }, style: { height: Math.max(1, height - 136) } }] }}>
        <LinearScale id="month" domain={[0, 5]} range="width" style={{ width: "100%", height: "100%" }}>
          <LinearScale id="ppm" domain={domain} range="height" reverse>
            <Axes />
            <LineSeries data={data} x="month" y="ppm" xScale="month" yScale="ppm" style={{ stroke: "#087f8c", strokeWidth: 2.5 }} />
          </LinearScale>
        </LinearScale>
      </Overlay>
    </Group>
    <Text style={{ left: 20, top: height - 22, font: "11px sans-serif", fill: "#617783" }}>Source: NOAA GML / Scripps · monthly means</Text>
  </>;
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <Scene />, { viewport: "responsive" });
}

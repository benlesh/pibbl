import { Overlay, Group, Text, pibbl, useLayoutBox, type PibblController } from "@pibbl/core";
import { Axis, LineSeries, extent, niceUTCDomain, useUTCScale, UTCScale, LinearScale } from "@pibbl/core/viz";

// NOAA GML / Scripps, Mauna Loa monthly CO2 (ppm), Jan–Jun 1980.
// https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv
// Reused from the repository's 2026-09-28 snapshot; no runtime requests.
const data = [337.9, 338.34, 340.07, 340.93, 341.45, 341.36].map((ppm, month) => ({
  time: Date.UTC(1980, month, 1), ppm,
}));
const observed = extent(data, row => row.time)!;
const domain = niceUTCDomain(observed, { count: 4 });
const monthName = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

function Readout() {
  const utc = useUTCScale("date").get();
  const numeric = useUTCScale("date").get();
  const middle = numeric.invert((numeric.range[0] + numeric.range[1]) / 2);
  return <Text pointerEvents="none" style={{ left: 0, top: -32, textBaseline: "alphabetic", font: "12px monospace", fill: "#64748b" }}>
    {`Midpoint · ${utc.formatTick(middle).slice(0, 10)} UTC`}
  </Text>;
}
function Scene() {
  const { width, height } = useLayoutBox();
  return <>
    <Text style={{ left: 24, top: 32, textBaseline: "alphabetic", font: "600 22px sans-serif", fill: "#182a38" }}>A real calendar axis</Text>
    <Text style={{ left: 24, top: 57, textBaseline: "alphabetic", font: "13px sans-serif", fill: "#64748b" }}>Mauna Loa CO₂ · ppm · Jan–Jun 1980</Text>
    <Group style={{ translateX: 56, translateY: 118 }}>
      <Overlay style={{ width: Math.max(160, width - 94), height: Math.max(100, height - 180) }}>
        <UTCScale style={{ width: Math.max(160, width - 94), height: Math.max(100, height - 180) }} id="date"  domain={domain} range="width">
          <LinearScale id="ppm"  domain={[337, 342]} range="height" reverse>
            <Readout />
            <Axis scale="date" position="bottom" tickCount={4} tickFormat={value => monthName.format(Number(value))} />
            <Axis scale="ppm" position="left" tickValues={[337, 339, 342]} />
            <LineSeries data={data} x="time" y="ppm" xScale="date" yScale="ppm" style={{ stroke: "#087f8c", strokeWidth: 3 }} />
          </LinearScale>
        </UTCScale>
      </Overlay>
    </Group>
    <Text style={{ left: 24, top: height - 15, textBaseline: "alphabetic", font: "11px sans-serif", fill: "#64748b" }}>Source: NOAA GML / Scripps · static snapshot</Text>
  </>;
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <Scene />, { viewport: "responsive" });
}

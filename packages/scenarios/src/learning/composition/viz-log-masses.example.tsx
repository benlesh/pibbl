import { FocusManagement, Circle, Group, Line, Overlay, Rectangle, Text, pibbl, useLayoutBox, useSignal, type PibblController, type WritableSignal } from "@pibbl/core";
import { Axis, LinearScale, LogScale, useLinearScale, useLogScale, formatNumber, nearestPoint, PointSeries } from "@pibbl/core/viz";
// NASA/NSSDCA, Planetary Fact Sheet — Metric, Dr. David R. Williams.
// https://nssdc.gsfc.nasa.gov/planetary/factsheet/
// Page dated 18 March 2025; snapshot checked 2026-10-05. Mass unit: 10^24 kg.
// Published precision retained. Includes Earth's Moon and dwarf planet Pluto.
// These are body masses, not masses of their satellite systems. No runtime fetch.
const data = [
  { name: "Mercury", mass: 0.330 }, { name: "Venus", mass: 4.87 },
  { name: "Earth", mass: 5.97 }, { name: "Moon", mass: 0.073 },
  { name: "Mars", mass: 0.642 }, { name: "Jupiter", mass: 1898 },
  { name: "Saturn", mass: 568 }, { name: "Uranus", mass: 86.8 },
  { name: "Neptune", mass: 102 }, { name: "Pluto", mass: 0.0130 },
].map((row, index) => ({ ...row, index }));
const ink = "#172f3d", muted = "#617783", teal = "#087f8c";
function Plot({ earthUnits, selected, left, top }: { earthUnits: boolean; selected: WritableSignal<number>; left: number; top: number }) {
  const x = useLogScale("mass").get(), y = useLinearScale("body").get();
  const rows = data.map(row => ({ ...row, value: row.mass / (earthUnits ? 5.97 : 1) }));
  const ticks = x.ticks(8);
  const picked = rows[selected.get()];
  return <>
    {ticks.map(value => <Line key={value} pointerEvents="none" style={{ coords: [[x.map(value), 0], [x.map(value), y.frame.height]], stroke: "#dde7e8", strokeWidth: 1 }} />)}
    <Axis scale="mass" position="bottom" tickValues={ticks} labelOverlap="skip" labelGap={10}
      tickFormat={value => formatNumber(Number(value), { maximumFractionDigits: 3 })} style={{ stroke: "#beced3", fill: muted, font: "11px sans-serif" }} />
    <Axis scale="body" position="left" tickValues={data.map(row => row.index)} tickFormat={value => data[Number(value)].name}
      labelOverlap="allow" style={{ strokeWidth: 0, fill: muted, font: y.frame.height < 140 ? "11px sans-serif" : "12px sans-serif" }} />
    <PointSeries data={rows} x="value" y="index" xScale="mass" yScale="body" pointerEvents="none" style={{ radius: 4, fill: "#7da5aa" }} />
    <Circle pointerEvents="none" style={{ cx: x.map(picked.value), cy: y.map(picked.index), radius: 6, fill: teal, stroke: ink, strokeWidth: 1.5 }} />
    <Rectangle keyboardFocusable onPointerDown={event => {
      const hit = nearestPoint(rows, { x: event.x - left, y: event.y - top }, { x: "value", y: "index", xScale: x, yScale: y });
      if (hit) selected.set(hit.index);
    }} onKeyDown={event => {
      if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        selected.update(index => event.key === "Home" ? 0 : event.key === "End" ? data.length - 1 : Math.max(0, Math.min(data.length - 1, index + (["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1))));
      }
    }} style={{ width: x.frame.width, height: y.frame.height, fill: "rgba(0,0,0,0)", cursor: "crosshair" }} />
  </>;
}
function Scene() {
  const { width, height } = useLayoutBox();
  const selected = useSignal(5), earthUnits = useSignal(false);
  const narrow = { maxWidth: 600 }, shallow = { maxHeight: 400 };
  const left = width <= 600 ? 76 : 112, top = height <= 400 ? 100 : 238;
  const row = data[selected.get()], value = row.mass / (earthUnits.get() ? 5.97 : 1);
  const unit = earthUnits.get() ? "Earth masses" : "× 10²⁴ kg";
  return <>
    <Rectangle style={{ width, height, fill: "#f7faf9" }} />
    <Text style={{ left: 24, top: 22, font: "700 11px sans-serif", fill: teal, when: [{ query: shallow, style: { opacity: 0 } }] }}>THE SOLAR SYSTEM · BY MASS</Text>
    <Text style={{ left: 24, top: 50, font: "600 36px sans-serif", fill: ink, when: [{ query: narrow, style: { font: "600 25px sans-serif" } }, { query: shallow, style: { opacity: 0 } }] }}>Worlds apart.</Text>
    <Text style={{ left: 24, top: 99, font: "14px sans-serif", fill: muted, when: [{ query: narrow, style: { font: "12px sans-serif" } }, { query: shallow, style: { opacity: 0 } }] }}>Each equal step is a tenfold increase in mass.</Text>
    <Group style={{ translateX: 24, translateY: 132, when: [{ query: shallow, style: { translateY: 12 } }] }}>
      <Rectangle keyboardFocusable onClick={() => earthUnits.update(v => !v)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); earthUnits.update(v => !v); } }}
        style={{ width: 174, height: 44, fill: ink, cornerRadius: 6, cursor: "pointer" }} />
      <Text pointerEvents="none" style={{ left: 87, top: 22, font: "600 12px sans-serif", fill: "white", textAlign: "center", textBaseline: "middle" }}>{earthUnits.get() ? "Earth = 1 · reset" : "Compare to Earth"}</Text>
    </Group>
    <Text style={{ left: 24, top: 190, font: "600 16px sans-serif", fill: ink, when: [{ query: narrow, style: { font: "600 13px sans-serif" } }, { query: shallow, style: { top: 65, font: "600 13px sans-serif" } }] }}>{`${row.name} · ${formatNumber(value, { maximumFractionDigits: 3 })} ${unit}`}</Text>
    <Text style={{ left: 24, top: 215, font: "11px sans-serif", fill: muted, when: [{ query: shallow, style: { top: 84, font: "10px sans-serif" } }] }}>Tap to inspect · Tab then ↑ ↓ · logarithmic axis</Text>
    <Group style={{ translateX: left, translateY: 238, when: [{ query: shallow, style: { translateY: 100 } }] }}>
      <Overlay style={{ width: Math.max(1, width - left - 32), height: Math.max(1, height - 316), when: [{ query: shallow, style: { height: Math.max(1, height - 156) } }] }}>
        <LogScale id="mass" domain={earthUnits.get() ? [0.001, 1000] : [0.01, 10000]} range="width" style={{ width: "100%", height: "100%" }}>
          <LinearScale id="body" domain={[0, 9]} range="height"><Plot earthUnits={earthUnits.get()} selected={selected} left={left} top={top} /></LinearScale>
        </LogScale>
      </Overlay>
    </Group>
    <Text style={{ left: 24, top: height - 29, font: "10px sans-serif", fill: muted }}>NASA / NSSDCA · fact sheet dated 18 Mar 2025</Text>
    <Text style={{ left: 24, top: height - 14, font: "10px sans-serif", fill: muted }}>8 planets, the Moon & Pluto · equal-size dots</Text>
  </>;
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <FocusManagement><Scene /></FocusManagement>, { viewport: "responsive" });
}

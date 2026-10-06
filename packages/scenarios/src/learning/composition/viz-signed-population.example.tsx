import { FocusManagement, Circle, Group, Line, Overlay, Rectangle, Text, pibbl, useLayoutBox, useSignal, type PibblController, type WritableSignal } from "@pibbl/core";
import { ReferenceBand, GridLines, ReferenceLine, Axis, PointScale, SymlogScale, ScaleAdjust, usePointScale, useSymlogScale, formatNumber } from "@pibbl/core/viz";
// US Census Bureau, Vintage 2023 estimates, published 19 December 2023.
// Six most populous states; population change July 1, 2022–July 1, 2023, people.
// https://www.census.gov/newsroom/press-releases/2023/population-trends-return-to-pre-pandemic-norms.html
// Reused from the repository's checked-in Census snapshot. Later vintages may revise it.
const rows = [
  { name: "California", value: -75423 }, { name: "Texas", value: 473453 },
  { name: "Florida", value: 365205 }, { name: "New York", value: -101984 },
  { name: "Pennsylvania", value: -10408 }, { name: "Illinois", value: -32826 },
].sort((a, b) => b.value - a.value);
const abbreviations: Record<string, string> = { California: "CA", Texas: "TX", Florida: "FL", "New York": "NY", Pennsylvania: "PA", Illinois: "IL" };
const ink = "#172f3d", muted = "#617783", gain = "#087f8c", loss = "#b65a35";
function Plot({ selected, left, compact }: { selected: WritableSignal<number>; left: number; compact: boolean }) {
  const x = usePointScale("state").get(), y = useSymlogScale("change").get();
  return <>
    <ReferenceBand scale="change" direction="horizontal" span={[0, x.frame.width]} values={[-110000, 0]} style={{ fill: loss, opacity: 0.07 }} />
    <GridLines scale="change" direction="horizontal" span={[0, x.frame.width]} tickValues={[-100000, 100000, 500000]} />
    <ReferenceLine scale="change" direction="horizontal" span={[0, x.frame.width]} value={0} style={{ stroke: "#82999f" }} />
    <Axis scale="change" position="left" tickValues={[-100000, 0, 100000, 500000]} labelOverlap="skip" labelGap={8}
      tickFormat={value => Number(value) === 0 ? "0" : `${Number(value) / 1000}k`} style={{ stroke: "#bdced3", fill: muted, font: "11px sans-serif" }} />
    <Axis scale="state" position="bottom" tickValues={rows.map(row => row.name)} tickFormat={value => compact ? abbreviations[String(value)] : String(value)} style={{ strokeWidth: 0, fill: muted, font: "12px sans-serif" }} />
    {rows.map((row, index) => <Group key={row.name}>
      <Line pointerEvents="none" style={{ coords: [[x.map(row.name)!, y.map(0)], [x.map(row.name)!, y.map(row.value)]], stroke: row.value > 0 ? "#a8c9ca" : "#e2b6a3", strokeWidth: 2 }} />
      <ScaleAdjust x={row.name} xScale="state" y={row.value} yScale="change">
        <Circle pointerEvents="none" style={{ radius: selected.get() === index ? 6 : 4, fill: row.value > 0 ? gain : loss, stroke: selected.get() === index ? ink : undefined, strokeWidth: 1.5 }} />
      </ScaleAdjust>
    </Group>)}
    <Rectangle keyboardFocusable onPointerDown={event => {
      const state = x.invert(event.x - left); const index = rows.findIndex(row => row.name === state);
      if (index >= 0) selected.set(index);
    }} onKeyDown={event => {
      if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(event.key)) {
        event.preventDefault(); selected.update(index => event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, index + (["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1))));
      }
    }} style={{ width: x.frame.width, height: y.frame.height, fill: "rgba(0,0,0,0)", cursor: "pointer" }} />
  </>;
}
function Scene() {
  const { width, height } = useLayoutBox();
  const selected = useSignal(0), wider = useSignal(false);
  const constant = wider.get() ? 100000 : 10000, row = rows[selected.get()];
  const shallow = { maxHeight: 400 }, narrow = { maxWidth: 600 };
  const left = 58;
  return <>
    <Rectangle style={{ width, height, fill: "#f7faf9" }} />
    <Text style={{ left: 24, top: 24, font: "700 11px sans-serif", fill: gain, when: [{ query: shallow, style: { opacity: 0 } }] }}>A YEAR OF POPULATION CHANGE</Text>
    <Text style={{ left: 24, top: 52, font: "600 34px sans-serif", fill: ink, when: [{ query: narrow, style: { font: "600 25px sans-serif" } }, { query: shallow, style: { opacity: 0 } }] }}>Growth moved south.</Text>
    <Text style={{ left: 24, top: 99, font: "13px sans-serif", fill: muted, when: [{ query: narrow, style: { font: "11px sans-serif" } }, { query: shallow, style: { opacity: 0 } }] }}>Six largest states · July 2022–July 2023 · people</Text>
    <Group style={{ translateX: 24, translateY: 130, when: [{ query: shallow, style: { translateY: 12 } }] }}>
      <Rectangle keyboardFocusable onClick={() => wider.update(v => !v)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); wider.update(v => !v); } }} style={{ width: 180, height: 44, fill: ink, cornerRadius: 6, cursor: "pointer" }} />
      <Text pointerEvents="none" style={{ left: 90, top: 22, textAlign: "center", textBaseline: "middle", font: "600 12px sans-serif", fill: "white" }}>{wider.get() ? "Restore compression" : "Widen linear region"}</Text>
    </Group>
    <Text style={{ left: 24, top: 189, font: "600 16px sans-serif", fill: ink, when: [{ query: narrow, style: { font: "600 13px sans-serif" } }, { query: shallow, style: { top: 66, font: "600 13px sans-serif" } }] }}>{`${row.name} · ${formatNumber(row.value, { signDisplay: "always" })} people`}</Text>
    <Text style={{ left: 24, top: 212, font: "11px sans-serif", fill: muted, when: [{ query: shallow, style: { top: 87, font: "10px sans-serif" } }] }}>{`Symlog c = ${formatNumber(constant)} · tap or Tab + ← →`}</Text>
    <Group style={{ translateX: left, translateY: 234, when: [{ query: shallow, style: { translateY: 108 } }] }}>
      <Overlay style={{ width: Math.max(1, width - left - 24), height: Math.max(1, height - 310), when: [{ query: shallow, style: { height: Math.max(1, height - 164) } }] }}>
        <PointScale id="state" domain={rows.map(row => row.name)} range="width" padding={0.5} style={{ width: "100%", height: "100%" }}>
          <SymlogScale id="change" domain={[-110000, 500000]} range="height" reverse constant={constant}><Plot selected={selected} left={left} compact={width <= 600} /></SymlogScale>
        </PointScale>
      </Overlay>
    </Group>
    <Text style={{ left: 24, top: height - 29, font: "10px sans-serif", fill: muted }}>US Census Bureau · Vintage 2023 estimates</Text>
    <Text style={{ left: 24, top: height - 14, font: "10px sans-serif", fill: muted }}>2022–2023 · shaded = loss · nonlinear axis</Text>
  </>;
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <FocusManagement><Scene /></FocusManagement>, { viewport: "responsive" });
}

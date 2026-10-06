import { FocusManagement, Group, Overlay, Rectangle, Text, pibbl, useLayoutBox, useSignal, type PibblController, type WritableSignal } from "@pibbl/core";
import { Axis, BarScale, LinearScale, useBarScale, useLinearScale, formatNumber } from "@pibbl/core/viz";
// NOAA GML / Scripps, Mauna Loa monthly means, Jan–Jun 1980 (ppm).
// https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv
// Reused from the checked-in 2026-09-28 snapshot; no runtime fetching.
const rows = [337.9, 338.34, 340.07, 340.93, 341.45, 341.36].map((ppm, index) => ({
  label: `${["January", "February", "March", "April", "May", "June"][index]} 1980 · Mauna Loa`, ppm,
}));
const ink = "#172f3d", teal = "#087f8c", muted = "#617783";
function Plot({ wrap, labelWidth, selected }: { wrap: boolean; labelWidth: number; selected: WritableSignal<number> }) {
  const categories = useBarScale("month").get();
  const values = useLinearScale("ppm").get();
  return <>
    <Axis scale="month" position="left" tickValues={rows.map(row => row.label)}
      labelOverflow={wrap ? "wrap" : "truncate"} labelMaxWidth={labelWidth} labelMaxLines={2} labelOverlap="skip" labelGap={3}
      style={{ stroke: "#bdced3", fill: muted, font: "12px sans-serif" }} />
    <Axis scale="ppm" position="bottom" tickValues={[0, 100, 200, 300]} labelOverlap="skip" style={{ stroke: "#bdced3", fill: muted }} />
    {rows.map((row, index) => <Rectangle key={row.label} keyboardFocusable
      onPointerDown={() => selected.set(index)} onFocus={() => selected.set(index)}
      onKeyDown={event => {
        if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) {
          event.preventDefault();
          selected.update(value => Math.max(0, Math.min(rows.length - 1, value + (["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1))));
        }
      }}
      style={{ left: 0, top: categories.map(row.label)!, width: values.map(row.ppm), height: categories.bandwidth,
        fill: selected.get() === index ? teal : "#a8c9ca", stroke: selected.get() === index ? ink : undefined, strokeWidth: 1, cursor: "pointer" }} />)}
  </>;
}
function Scene() {
  const { width, height } = useLayoutBox();
  const selected = useSignal(0), wrap = useSignal(true);
  const narrow = { maxWidth: 500 }, shallow = { maxHeight: 350 };
  const left = width < 500 ? 112 : 180;
  const row = rows[selected.get()];
  return <>
    <Rectangle style={{ width, height, fill: "#f7faf9" }} />
    <Text style={{ left: 20, top: 20, font: "600 28px sans-serif", fill: ink, when: [{ query: narrow, style: { font: "600 21px sans-serif" } }, { query: shallow, style: { top: 12, font: "600 20px sans-serif" } }] }}>Six months, one record</Text>
    <Text style={{ left: 20, top: 59, font: "13px sans-serif", fill: muted, when: [{ query: shallow, style: { opacity: 0 } }] }}>Mauna Loa CO₂ · monthly means · ppm · 1980</Text>
    <Group style={{ translateX: 20, translateY: 86, when: [{ query: shallow, style: { translateY: 42 } }] }}>
      <Rectangle keyboardFocusable onClick={() => wrap.update(v => !v)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); wrap.update(v => !v); } }}
        style={{ width: 164, height: 44, fill: ink, cornerRadius: 6, cursor: "pointer" }} />
      <Text pointerEvents="none" style={{ left: 82, top: 22, textAlign: "center", textBaseline: "middle", fill: "white", font: "600 12px sans-serif" }}>{wrap.get() ? "Wrap labels · change" : "Truncate labels · change"}</Text>
    </Group>
    <Text style={{ left: 20, top: 145, font: "600 13px sans-serif", fill: ink, when: [{ query: narrow, style: { font: "600 11px sans-serif" } }, { query: shallow, style: { top: 94 } }] }}>{`${row.label} · ${formatNumber(row.ppm, { minimumFractionDigits: 2 })} ppm`}</Text>
    <Text style={{ left: 20, top: 166, font: "11px sans-serif", fill: muted, when: [{ query: shallow, style: { opacity: 0 } }] }}>Tap a bar or Tab to inspect · arrow keys step months</Text>
    <Group style={{ translateX: left, translateY: 202, when: [{ query: shallow, style: { translateY: 122 } }] }}>
      <Overlay style={{ width: Math.max(1, width - left - 24), height: Math.max(1, height - 270), when: [{ query: shallow, style: { height: Math.max(1, height - 180) } }] }}>
        <BarScale id="month" domain={rows.map(row => row.label)} range="height" paddingInner={0.25} style={{ width: "100%", height: "100%" }}>
          <LinearScale id="ppm" domain={[0, 360]} range="width"><Plot wrap={wrap.get()} labelWidth={left - 30} selected={selected} /></LinearScale>
        </BarScale>
      </Overlay>
    </Group>
    <Text style={{ left: 20, top: height - 22, font: "11px sans-serif", fill: muted }}>Source: NOAA GML / Scripps · Jan–Jun 1980</Text>
  </>;
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <FocusManagement><Scene /></FocusManagement>, { viewport: "responsive" });
}

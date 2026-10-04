import { createElement, signal, type CRCNode } from "@crc/core";
import { BarSeries, PieLayout, PieSlice, PieLabel, Scale, type PieLayoutSlice } from "@crc/core/viz";
import { expect, it } from "vitest";
import { commands } from "vitest/browser";
import { testRuntime } from "./support/runtime.js";

// Explicit opt-in timing probe. Both revisions use this exact fixture; only the
// approved breaking BarSeries vocabulary and PieLayout revision opt-in differ.
const enabled = import.meta.env.VITE_CRC_VIZ_PERF === "1";
const legacy = import.meta.env.VITE_CRC_VIZ_LEGACY === "1";
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const paint = { fill: "#2878b5" };
type Row = { category: number; value: number };
const label = (slice: PieLayoutSlice<Row>) => String(slice.datum.category);

it.skipIf(!enabled)("reports fixed first-wave public workloads", async () => {
  const results: Record<string, unknown>[] = [];
  for (const kind of ["bars", "pie"] as const) {
    for (const count of kind === "bars" ? [100, 10_000, 100_000] : [100, 1_000]) {
      const runtime = testRuntime();
      const rows = signal(Array.from({ length: count }, (_, category) => ({ category, value: 1 + category % 100 })));
      const categories = rows.get().map(row => row.category);
      const pulse = signal(0);
      let hits = 0;
      const event = () => { hits++; };
      const renderSlice = (slice: PieLayoutSlice<Row>) => <PieSlice slice={slice} style={paint} onPointerDown={event}><PieLabel slice={slice} /></PieSlice>;
      const props = legacy
        ? { data: rows, x: "category", y: "value", xScale: "c", yScale: "v", style: paint, onPointerDown: event }
        : { data: rows, category: "category", value: "value", categoryScale: "c", valueScale: "v", style: paint, onPointerDown: event };
      function App(): CRCNode {
        pulse.get();
        if (kind === "pie") return createElement(PieLayout<Row>, {
          data: rows, value: "value", keyBy: "category", label: label as never,
          ...(legacy ? {} : { revision: 0 }),
          style: { cx: 250, cy: 200, radius: 150 }, children: renderSlice,
        });
        return <Scale id="c" type="band" domain={categories} range={[0, 500]}>
          <Scale id="v" type="linear" domain={[0, 100]} range={[350, 0]}>
            {createElement(BarSeries<Row>, props as never)}
          </Scale>
        </Scale>;
      }
      try {
        let start = performance.now();
        const canvas = runtime.mount(<App />); runtime.flush();
        const mountMs = performance.now() - start;
        // Two warmup redraws then seven measured observations per update mode.
        for (let i = 0; i < 2; i++) { pulse.update(v => v + 1); runtime.flush(); }
        const staticMs: number[] = [], updateMs: number[] = [], pointerMs: number[] = [];
        const bounds = canvas.getBoundingClientRect();
        for (let i = 0; i < 7; i++) {
          start = performance.now(); pulse.update(v => v + 1); runtime.flush(); staticMs.push(performance.now() - start);
          const next = rows.get().map((row, index) => index === count - 1 ? { ...row, value: 1 + (row.value % 100) } : row);
          start = performance.now(); rows.set(next); runtime.flush(); updateMs.push(performance.now() - start);
          start = performance.now();
          for (let j = 0; j < 20; j++) canvas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: bounds.left + (kind === "pie" ? 350 : 499), clientY: bounds.top + (kind === "pie" ? 200 : 349), pointerId: 1 }));
          pointerMs.push((performance.now() - start) / 20);
        }
        expect(runtime.pending).toBe(0);
        expect(hits).toBe(140);
        results.push({ kind, count, mountMs, staticMedianMs: median(staticMs), updateMedianMs: median(updateMs), pointerMedianMs: median(pointerMs), staticMs, updateMs, pointerMs, hits });
      } finally { runtime.dispose(); }
    }
  }
  await commands.writeFile(import.meta.env.VITE_CRC_VIZ_RESULT, JSON.stringify({ legacy, results }, null, 2));
}, 180_000);

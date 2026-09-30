import { signal } from "@crc/core";
import { LineSeries, Scale } from "@crc/viz";
import { expect, it } from "vitest";
import { commands } from "vitest/browser";
import { testRuntime } from "./support/runtime.js";

const enabled = import.meta.env.VITE_CRC_VIZ_CONTINUOUS_PERF === "1";
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const stroke = { stroke: "#2878b5", strokeWidth: 2 };

it.skipIf(!enabled)("records unchanged linear line workloads before continuous kinds", async () => {
  const results: Record<string, unknown>[] = [];
  for (const count of [100, 10_000, 100_000]) {
    const runtime = testRuntime();
    const rows = signal(Array.from({ length: count }, (_, x) => ({ x, y: 50 + 20 * Math.sin(x / 100) })));
    const pulse = signal(0);
    let hits = 0;
    const onPointerDown = () => { hits++; };
    function App() {
      pulse.get();
      return <Scale id="x" type="linear" domain={[0, count - 1]} range={[0, 500]}>
        <Scale id="y" type="linear" domain={[0, 100]} range={[350, 0]}>
          <LineSeries data={rows} x="x" y="y" xScale="x" yScale="y" style={stroke} onPointerDown={onPointerDown} />
        </Scale>
      </Scale>;
    }
    try {
      let start = performance.now();
      const canvas = runtime.mount(<App />); runtime.flush();
      const mountMs = performance.now() - start;
      for (let i = 0; i < 3; i++) { pulse.update(v => v + 1); runtime.flush(); }
      const staticMs: number[] = [], updateMs: number[] = [], pointerMs: number[] = [];
      const bounds = canvas.getBoundingClientRect();
      const middle = Math.floor(count / 2);
      const clientX = bounds.left + middle / (count - 1) * 500;
      const clientY = bounds.top + 350 - rows.get()[middle].y / 100 * 350;
      for (let i = 0; i < 9; i++) {
        start = performance.now(); pulse.update(v => v + 1); runtime.flush(); staticMs.push(performance.now() - start);
        const next = rows.get().map((row, index) => index === count - 1 ? { ...row, y: 45 + i } : row);
        start = performance.now(); rows.set(next); runtime.flush(); updateMs.push(performance.now() - start);
        start = performance.now();
        for (let j = 0; j < 20; j++) canvas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX, clientY, pointerId: 1 }));
        pointerMs.push((performance.now() - start) / 20);
      }
      expect(runtime.pending).toBe(0);
      expect(hits).toBe(180);
      results.push({ count, mountMs, staticMedianMs: median(staticMs), updateMedianMs: median(updateMs), pointerMedianMs: median(pointerMs), staticMs, updateMs, pointerMs, hits });
    } finally { runtime.dispose(); }
  }
  await commands.writeFile(import.meta.env.VITE_CRC_VIZ_RESULT, JSON.stringify({ results }, null, 2));
}, 180_000);

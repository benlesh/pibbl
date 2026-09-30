import { createElement, signal, type CRCNode } from "@crc/core";
import { PieLayout, PieLabel, PieSlice, type PieLayoutSlice } from "@crc/viz";
import { expect, it, vi } from "vitest";
import { commands } from "vitest/browser";
import { getCRCInstance } from "../../core/src/lib/global-state.js";
import { testRuntime } from "./support/runtime.js";

const enabled = import.meta.env.VITE_CRC_VIZ_STRUCTURE === "1";
const legacy = import.meta.env.VITE_CRC_VIZ_LEGACY === "1";
const fill = { fill: "#2878b5" };

type Row = { category: number; value: number };

interface StructuralSnapshot {
  readonly targets: number;
  readonly paintEntries: number;
  readonly fillCalls: number;
  readonly fillTextCalls: number;
  readonly isPointInPathCalls: number;
}

/**
 * Non-timed public-solid-pie evidence. Run unchanged in baseline mode with
 * VITE_CRC_VIZ_LEGACY=1; candidate mode adds revision: 0 to prove the opted-in
 * cached path has the same retained pointer work.
 */
it.skipIf(!enabled)("records dense solid-pie structure", async () => {
  const results: Record<string, unknown>[] = [];
  for (const count of [100, 1_000]) {
    const runtime = testRuntime();
    const fillSpy = vi.spyOn(CanvasRenderingContext2D.prototype, "fill");
    const fillTextSpy = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      "fillText",
    );
    const hitSpy = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      "isPointInPath",
    );
    try {
      const rows = signal(
        Array.from({ length: count }, (_, category) => ({
          category,
          value: 1 + (category % 100),
        })),
      );
      let hits = 0;
      const onPointerDown = () => {
        hits++;
      };
      const renderSlice = (slice: PieLayoutSlice<Row>) => (
        <PieSlice slice={slice} style={fill} onPointerDown={onPointerDown}>
          <PieLabel slice={slice} />
        </PieSlice>
      );
      function App(): CRCNode {
        return createElement(PieLayout<Row>, {
          data: rows,
          value: "value",
          keyBy: "category",
          label: (slice: PieLayoutSlice<Row>) => String(slice.datum.category),
          ...(legacy ? {} : { revision: 0 }),
          style: { cx: 250, cy: 200, radius: 150 },
          children: renderSlice,
        } as never);
      }
      fillSpy.mockClear();
      const canvas = runtime.mount(<App />);
      runtime.flush();
      const instance = getCRCInstance(canvas);
      const afterMount = {
        targets: instance.eventRoot.targets.size,
        paintEntries: instance.paintEntries.size,
        fillCalls: fillSpy.mock.calls.length,
        fillTextCalls: fillTextSpy.mock.calls.length,
      };
      expect(afterMount.targets).toBe(count);

      const dispatch = () => {
        const bounds = canvas.getBoundingClientRect();
        canvas.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            clientX: bounds.left + 350,
            clientY: bounds.top + 200,
            pointerId: 1,
          }),
        );
      };
      hitSpy.mockClear();
      dispatch();
      const mountedPointerCalls = hitSpy.mock.calls.length;

      fillSpy.mockClear();
      fillTextSpy.mockClear();
      rows.set(
        rows
          .get()
          .map((row, index) =>
            index === count - 1
              ? { ...row, value: 1 + (row.value % 100) }
              : row,
          ),
      );
      runtime.flush();
      const afterUpdate = {
        targets: instance.eventRoot.targets.size,
        paintEntries: instance.paintEntries.size,
        fillCalls: fillSpy.mock.calls.length,
        fillTextCalls: fillTextSpy.mock.calls.length,
      };
      expect(afterUpdate.targets).toBe(count);

      hitSpy.mockClear();
      dispatch();
      const updatedPointerCalls = hitSpy.mock.calls.length;
      expect(hits).toBe(2);
      results.push({
        count,
        afterMount: {
          ...afterMount,
          isPointInPathCalls: mountedPointerCalls,
        } satisfies StructuralSnapshot,
        afterUpdate: {
          ...afterUpdate,
          isPointInPathCalls: updatedPointerCalls,
        } satisfies StructuralSnapshot,
      });
    } finally {
      runtime.dispose();
    }
  }
  await commands.writeFile(
    import.meta.env.VITE_CRC_VIZ_RESULT,
    JSON.stringify({ legacy, results }, null, 2),
  );
});

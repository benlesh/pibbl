import { signal } from "@pibbl/core";
import { GridLines, ReferenceLine, LinearScale } from "@pibbl/core/viz";
import { expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";
it("maps grid and reactive reference geometry without consuming label density", () => {
  const runtime = testRuntime(), value = signal(5);
  const moves = vi.spyOn(Path2D.prototype, "moveTo");
  const lines = vi.spyOn(Path2D.prototype, "lineTo");
  try {
    runtime.mount(<LinearScale id="y" domain={[0, 10]} range={[100, 0]}>
      <GridLines scale="y" direction="horizontal" span={[20, 220]} tickValues={[0, 5, 10]} />
      <ReferenceLine scale="y" direction="horizontal" span={[20, 220]} value={value} />
    </LinearScale>);
    runtime.flush();
    expect(moves.mock.calls).toEqual(expect.arrayContaining([[20, 100], [20, 50], [20, 0]]));
    expect(lines.mock.calls).toEqual(expect.arrayContaining([[220, 100], [220, 50], [220, 0]]));
    moves.mockClear(); value.set(7); runtime.flush(); expect(moves).toHaveBeenCalledWith(20, 30);
    runtime.dispose(); value.set(8); expect(runtime.pending).toBe(0);
  } finally { runtime.dispose(); }
});

it("maps reversed reference bands and updates their interval without intercepting input", async () => {
  const { ReferenceBand } = await import("@pibbl/core/viz");
  const runtime = testRuntime(), interval = signal<readonly [number, number]>([2, 6]);
  const rect = vi.spyOn(Path2D.prototype, "rect");
  try {
    runtime.mount(<LinearScale id="y" domain={[0, 10]} range={[100, 0]}>
      <ReferenceBand scale="y" direction="horizontal" span={[220, 20]} values={interval} />
    </LinearScale>);
    runtime.flush(); expect(rect).toHaveBeenCalledWith(20, 40, 200, 40);
    interval.set([6, 2]); runtime.flush(); expect(rect).toHaveBeenLastCalledWith(20, 40, 200, 40);
    runtime.dispose(); interval.set([1, 5]); expect(runtime.pending).toBe(0);
  } finally { runtime.dispose(); }
});

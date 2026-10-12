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

it("centers category guides on bands and preserves point identities", async () => {
  const { BarScale, PointScale } = await import("@pibbl/core/viz");
  for (const Provider of [BarScale, PointScale]) {
    const runtime = testRuntime(), moves = vi.spyOn(Path2D.prototype, "moveTo");
    try {
      runtime.mount(<Provider id="c" domain={["A", "B"]} range={[0, 100]}>
        <GridLines scale="c" direction="vertical" span={[10, 90]} tickValues={["A", "B"]} />
      </Provider>);
      runtime.flush();
      const positions = moves.mock.calls.map(([x]) => x);
      expect(positions).toHaveLength(2);
      expect(positions[0]).toBeLessThan(positions[1]);
      expect(positions[0] + positions[1]).toBeCloseTo(100);
      if (Provider === PointScale) expect(positions).toEqual([0, 100]);
      else { expect(positions[0]).toBeGreaterThan(0); expect(positions[1]).toBeLessThan(100); }
    } finally { runtime.dispose(); }
  }
});

it("maps a vertical logarithmic reference interval by scale geometry", async () => {
  const { ReferenceBand, LogScale } = await import("@pibbl/core/viz");
  const runtime = testRuntime(), rect = vi.spyOn(Path2D.prototype, "rect");
  try {
    runtime.mount(<LogScale id="x" domain={[1, 1000]} range={[0, 300]}>
      <ReferenceBand scale="x" direction="vertical" span={[90, 10]} values={[10, 100]} />
    </LogScale>);
    runtime.flush(); const [x, y, width, height] = rect.mock.calls.at(-1)!;
    expect(x).toBeCloseTo(100); expect(y).toBe(10); expect(width).toBeCloseTo(100); expect(height).toBe(80);
  } finally { runtime.dispose(); }
});

it.each([
  { values: [-1, 5] as const, span: [0, 100] as const },
  { values: [0, Infinity] as const, span: [0, 100] as const },
  { values: [0, 5] as const, span: [-Number.MAX_VALUE, Number.MAX_VALUE] as const },
])("rejects invalid reference-band geometry %#", async props => {
  const { ReferenceBand } = await import("@pibbl/core/viz");
  const runtime = testRuntime();
  try {
    runtime.mount(<LinearScale id="x" domain={[0, 10]} range={[0, 100]}><ReferenceBand scale="x" direction="vertical" {...props} /></LinearScale>);
    expect(() => runtime.flush()).toThrow(RangeError);
  } finally { runtime.dispose(); }
});

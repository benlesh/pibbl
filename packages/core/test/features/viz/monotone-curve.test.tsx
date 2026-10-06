import { signal } from "@pibbl/core";
import {
  IntervalBandSeries,
  LineSeries,
  LinearScale,
  LogScale,
  monotoneX,
  stepAfter,
} from "@pibbl/core/viz";
import { afterEach, expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
it("smooths ordered observations without exceeding their endpoint extrema", () => {
  runtime = testRuntime();
  const cubic = vi.spyOn(Path2D.prototype, "bezierCurveTo");
  runtime.mount(
    <LinearScale id="x" domain={[0, 2]} range={[0, 200]}>
      <LinearScale id="y" domain={[0, 2]} range={[200, 0]}>
        <LineSeries
          data={[
            { x: 0, y: 0 },
            { x: 1, y: 2 },
            { x: 2, y: 1 },
          ]}
          x="x"
          y="y"
          xScale="x"
          yScale="y"
          curve={monotoneX()}
        />
      </LinearScale>
    </LinearScale>,
  );
  runtime.flush();
  expect(cubic.mock.calls).toHaveLength(2);
  const endpoints = [
    [0, 200],
    [100, 0],
    [200, 100],
  ];
  for (let i = 0; i < 2; i++) {
    const [cx1, cy1, cx2, cy2, x, y] = cubic.mock.calls[i];
    const [x0, y0] = endpoints[i];
    expect([x, y]).toEqual(endpoints[i + 1]);
    expect(cx1).toBeCloseTo(x0 + (x - x0) / 3);
    expect(cx2).toBeCloseTo(x - (x - x0) / 3);
    for (let j = 0; j <= 100; j++) {
      const t = j / 100,
        u = 1 - t;
      const sample =
        u * u * u * y0 +
        3 * u * u * t * cy1 +
        3 * u * t * t * cy2 +
        t * t * t * y;
      expect(sample).toBeGreaterThanOrEqual(Math.min(y0, y) - 1e-9);
      expect(sample).toBeLessThanOrEqual(Math.max(y0, y) + 1e-9);
    }
  }
  expect(cubic.mock.calls[0][3]).toBe(0);
  expect(cubic.mock.calls[1][1]).toBe(0);
});

it("keeps descending authored observations ordered through a reversed logarithmic range", () => {
  runtime = testRuntime();
  const cubic = vi.spyOn(Path2D.prototype, "bezierCurveTo"),
    move = vi.spyOn(Path2D.prototype, "moveTo");
  runtime.mount(
    <LogScale id="x" domain={[1, 100]} range={[0, 200]}>
      <LinearScale id="y" domain={[0, 10]} range={[100, 0]}>
        <LineSeries
          data={[
            { x: 100, y: 2 },
            { x: 10, y: 8 },
            { x: 1, y: 4 },
          ]}
          x="x"
          y="y"
          xScale="x"
          yScale="y"
          curve={monotoneX()}
        />
      </LinearScale>
    </LogScale>,
  );
  runtime.flush();
  expect(move.mock.calls).toEqual([[200, 80]]);
  expect(cubic.mock.calls.map((call) => call.slice(-2))).toEqual([
    [100, 20],
    [0, 60],
  ]);
  for (const [cx1, cy1, cx2, cy2] of cubic.mock.calls)
    expect([cx1, cy1, cx2, cy2].every(Number.isFinite)).toBe(true);
});

it("rejects duplicate and nonmonotonic mapped x coordinates without leaving work queued", () => {
  for (const rows of [
    [
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 3 },
    ],
    [
      { x: 0, y: 1 },
      { x: 2, y: 2 },
      { x: 1, y: 3 },
    ],
  ]) {
    runtime = testRuntime();
    runtime.mount(
      <LinearScale id="x" domain={[0, 2]} range={[0, 100]}>
        <LinearScale id="y" domain={[0, 4]} range={[100, 0]}>
          <LineSeries
            data={rows}
            x="x"
            y="y"
            xScale="x"
            yScale="y"
            curve={monotoneX()}
          />
        </LinearScale>
      </LinearScale>,
    );
    expect(() => runtime.flush()).toThrow(/strictly ascending or descending/);
    expect(runtime.pending).toBe(0);
    runtime.dispose();
  }
});

it("preserves flat segments and isolates missing runs", () => {
  runtime = testRuntime();
  const cubic = vi.spyOn(Path2D.prototype, "bezierCurveTo"),
    move = vi.spyOn(Path2D.prototype, "moveTo");
  runtime.mount(
    <LinearScale id="x" domain={[0, 4]} range={[0, 200]}>
      <LinearScale id="y" domain={[0, 10]} range={[100, 0]}>
        <LineSeries
          data={[
            { x: 0, y: 2 },
            { x: 1, y: 2 },
            { x: 2, y: null },
            { x: 3, y: 7 },
            { x: 4, y: 7 },
          ]}
          x="x"
          y="y"
          xScale="x"
          yScale="y"
          curve={monotoneX()}
        />
      </LinearScale>
    </LinearScale>,
  );
  runtime.flush();
  expect(move.mock.calls).toEqual([
    [0, 80],
    [150, 30],
  ]);
  expect(cubic.mock.calls).toHaveLength(2);
  for (const [cx1, cy1, cx2, cy2, x, y] of cubic.mock.calls) {
    const start = x === 50 ? 0 : 150;
    expect(cy1).toBe(y);
    expect(cy2).toBe(y);
    expect(cx1).toBeCloseTo((start * 2 + x) / 3);
    expect(cx2).toBeCloseTo((start + x * 2) / 3);
  }
});

it("rejects analytically crossed interval cubics across normal, reversed, and tiny mapped ranges", () => {
  for (const [range, reverse] of [
    [[100, 0], false],
    [[0, 100], true],
    [[0, 1e-20], false],
  ] as const) {
    runtime = testRuntime();
    runtime.mount(
      <LinearScale id="x" domain={[0, 2]} range={[0, 200]}>
        <LinearScale id="y" domain={[0, 15]} range={range} reverse={reverse}>
          <IntervalBandSeries
            data={[
              { x: 0, lower: 0, upper: 5 },
              { x: 1, lower: 4, upper: 5 },
              { x: 2, lower: 14, upper: 15 },
            ]}
            x="x"
            lower="lower"
            upper="upper"
            xScale="x"
            yScale="y"
            curve={monotoneX()}
          />
        </LinearScale>
      </LinearScale>,
    );
    expect(() => runtime.flush()).toThrow(/boundaries cross/);
    expect(runtime.pending).toBe(0);
    runtime.dispose();
  }
});

it("accepts equal interval bounds and replaces reactive curve definitions without retaining subscriptions", () => {
  runtime = testRuntime();
  const curve = signal(monotoneX()),
    cubic = vi.spyOn(Path2D.prototype, "bezierCurveTo");
  function Scene() {
    return (
      <LinearScale id="x" domain={[0, 2]} range={[0, 100]}>
        <LinearScale id="y" domain={[0, 10]} range={[100, 0]}>
          <IntervalBandSeries
            data={[
              { x: 0, lower: 3, upper: 3 },
              { x: 1, lower: 3, upper: 3 },
              { x: 2, lower: 3, upper: 3 },
            ]}
            x="x"
            lower="lower"
            upper="upper"
            xScale="x"
            yScale="y"
            curve={curve.get()}
          />
        </LinearScale>
      </LinearScale>
    );
  }
  runtime.mount(<Scene />);
  runtime.flush();
  expect(cubic).toHaveBeenCalled();
  cubic.mockClear();
  curve.set(stepAfter());
  runtime.flush();
  expect(cubic).not.toHaveBeenCalled();
  runtime.dispose();
  curve.set(monotoneX());
  expect(runtime.pending).toBe(0);
});

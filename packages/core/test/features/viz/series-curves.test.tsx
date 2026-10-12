import { signal } from "@pibbl/core";
import {
  LineSeries,
  LinearScale,
  stepAfter,
  stepBefore,
  stepMidpoint,
} from "@pibbl/core/viz";
import { afterEach, expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
it.each([
  [
    stepBefore,
    [
      [0, 20],
      [100, 20],
    ],
  ],
  [
    stepAfter,
    [
      [100, 80],
      [100, 20],
    ],
  ],
  [
    stepMidpoint,
    [
      [50, 80],
      [50, 20],
      [100, 20],
    ],
  ],
] as const)(
  "maps a named step strategy without changing observed endpoints (%#)",
  (curve, expected) => {
    runtime = testRuntime();
    const moves = vi.spyOn(Path2D.prototype, "moveTo"),
      lines = vi.spyOn(Path2D.prototype, "lineTo");
    runtime.mount(
      <LinearScale id="x" domain={[0, 10]} range={[0, 100]}>
        <LinearScale id="y" domain={[0, 10]} range={[100, 0]}>
          <LineSeries
            data={[
              { x: 0, y: 2 },
              { x: 10, y: 8 },
            ]}
            x="x"
            y="y"
            xScale="x"
            yScale="y"
            curve={curve()}
          />
        </LinearScale>
      </LinearScale>,
    );
    runtime.flush();
    expect(moves.mock.calls).toEqual([[0, 80]]);
    expect(lines.mock.calls).toEqual(expected);
  },
);

it("splits step runs for excluded, missing, and non-finite observations", () => {
  runtime = testRuntime();
  const moves = vi.spyOn(Path2D.prototype, "moveTo"),
    lines = vi.spyOn(Path2D.prototype, "lineTo");
  const x = vi.fn((row: { x: number }) => row.x);
  runtime.mount(
    <LinearScale id="x" domain={[0, 10]} range={[0, 100]}>
      <LinearScale id="y" domain={[0, 10]} range={[100, 0]}>
        <LineSeries
          data={[
            { x: 0, y: 2 },
            { x: 2, y: 4 },
            { x: 4, y: null },
            { x: 6, y: NaN },
            { x: 8, y: 6 },
            { x: 10, y: 8 },
          ]}
          x={x}
          y="y"
          xScale="x"
          yScale="y"
          defined={(_, index) => index !== 1}
          curve={stepAfter()}
        />
      </LinearScale>
    </LinearScale>,
  );
  runtime.flush();
  expect(x).toHaveBeenCalledTimes(5);
  expect(moves.mock.calls).toEqual([[80, 40]]);
  expect(lines.mock.calls).toEqual([
    [100, 40],
    [100, 20],
  ]);
});

it("keeps duplicate and descending x coordinates in their authored step-after order", () => {
  runtime = testRuntime();
  const moves = vi.spyOn(Path2D.prototype, "moveTo"),
    lines = vi.spyOn(Path2D.prototype, "lineTo");
  runtime.mount(
    <LinearScale id="x" domain={[0, 10]} range={[0, 100]}>
      <LinearScale id="y" domain={[0, 10]} range={[100, 0]}>
        <LineSeries
          data={[
            { x: 10, y: 2 },
            { x: 10, y: 8 },
            { x: 2, y: 4 },
          ]}
          x="x"
          y="y"
          xScale="x"
          yScale="y"
          curve={stepAfter()}
        />
      </LinearScale>
    </LinearScale>,
  );
  runtime.flush();
  expect(moves.mock.calls).toEqual([[100, 80]]);
  expect(lines.mock.calls).toEqual([
    [100, 80],
    [100, 20],
    [20, 20],
    [20, 60],
  ]);
});

it("rejects forged curve definitions before an empty series can draw and leaves no pending work", () => {
  runtime = testRuntime();
  runtime.mount(
    <LinearScale id="x" domain={[0, 10]} range={[0, 100]}>
      <LinearScale id="y" domain={[0, 10]} range={[100, 0]}>
        <LineSeries<{ x: number; y: number }>
          data={[]}
          x="x"
          y="y"
          xScale="x"
          yScale="y"
          curve={Object.freeze({}) as never}
        />
      </LinearScale>
    </LinearScale>,
  );
  expect(() => runtime.flush()).toThrow(/named factory/);
  expect(runtime.pending).toBe(0);
});

it("replaces a reactive named curve definition and releases it on disposal", () => {
  runtime = testRuntime();
  const curve = signal(stepAfter());
  const lines = vi.spyOn(Path2D.prototype, "lineTo");
  function Scene() {
    return (
      <LinearScale id="x" domain={[0, 10]} range={[0, 100]}>
        <LinearScale id="y" domain={[0, 10]} range={[100, 0]}>
          <LineSeries
            data={[
              { x: 0, y: 2 },
              { x: 10, y: 8 },
            ]}
            x="x"
            y="y"
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
  expect(lines.mock.calls).toEqual([
    [100, 80],
    [100, 20],
  ]);
  lines.mockClear();
  curve.set(stepBefore());
  runtime.flush();
  expect(lines.mock.calls).toEqual([
    [0, 20],
    [100, 20],
  ]);
  runtime.dispose();
  curve.set(stepAfter());
  expect(runtime.pending).toBe(0);
});

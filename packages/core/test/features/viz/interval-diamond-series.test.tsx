import { signal } from "@pibbl/core";
import * as Viz from "@pibbl/core/viz";
import { afterEach, expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
it("renders supplied summary bounds and estimate as an asymmetric diamond and replaces reactive geometry", () => {
  expect(Viz).toHaveProperty("IntervalDiamondSeries");
  runtime = testRuntime();
  const moves = vi.spyOn(Path2D.prototype, "moveTo"),
    lines = vi.spyOn(Path2D.prototype, "lineTo");
  const data = signal([
    { category: "summary", estimate: 2, lower: 1, upper: 4 },
  ]);
  runtime.mount(
    <Viz.PointScale id="rows" domain={["summary"]} range={[50, 50]}>
      <Viz.LinearScale id="effect" domain={[0, 5]} range={[0, 250]}>
        <Viz.IntervalDiamondSeries
          data={data}
          category="category"
          estimate="estimate"
          lower="lower"
          upper="upper"
          categoryScale="rows"
          valueScale="effect"
          style={{ height: 12 }}
        />
      </Viz.LinearScale>
    </Viz.PointScale>,
  );
  runtime.flush();
  expect(moves.mock.calls).toContainEqual([50, 50]);
  expect(lines.mock.calls).toContainEqual([100, 44]);
  expect(lines.mock.calls).toContainEqual([200, 50]);
  expect(lines.mock.calls).toContainEqual([100, 56]);
  moves.mockClear();
  lines.mockClear();
  data.set([{ category: "summary", estimate: 3, lower: 2, upper: 4 }]);
  runtime.flush();
  expect(moves.mock.calls).toContainEqual([100, 50]);
  expect(lines.mock.calls).toContainEqual([150, 44]);
});

it("rejects a summary estimate outside its supplied bounds", () => {
  runtime = testRuntime();
  runtime.mount(
    <Viz.PointScale id="rows" domain={["summary"]} range={[50, 50]}>
      <Viz.LinearScale id="effect" domain={[0, 5]} range={[0, 250]}>
        <Viz.IntervalDiamondSeries
          data={[{ category: "summary", estimate: 4, lower: 1, upper: 3 }]}
          category="category"
          estimate="estimate"
          lower="lower"
          upper="upper"
          categoryScale="rows"
          valueScale="effect"
        />
      </Viz.LinearScale>
    </Viz.PointScale>,
  );
  expect(() => runtime.flush()).toThrow(
    /estimate must lie inside supplied bounds/,
  );
});

it("maps asymmetric bounds through logarithmic scales and skips missing or unknown rows before validation", () => {
  runtime = testRuntime();
  const moves = vi.spyOn(Path2D.prototype, "moveTo"),
    lines = vi.spyOn(Path2D.prototype, "lineTo");
  runtime.mount(
    <Viz.PointScale id="rows" domain={["summary"]} range={[50, 50]}>
      <Viz.LogScale id="effect" domain={[0.1, 100]} range={[0, 300]}>
        <Viz.IntervalDiamondSeries
          data={[
            { category: "missing", estimate: 4, lower: 3, upper: 2 },
            { category: "summary", estimate: null, lower: 0.1, upper: 100 },
            { category: "summary", estimate: 1, lower: 0.1, upper: 100 },
          ]}
          category="category"
          estimate="estimate"
          lower="lower"
          upper="upper"
          categoryScale="rows"
          valueScale="effect"
          style={{ height: 12 }}
        />
      </Viz.LogScale>
    </Viz.PointScale>,
  );
  runtime.flush();
  expect(moves.mock.calls).toEqual([[0, 50]]);
  expect(lines.mock.calls).toEqual([
    [100, 44],
    [300, 50],
    [100, 56],
  ]);
});

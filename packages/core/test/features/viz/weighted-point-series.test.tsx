import { signal } from "@pibbl/core";
import * as Viz from "@pibbl/core/viz";
import { afterEach, expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";

let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it("exports weighted points and maps supplied weight to proportional marker area", () => {
  // This public-export assertion intentionally precedes the implementation.
  expect(Viz).toHaveProperty("WeightedPointSeries");
  runtime = testRuntime();
  const arcs = vi.spyOn(Path2D.prototype, "arc");
  const data = signal([
    { dose: 1, response: 20, weight: 25 },
    { dose: 2, response: 50, weight: 100 },
    { dose: 3, response: 80, weight: 0 },
  ]);
  runtime.mount(
    <Viz.LinearScale id="dose" domain={[0, 4]} range={[0, 200]}>
      <Viz.LinearScale id="response" domain={[0, 100]} range={[200, 0]}>
        <Viz.WeightedPointSeries
          data={data}
          x="dose"
          y="response"
          weight="weight"
          xScale="dose"
          yScale="response"
          weightDomain={[0, 100]}
          radiusRange={[0, 10]}
        />
      </Viz.LinearScale>
    </Viz.LinearScale>,
  );
  runtime.flush();
  expect(
    arcs.mock.calls.some(
      ([x, y, radius]) => x === 50 && y === 160 && radius === 5,
    ),
  ).toBe(true);
  expect(
    arcs.mock.calls.some(
      ([x, y, radius]) => x === 100 && y === 100 && radius === 10,
    ),
  ).toBe(true);
  data.set([{ dose: 2, response: 50, weight: 64 }]);
  arcs.mockClear();
  runtime.flush();
  expect(
    arcs.mock.calls.some(
      ([x, y, radius]) => x === 100 && y === 100 && radius === 8,
    ),
  ).toBe(true);
});

it.each([
  [-1, /weight.*nonnegative/],
  [101, /weight.*weightDomain/],
  [Infinity, /weight.*finite/],
] as const)("rejects invalid supplied weight %s", (weight, error) => {
  runtime = testRuntime();
  runtime.mount(
    <Viz.LinearScale id="x" domain={[0, 1]} range={[0, 100]}>
      <Viz.LinearScale id="y" domain={[0, 1]} range={[100, 0]}>
        <Viz.WeightedPointSeries
          data={[{ x: 0.5, y: 0.5, weight }]}
          x="x"
          y="y"
          weight="weight"
          xScale="x"
          yScale="y"
          weightDomain={[0, 100]}
        />
      </Viz.LinearScale>
    </Viz.LinearScale>,
  );
  expect(() => runtime.flush()).toThrow(error);
});

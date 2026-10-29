import { defineTexture, signal, useTexture } from "@pibbl/core";
import * as Viz from "@pibbl/core/viz";
import { afterEach, expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";

let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it("publishes CensoredPointSeries from the public viz entry", () => {
  expect(Viz).toHaveProperty("CensoredPointSeries");
});

type Row = {
  x: number;
  y: number | null;
  censoring: "observed" | "below" | "above" | null;
};
function chart(
  rows: readonly Row[],
  range: readonly [number, number] = [200, 0],
) {
  return (
    <Viz.LinearScale
      id="x"
      domain={[0, 10]}
      range={[0, 200]}
      style={{ width: 200, height: 200 }}
    >
      <Viz.LinearScale id="y" domain={[0, 100]} range={range}>
        <Viz.CensoredPointSeries
          data={rows}
          x="x"
          y="y"
          censoring="censoring"
          xScale="x"
          yScale="y"
        />
      </Viz.LinearScale>
    </Viz.LinearScale>
  );
}

it("draws observed values as circles and reporting limits as semantic directional open markers", () => {
  runtime = testRuntime();
  const arcs = vi.spyOn(Path2D.prototype, "arc");
  const moves = vi.spyOn(Path2D.prototype, "moveTo");
  runtime.mount(
    chart([
      { x: 2, y: 20, censoring: "observed" },
      { x: 4, y: 20, censoring: "below" },
      { x: 6, y: 80, censoring: "above" },
    ]),
  );
  runtime.flush();
  expect(
    arcs.mock.calls.some(
      ([x, y, radius]) => x === 40 && y === 160 && radius === 4,
    ),
  ).toBe(true);
  // Normal y range decreases with increasing domain: below points down, above points up.
  expect(moves.mock.calls).toContainEqual([80, 164]);
  expect(moves.mock.calls).toContainEqual([120, 36]);
});

it("keeps below and above directions semantic when the y range reverses", () => {
  runtime = testRuntime();
  const moves = vi.spyOn(Path2D.prototype, "moveTo");
  runtime.mount(
    chart(
      [
        { x: 4, y: 20, censoring: "below" },
        { x: 6, y: 80, censoring: "above" },
      ],
      [0, 200],
    ),
  );
  runtime.flush();
  // Reversing the range swaps canvas direction while preserving below/above domain meaning.
  expect(moves.mock.calls).toContainEqual([80, 36]);
  expect(moves.mock.calls).toContainEqual([120, 164]);
});

it("observes reactive data and omits missing records", () => {
  runtime = testRuntime();
  const data = signal<readonly Row[]>([{ x: 2, y: 20, censoring: "observed" }]);
  const arcs = vi.spyOn(Path2D.prototype, "arc");
  runtime.mount(
    <Viz.LinearScale id="x" domain={[0, 10]} range={[0, 200]}>
      <Viz.LinearScale id="y" domain={[0, 100]} range={[200, 0]}>
        <Viz.CensoredPointSeries
          data={data}
          x="x"
          y="y"
          censoring="censoring"
          xScale="x"
          yScale="y"
        />
      </Viz.LinearScale>
    </Viz.LinearScale>,
  );
  runtime.flush();
  expect(arcs).toHaveBeenCalled();
  arcs.mockClear();
  data.set([
    { x: 4, y: null, censoring: "observed" },
    { x: Number.NaN, y: 20, censoring: "below" },
  ]);
  runtime.flush();
  expect(arcs).not.toHaveBeenCalled();
});

it("rejects invalid statuses and impossible logarithmic reporting limits", () => {
  runtime = testRuntime();
  runtime.mount(chart([{ x: 2, y: 20, censoring: "other" as never }]));
  expect(() => runtime.flush()).toThrow(/unknown censoring status/);
  runtime.dispose();

  runtime = testRuntime();
  runtime.mount(
    <Viz.LinearScale id="x" domain={[0, 10]} range={[0, 200]}>
      <Viz.LogScale id="y" domain={[0.1, 100]} range={[200, 0]}>
        <Viz.CensoredPointSeries
          data={[{ x: 2, y: 0, censoring: "below" as const }]}
          x="x"
          y="y"
          censoring="censoring"
          xScale="x"
          yScale="y"
        />
      </Viz.LogScale>
    </Viz.LinearScale>,
  );
  expect(() => runtime.flush()).toThrow(/positive|log/i);
});

it("accepts registered texture paints for observed circles and censored outlines", () => {
  runtime = testRuntime();
  const solid = defineTexture({
    create: () => undefined,
    rasterize: (_state, { canvas }) => {
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#087f8c";
      context.fillRect(0, 0, canvas.width, canvas.height);
    },
  });
  function TextureChart() {
    const paint = useTexture(solid({}), {
      resolution: { width: 8, height: 8 },
    });
    return (
      <Viz.LinearScale id="x" domain={[0, 10]} range={[0, 200]}>
        <Viz.LinearScale id="y" domain={[0, 100]} range={[200, 0]}>
          <Viz.CensoredPointSeries
            data={[
              { x: 2, y: 20, censoring: "observed" as const },
              { x: 4, y: 20, censoring: "below" as const },
            ]}
            x="x"
            y="y"
            censoring="censoring"
            xScale="x"
            yScale="y"
            style={{ fill: paint, stroke: paint }}
          />
        </Viz.LinearScale>
      </Viz.LinearScale>
    );
  }
  runtime.mount(<TextureChart />);
  expect(() => runtime.flush()).not.toThrow();
});

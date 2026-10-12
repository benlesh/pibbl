import { signal } from "@pibbl/core";
import { BaselineSeries, LinearScale, TradingTimeScale } from "@pibbl/core/viz";
import { useNumericInspection, type NumericInspectionRef } from "@pibbl/core/viz/inspection";
import { afterEach, expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";

let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it("splits linear fills and strokes at baseline crossings while capturing only original records", () => {
  runtime = testRuntime();
  const rows = [
    { x: 0, y: -1, id: "below" },
    { x: 5, y: 1, id: "above" },
    { x: 10, y: 0, id: "equal" },
    { x: 12, y: null, id: "gap" },
    { x: 15, y: 1, id: "single" },
  ];
  const moves = vi.spyOn(Path2D.prototype, "moveTo");
  const lines = vi.spyOn(Path2D.prototype, "lineTo");
  const baseline = signal(0);
  let inspection: NumericInspectionRef<(typeof rows)[number]>;
  function Series() {
    inspection = useNumericInspection({ data: rows, x: "x", y: "y" });
    return (
      <BaselineSeries
        data={rows}
        x="x"
        y="y"
        xScale="x"
        yScale="y"
        baseline={baseline}
        inspection={inspection}
        style={{
          above: { fill: "#00ff00", stroke: "#008800" },
          below: { fill: "#ff0000", stroke: "#880000" },
          fillOpacity: 1,
          strokeWidth: 2,
        }}
      />
    );
  }
  runtime.mount(
    <LinearScale id="x" domain={[0, 20]} range={[0, 200]}>
      <LinearScale id="y" domain={[-2, 2]} range={[100, 0]}>
        <Series />
      </LinearScale>
    </LinearScale>,
  );
  runtime.flush();

  expect(moves.mock.calls).toContainEqual([0, 75]);
  expect(lines.mock.calls).toContainEqual([25, 50]);
  expect(inspection!.rendered()!.observations.map((row) => row.datum)).toEqual([
    rows[0], rows[1], rows[2], rows[4],
  ]);
  expect(inspection!.rendered()!.observations.map((row) => row.run)).toEqual([
    0, 0, 0, 1,
  ]);
});

it("keeps zero-area runs unfilled, splits gaps, and validates a finite baseline", () => {
  runtime = testRuntime();
  const closes = vi.spyOn(Path2D.prototype, "closePath");
  runtime.mount(
    <LinearScale id="x" domain={[0, 10]} range={[0, 100]}>
      <LinearScale id="y" domain={[-1, 1]} range={[100, 0]}>
        <BaselineSeries
          data={[{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 6, y: null }, { x: 10, y: 1 }]}
          x="x"
          y="y"
          xScale="x"
          yScale="y"
          baseline={0}
        />
      </LinearScale>
    </LinearScale>,
  );
  runtime.flush();
  expect(closes).not.toHaveBeenCalled();
  runtime.dispose();
  runtime = testRuntime();
  runtime.mount(
    <LinearScale id="x" domain={[0, 1]} range={[0, 10]}>
      <LinearScale id="y" domain={[0, 1]} range={[10, 0]}>
        <BaselineSeries<{ x: number; y: number }> data={[]} x="x" y="y" xScale="x" yScale="y" baseline={Infinity} />
      </LinearScale>
    </LinearScale>,
  );
  expect(() => runtime.flush()).toThrow(/baseline.*finite/i);
});

it("preserves a finite midpoint for extreme crossings and accepts trading-time positions", () => {
  runtime = testRuntime();
  const lines = vi.spyOn(Path2D.prototype, "lineTo");
  const start = Date.UTC(2026, 0, 9);
  const end = Date.UTC(2026, 0, 12);
  runtime.mount(
    <TradingTimeScale id="time" timestamps={[start, end]} range={[0, 1]}>
      <LinearScale id="price" domain={[0, 1]} range={[1, 0]}>
        <BaselineSeries
          data={[
            { time: start, price: -Number.MAX_VALUE },
            { time: end, price: Number.MAX_VALUE },
          ]}
          x="time"
          y="price"
          xScale="time"
          yScale="price"
          baseline={0}
        />
      </LinearScale>
    </TradingTimeScale>,
  );
  runtime.flush();

  expect(lines.mock.calls).toContainEqual([0.5, 1]);
  expect(lines.mock.calls.flat().every(Number.isFinite)).toBe(true);
});

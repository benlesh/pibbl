import {
  LineSeries,
  LinearScale,
  PointScale,
  PointSeries,
  PlotSeries,
} from "@pibbl/core/viz";
import { Circle, Group, signal } from "@pibbl/core";
import { afterEach, expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
it("maps string and numeric category identities through line and point series", () => {
  runtime = testRuntime();
  const moves = vi.spyOn(Path2D.prototype, "moveTo"),
    lines = vi.spyOn(Path2D.prototype, "lineTo"),
    arcs = vi.spyOn(Path2D.prototype, "arc");
  const data = [
    { category: 1, value: 2 },
    { category: "1", value: 4 },
    { category: "A long category", value: 6 },
  ];
  runtime.mount(
    <PointScale
      id="category"
      domain={[1, "1", "A long category"]}
      range={[10, 110]}
    >
      <LinearScale id="value" domain={[0, 10]} range={[100, 0]}>
        <LineSeries
          data={data}
          x="category"
          y="value"
          xScale="category"
          yScale="value"
        />
        <PointSeries
          data={data}
          x="category"
          y="value"
          xScale="category"
          yScale="value"
        />
      </LinearScale>
    </PointScale>,
  );
  runtime.flush();
  expect(moves.mock.calls).toContainEqual([10, 80]);
  expect(lines.mock.calls).toEqual([
    [60, 60],
    [110, 40],
  ]);
  expect(arcs.mock.calls.map((c) => c.slice(0, 2))).toEqual([
    [10, 80],
    [10, 80],
    [60, 60],
    [60, 60],
    [110, 40],
    [110, 40],
  ]);
});
it("places original category records in keyed custom plots", () => {
  runtime = testRuntime();
  const seen: unknown[] = [];
  const data = [
    { id: "number", category: 1, value: 2 },
    { id: "string", category: "1", value: 4 },
  ];
  runtime.mount(
    <PointScale id="category" domain={[1, "1"]} range={[10, 110]}>
      <LinearScale id="value" domain={[0, 10]} range={[100, 0]}>
        <PlotSeries
          data={data}
          x="category"
          y="value"
          xScale="category"
          yScale="value"
          keyBy="id"
          render={(d) => {
            seen.push(d);
            return <Circle style={{ radius: 3 }} />;
          }}
        />
      </LinearScale>
    </PointScale>,
  );
  runtime.flush();
  expect(seen).toEqual(data);
});

it("rejects unknown point categories even when the unknown value is numeric", () => {
  runtime = testRuntime();
  runtime.mount(
    <PointScale id="category" domain={["known"]} range={[0, 100]}>
      <LinearScale id="value" domain={[0, 10]} range={[100, 0]}>
        <LineSeries
          data={[{ category: 2, value: 4 }]}
          x="category"
          y="value"
          xScale="category"
          yScale="value"
        />
      </LinearScale>
    </PointScale>,
  );
  expect(() => runtime.flush()).toThrow(/unknown point category 2 \(number\)/);
  expect(runtime.pending).toBe(0);
});

it("skips missing and non-finite positions, and does not read excluded category accessors", () => {
  runtime = testRuntime();
  const moves = vi.spyOn(Path2D.prototype, "moveTo"),
    lines = vi.spyOn(Path2D.prototype, "lineTo"),
    x = vi.fn((row: { category: number | string | null }) => row.category);
  runtime.mount(
    <PointScale id="category" domain={["A"]} range={[0, 100]}>
      <LinearScale id="value" domain={[0, 10]} range={[100, 0]}>
        <LineSeries
          data={[
            { category: "A", value: 2 },
            { category: 2, value: 4 },
            { category: null, value: 5 },
            { category: "A", value: NaN },
            { category: "A", value: 6 },
          ]}
          x={x}
          y="value"
          xScale="category"
          yScale="value"
          defined={(_, index) => index !== 1}
        />
      </LinearScale>
    </PointScale>,
  );
  runtime.flush();
  expect(x).toHaveBeenCalledTimes(4);
  expect(moves).not.toHaveBeenCalled();
  expect(lines).not.toHaveBeenCalled();
});

it("replaces point domains and data signals, then releases both on disposal", () => {
  runtime = testRuntime();
  const domain = signal<readonly (string | number)[]>(["A", "B"]),
    data = signal<readonly { category: string; value: number }[]>([
      { category: "A", value: 2 },
      { category: "B", value: 8 },
    ]);
  const moves = vi.spyOn(Path2D.prototype, "moveTo"),
    lines = vi.spyOn(Path2D.prototype, "lineTo");
  runtime.mount(
    <PointScale id="category" domain={domain} range={[0, 100]}>
      <LinearScale id="value" domain={[0, 10]} range={[100, 0]}>
        <LineSeries
          data={data}
          x="category"
          y="value"
          xScale="category"
          yScale="value"
        />
      </LinearScale>
    </PointScale>,
  );
  runtime.flush();
  expect(moves.mock.calls).toEqual([[0, 80]]);
  expect(lines.mock.calls).toEqual([[100, 20]]);
  moves.mockClear();
  lines.mockClear();
  domain.set(["B", "A"]);
  data.set([
    { category: "B", value: 3 },
    { category: "A", value: 7 },
  ]);
  runtime.flush();
  expect(moves.mock.calls).toEqual([[0, 70]]);
  expect(lines.mock.calls).toEqual([[100, 30]]);
  runtime.dispose();
  domain.set(["A"]);
  data.set([{ category: "A", value: 2 }]);
  expect(runtime.pending).toBe(0);
});

it("uses reversed point positions within nested scales and transformed composition", () => {
  runtime = testRuntime();
  const moves = vi.spyOn(Path2D.prototype, "moveTo"),
    lines = vi.spyOn(Path2D.prototype, "lineTo");
  runtime.mount(
    <Group style={{ translateX: 20, translateY: 10, scaleX: 2 }}>
      <PointScale id="category" domain={["A", "B"]} range={[0, 100]} reverse>
        <LinearScale id="value" domain={[0, 10]} range={[100, 0]} reverse>
          <LineSeries
            data={[
              { category: "A", value: 2 },
              { category: "B", value: 8 },
            ]}
            x="category"
            y="value"
            xScale="category"
            yScale="value"
          />
        </LinearScale>
      </PointScale>
    </Group>,
  );
  runtime.flush();
  expect(moves.mock.calls).toEqual([[100, 20]]);
  expect(lines.mock.calls).toEqual([[0, 80]]);
});

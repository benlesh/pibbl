import { signal } from "@pibbl/core";
import * as Viz from "@pibbl/core/viz";
import { afterEach, expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";

let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it("exports paired connectors in source paint order and updates reactively", () => {
  expect(Viz).toHaveProperty("PairedSeries");
  runtime = testRuntime();
  const moves = vi.spyOn(Path2D.prototype, "moveTo");
  const lines = vi.spyOn(Path2D.prototype, "lineTo");
  const data = signal([
    { before: 20, after: 40 },
    { before: null, after: 60 },
    { before: 70, after: 30 },
  ]);
  runtime.mount(
    <Viz.PointScale
      id="visit"
      domain={["baseline", "week 8"]}
      range={[20, 180]}
    >
      <Viz.LinearScale id="outcome" domain={[0, 100]} range={[100, 0]}>
        <Viz.PairedSeries
          data={data}
          before="before"
          after="after"
          beforeX="baseline"
          afterX="week 8"
          xScale="visit"
          yScale="outcome"
        />
      </Viz.LinearScale>
    </Viz.PointScale>,
  );
  runtime.flush();
  expect(moves.mock.calls).toContainEqual([20, 80]);
  expect(lines.mock.calls).toContainEqual([180, 60]);
  expect(moves.mock.calls).toContainEqual([20, 30]);
  expect(lines.mock.calls).toContainEqual([180, 70]);
  data.set([{ before: 20, after: 80 }]);
  moves.mockClear();
  lines.mockClear();
  runtime.flush();
  expect(lines.mock.calls).toContainEqual([180, 20]);
});

it("omits incomplete pairs before drawing", () => {
  runtime = testRuntime();
  const moves = vi.spyOn(Path2D.prototype, "moveTo");
  runtime.mount(
    <Viz.LinearScale id="x" domain={[0, 1]} range={[0, 100]}>
      <Viz.LinearScale id="y" domain={[0, 1]} range={[100, 0]}>
        <Viz.PairedSeries
          data={[{ before: null, after: 1 }]}
          before="before"
          after="after"
          beforeX={0}
          afterX={1}
          xScale="x"
          yScale="y"
        />
      </Viz.LinearScale>
    </Viz.LinearScale>,
  );
  runtime.flush();
  expect(moves).not.toHaveBeenCalled();
});

it("skips excluded accessors, rejects unknown point endpoints, and omits non-finite outcomes", () => {
  runtime = testRuntime();
  const before = vi.fn(() => {
    throw new Error("excluded before was read");
  });
  runtime.mount(
    <Viz.LinearScale id="x" domain={[0, 1]} range={[0, 100]}>
      <Viz.LinearScale id="y" domain={[0, 1]} range={[100, 0]}>
        <Viz.PairedSeries
          data={[{ before: 0, after: 1 }]}
          before={before}
          after="after"
          beforeX={0}
          afterX={1}
          xScale="x"
          yScale="y"
          defined={() => false}
        />
      </Viz.LinearScale>
    </Viz.LinearScale>,
  );
  expect(() => runtime.flush()).not.toThrow();
  expect(before).not.toHaveBeenCalled();
  runtime.dispose();
  runtime = testRuntime();
  runtime.mount(
    <Viz.PointScale id="visit" domain={["baseline"]} range={[0, 100]}>
      <Viz.LinearScale id="y" domain={[0, 1]} range={[100, 0]}>
        <Viz.PairedSeries
          data={[] as { before: number; after: number }[]}
          before="before"
          after="after"
          beforeX="baseline"
          afterX="missing"
          xScale="visit"
          yScale="y"
        />
      </Viz.LinearScale>
    </Viz.PointScale>,
  );
  expect(() => runtime.flush()).toThrow(/unknown point category/);
  runtime.dispose();
  runtime = testRuntime();
  const moves = vi.spyOn(Path2D.prototype, "moveTo");
  runtime.mount(
    <Viz.LinearScale id="x" domain={[0, 1]} range={[0, 100]}>
      <Viz.LinearScale id="y" domain={[0, 1]} range={[100, 0]}>
        <Viz.PairedSeries
          data={[{ before: Number.NaN, after: 1 }]}
          before="before"
          after="after"
          beforeX={0}
          afterX={1}
          xScale="x"
          yScale="y"
        />
      </Viz.LinearScale>
    </Viz.LinearScale>,
  );
  runtime.flush();
  expect(moves).not.toHaveBeenCalled();
});

import { signal } from "@crc/core";
import * as Viz from "@crc/core/viz";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
function context() {
  runtime = testRuntime();
  const snapshots = new Map<string, Viz.ResolvedLinearScale>();
  function Read() {
    snapshots.set("x", Viz.useScale("x").get());
    snapshots.set("y", Viz.useScale("y").get());
    return null;
  }
  runtime.mount(
    <Viz.Scale id="x" type="linear" domain={[0, 10]} range={[0, 100]}>
      <Viz.Scale id="y" type="linear" domain={[0, 10]} range={[100, 0]}>
        <Read />
      </Viz.Scale>
    </Viz.Scale>,
  );
  runtime.flush();
  return { scale: (id: Viz.ScaleId) => snapshots.get(String(id))! };
}
it("returns an ordinary lazy function selecting one original point across named series", () => {
  expect(Viz.closestPoint).toBeTypeOf("function");
  const ctx = context();
  const a = { x: 2, y: 3 },
    b = { x: 8, y: 9 };
  let reads = 0;
  const series = {
    A: Viz.defineSeries({
      data: [a],
      x: (d) => {
        reads++;
        return d.x;
      },
      y: "y",
    }),
    B: Viz.defineSeries({ data: [b], x: "x", y: "y" }),
  };
  const position = signal<{ x: number; y: number } | null>({ x: 23, y: 74 });
  const query = Viz.closestPoint({
    series,
    position,
    xScale: "x",
    yScale: "y",
    maxDistance: 5,
  });
  expect(query).toBeTypeOf("function");
  expect(reads).toBe(0);
  const hit = query(ctx);
  expect(hit).toEqual({
    series: "A",
    datum: a,
    index: 0,
    x: 2,
    y: 3,
    anchor: { x: 20, y: 70 },
    distance: 5,
  });
  expect(hit?.datum).toBe(a);
  expect(
    Viz.closestPoint({
      series,
      position,
      xScale: "x",
      yScale: "y",
      maxDistance: 4,
    })(ctx),
  ).toBeUndefined();
  position.set(null);
  expect(query(ctx)).toBeUndefined();
});
it("distinguishes recorded nearest observations from estimates at a shared x", () => {
  expect(Viz.closestX).toBeTypeOf("function");
  expect(Viz.interpolateX).toBeTypeOf("function");
  const ctx = context(),
    data = [
      { x: 0, y: 10 },
      { x: 10, y: 30 },
    ];
  const series = Viz.defineSeries({ data, x: "x", y: "y" });
  const base = { series, x: 5, xScale: "x", yScale: "y" };
  expect(Viz.closestX({ ...base, maxDelta: 5 })(ctx)).toEqual({
    datum: data[0],
    index: 0,
    x: 0,
    y: 10,
    anchor: { x: 0, y: 0 },
    delta: 5,
  });
  expect(Viz.closestX({ ...base, maxDelta: 4 })(ctx)).toBeUndefined();
  const interpolate = { ...base, interpolation: Viz.linearInterpolation() };
  expect(Viz.interpolateX({ ...interpolate, maxGap: 10 })(ctx)).toEqual({
    kind: "interpolated",
    x: 5,
    y: 20,
    before: data[0],
    after: data[1],
    beforeIndex: 0,
    afterIndex: 1,
    fraction: 0.5,
    anchor: { x: 50, y: -100 },
  });
  expect(Viz.interpolateX({ ...interpolate, maxGap: 9 })(ctx)).toBeUndefined();
  expect(Viz.interpolateX({ ...interpolate, x: 10, maxGap: 0 })(ctx)).toEqual({
    kind: "exact",
    datum: data[1],
    index: 1,
    x: 10,
    y: 30,
    anchor: { x: 100, y: -200 },
  });
  expect(
    Viz.interpolateX({ ...interpolate, interpolation: (before) => before })(ctx)
      ?.y,
  ).toBe(10);
  expect(Viz.interpolateX({ ...interpolate, x: 11 })(ctx)).toBeUndefined();
});
it("preserves gaps and validates ordering and duplicate policy before exact matches", () => {
  expect(Viz.interpolateX).toBeTypeOf("function");
  const ctx = context();
  function query(
    data: readonly { x: number; y: number | null }[],
    x = 5,
    duplicateX: "error" | "first" | "last" = "error",
  ) {
    return Viz.interpolateX({
      series: Viz.defineSeries({ data, x: "x", y: "y" }),
      x,
      xScale: "x",
      yScale: "y",
      interpolation: Viz.linearInterpolation(),
      duplicateX,
    })(ctx);
  }
  expect(
    query([
      { x: 0, y: 10 },
      { x: 5, y: null },
      { x: 10, y: 30 },
    ]),
  ).toBeUndefined();
  expect(() =>
    query(
      [
        { x: 0, y: 10 },
        { x: 10, y: 30 },
        { x: 9, y: 20 },
      ],
      0,
    ),
  ).toThrow(/order|increasing/);
  const duplicates = [
    { x: 0, y: 10 },
    { x: 0, y: 20 },
    { x: 10, y: 30 },
  ];
  expect(() => query(duplicates, 0)).toThrow(/duplicate/i);
  expect(query(duplicates, 0, "first")?.y).toBe(10);
  expect(query(duplicates, 0, "last")?.y).toBe(20);
  expect(query(duplicates, 5, "last")?.y).toBe(25);
});
it("keeps source indices and stable record order without evaluating undefined rows", () => {
  const ctx = context();
  const rejected = { x: 0, y: 0 };
  let calls = 0;
  const series = Viz.defineSeries({
    data: [rejected, { x: 2, y: 3 }, { x: 2, y: 3 }],
    defined: (_, i) => i > 0,
    x: (d) => {
      calls++;
      return d.x;
    },
    y: "y",
  });
  const hit = Viz.closestPoint({
    series: { first: series, second: series },
    position: { x: 20, y: 70 },
    xScale: "x",
    yScale: "y",
    maxDistance: 0,
  })(ctx);
  expect(hit?.series).toBe("first");
  expect(hit?.index).toBe(1);
  expect(calls).toBe(4);
});
it.each([NaN, Infinity, -1])("rejects invalid query limits %s", (value) => {
  const ctx = context(),
    series = Viz.defineSeries({ data: [{ x: 0, y: 0 }], x: "x", y: "y" });
  expect(() =>
    Viz.closestPoint({
      series: { one: series },
      position: { x: 0, y: 0 },
      xScale: "x",
      yScale: "y",
      maxDistance: value,
    })(ctx),
  ).toThrow();
  expect(() =>
    Viz.closestX({ series, x: 0, xScale: "x", yScale: "y", maxDelta: value })(
      ctx,
    ),
  ).toThrow();
  expect(() =>
    Viz.interpolateX({
      series,
      x: 0,
      xScale: "x",
      yScale: "y",
      maxGap: value,
      interpolation: Viz.linearInterpolation(),
    })(ctx),
  ).toThrow();
});
it("handles empty data, missing x gaps, exceptions, and nonfinite interpolation results", () => {
  const ctx = context();
  const base = {
    x: 5,
    xScale: "x",
    yScale: "y",
    interpolation: Viz.linearInterpolation(),
  };
  expect(
    Viz.closestX({
      series: Viz.defineSeries({
        data: [] as { x: number; y: number }[],
        x: "x",
        y: "y",
      }),
      x: 1,
      xScale: "x",
      yScale: "y",
    })(ctx),
  ).toBeUndefined();
  const gap = Viz.defineSeries({
    data: [
      { x: 0, y: 0 },
      { x: null, y: 1 },
      { x: 10, y: 10 },
    ],
    x: "x",
    y: "y",
  });
  expect(Viz.interpolateX({ ...base, series: gap })(ctx)).toBeUndefined();
  const series = Viz.defineSeries({
    data: [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ],
    x: "x",
    y: "y",
  });
  expect(() =>
    Viz.interpolateX({ ...base, series, interpolation: () => NaN })(ctx),
  ).toThrow(/finite/);
  expect(() =>
    Viz.closestX({ series, x: Infinity, xScale: "x", yScale: "y" })(ctx),
  ).toThrow(/finite/);
  expect(() =>
    Viz.closestPoint({
      series: { one: series },
      position: { x: NaN, y: 0 },
      xScale: "x",
      yScale: "y",
    })(ctx),
  ).toThrow(/finite/);
});

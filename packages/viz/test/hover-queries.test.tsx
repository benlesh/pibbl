import { signal } from "@crc/core";
import * as Viz from "@crc/viz";
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

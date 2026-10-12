import { afterEach, expect, it } from "vitest";
import mount from "../../../../scenarios/src/learning/composition/viz-population-stack.example.js";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
type Options = NonNullable<Parameters<typeof mount>[1]>;
type Rows = Parameters<NonNullable<Options["onRows"]>>[0];
function inspect(options: Options): Rows {
  runtime = testRuntime();
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 400;
  document.body.append(canvas);
  let output: Rows = [];
  const app = mount(canvas, {
    ...options,
    onRows: (rows) => {
      output = rows;
    },
  });
  try {
    runtime.flush();
    return output;
  } finally {
    app.dispose();
    runtime.dispose();
  }
}
it("keeps population totals explicit and normalizes only the three displayed states", () => {
  const absolute = inspect({ normalized: false }),
    percent = inspect({ normalized: true });
  expect(
    absolute.filter((d) => d.year === "2023").map((d) => [d.start, d.end]),
  ).toEqual([
    [0, 38965193],
    [38965193, 69468494],
    [69468494, 92079220],
  ]);
  for (const year of ["2020", "2022", "2023"]) {
    const rows = percent.filter((d) => d.year === year);
    expect(rows[0].start).toBe(0);
    expect(rows.at(-1)!.end).toBeCloseTo(100, 12);
    for (let i = 1; i < rows.length; i++)
      expect(rows[i].start).toBe(rows[i - 1].end);
    expect(rows.reduce((s, d) => s + d.value, 0)).toBe(rows[0].total);
  }
  expect(
    percent.find((d) => d.year === "2023" && d.state === "Florida")!.share,
  ).toBeCloseTo((22610726 / 92079220) * 100, 12);
});
it("rejects incomplete/negative input and represents an all-zero total without division", () => {
  expect(() =>
    inspect({
      rows: [{ year: "zero", state: "X", value: NaN, color: "red" }],
      normalized: true,
    }),
  ).toThrow();
  expect(() =>
    inspect({
      rows: [{ year: "negative", state: "X", value: -1, color: "red" }],
      normalized: true,
    }),
  ).toThrow();
  expect(
    inspect({
      rows: [{ year: "2020", state: "X", value: 0, color: "red" }],
      normalized: true,
    })[0],
  ).toMatchObject({ start: 0, end: 0, share: 0, total: 0 });
});

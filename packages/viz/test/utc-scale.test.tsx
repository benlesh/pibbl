import {
  Axis,
  Scale,
  extent,
  niceDomain,
  useScale,
  type ResolvedUtcScale,
} from "@crc/viz";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";

let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it("exposes bounded UTC mapping, labels, and pure domain helpers", () => {
  const start = Date.UTC(2026, 0, 15, 12);
  const end = Date.UTC(2026, 2, 20, 12);
  let scale: ResolvedUtcScale | undefined;
  function Capture() {
    scale = useScale("utc", "utc").get();
    return <Axis scale="utc" position="bottom" tickCount={5} />;
  }
  runtime = testRuntime();
  runtime.mount(
    <Scale id="utc" type="utc" domain={[start, end]} range={[0, 320]}>
      <Capture />
    </Scale>,
  );
  runtime.flush();

  expect(scale?.map(start)).toBe(0);
  expect(scale?.map(end)).toBe(320);
  expect(scale?.invert(160)).toBe((start + end) / 2);
  expect(scale?.ticks(5).length).toBeGreaterThanOrEqual(2);
  expect(scale?.ticks(5).length).toBeLessThanOrEqual(5);
  expect(scale?.ticks(5).every((value) => value >= start && value <= end)).toBe(
    true,
  );
  expect(scale?.formatTick(start)).toBe(new Date(start).toISOString());
  expect(scale?.ticks(2)).toEqual([start, end]);
  expect(
    extent([{ value: 3 }, { value: null }, { value: 9 }], (row) => row.value),
  ).toEqual([3, 9]);
  expect(niceDomain([start, start], { type: "utc" })).toEqual([
    start - 1,
    start + 1,
  ]);
});

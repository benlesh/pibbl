import { signal, type Signal } from "@pibbl/core";
import { Axis, LogScale, LinearScale, LineSeries, PointSeries, useLogScale, nearestDomainValue, type ResolvedLogScale } from "@pibbl/core/viz";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
it("maps equal ratios to equal distances through the dedicated public provider and hook", () => {
  runtime = testRuntime();
  const domain = signal<readonly [number, number]>([1, 1000]);
  let saved!: Signal<ResolvedLogScale>;
  const snapshots: ResolvedLogScale[] = [];
  function Probe() { const value = useLogScale("mass"); saved ??= value; expect(value).toBe(saved); snapshots.push(value.get()); }
  runtime.mount(<LogScale id="mass" domain={domain} range={[0, 300]}><Probe /><Axis scale="mass" position="bottom" /></LogScale>);
  runtime.flush();
  const scale = saved.get();
  expect(scale.map(10)).toBeCloseTo(100); expect(scale.map(100)).toBeCloseTo(200);
  expect(scale.invert(150)).toBeCloseTo(Math.sqrt(1000));
  expect(scale.ticks(4)).toEqual([1, 10, 100, 1000]);
  expect(nearestDomainValue([1, 10, 100], 110, scale)).toBe(10);
  expect(() => scale.map(0)).toThrow(/positive/);
  expect(() => scale.map(-1)).toThrow(/positive/);
  domain.set([1000, 1]); runtime.flush();
  expect(saved.get().map(10)).toBeCloseTo(200);
  expect(saved.get().ticks(4)).toEqual([1000, 100, 10, 1]);
  expect(snapshots).toHaveLength(2);
  runtime.dispose(); domain.set([1, 10]); expect(runtime.pending).toBe(0);
});
it("works with existing public line and point marks", () => {
  runtime = testRuntime();
  runtime.mount(<LogScale id="x" domain={[1, 100]} range={[0, 200]}>
    <LinearScale id="y" domain={[0, 10]} range={[100, 0]}>
      <LineSeries data={[{x: 1, y: 1}, {x: 100, y: 9}]} x="x" y="y" xScale="x" yScale="y" />
      <PointSeries data={[{x: 10, y: 5}]} x="x" y="y" xScale="x" yScale="y" />
    </LinearScale>
  </LogScale>);
  expect(() => runtime.flush()).not.toThrow();
});
it("validates domains, tick counts, base changes, and collapsed inversion", () => {
  runtime = testRuntime();
  const base = signal(10);
  let current!: ResolvedLogScale;
  function Probe() { current = useLogScale("x").get(); }
  runtime.mount(<LogScale id="x" domain={[1, 100]} range={[20, 20]} base={base}><Probe /></LogScale>);
  runtime.flush(); expect(current.map(10)).toBe(20);
  expect(() => current.invert(20)).toThrow(/collapsed/);
  expect(() => current.ticks(1)).toThrow(/count/);
  base.set(2); runtime.flush(); expect(current.base).toBe(2);
  expect(current.ticks(4)).toEqual([1, 2, 16, 100]);
  runtime.dispose();
  for (const domain of [[0, 100], [-100, -1], [1, 1], [1, Infinity]] as const) {
    runtime = testRuntime();
    runtime.mount(<LogScale id="x" domain={domain} range={[0, 100]}><Probe /></LogScale>);
    expect(() => runtime.flush()).toThrow(RangeError); runtime.dispose();
  }
});

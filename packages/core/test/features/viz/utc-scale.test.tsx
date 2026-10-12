import { Overlay, signal } from "@pibbl/core";
import { Axis, LineSeries, extent, niceUTCDomain, useUTCScale, UTCScale, LinearScale } from "@pibbl/core/viz";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it("maps UTC observations, generates calendar boundaries and updates consumers", () => {
  runtime = testRuntime();
  const start = Date.UTC(2020, 0, 15), end = Date.UTC(2020, 3, 15);
  const domain = signal<readonly [number, number]>([start, end]);
  const seen: number[][] = [];
  function Probe() {
    const utc = useUTCScale("date").get();
    const continuous = useUTCScale("date").get();
    expect(utc.formatTick(start)).toBe("2020-01-15T00:00:00.000Z");
    expect(continuous.map(start)).toBe(0);
    seen.push([...utc.ticks(5)]);
    expect(utc.invert(utc.map(Date.UTC(2020, 1, 29)))).toBe(Date.UTC(2020, 1, 29));
  }
  runtime.mount(<Overlay style={{ width: 400, height: 180 }}>
    <UTCScale style={{ width: 400, height: 180 }} id="date"  domain={domain} range="width">
      <LinearScale id="value"  domain={[0, 10]} range="height" reverse>
        <Probe />
        <Axis scale="date" position="bottom" tickCount={5} />
        <LineSeries data={[{ t: start, v: 2 }, { t: end, v: 8 }]} x="t" y="v" xScale="date" yScale="value" />
      </LinearScale>
    </UTCScale>
  </Overlay>);
  runtime.flush();
  expect(seen[0]).toEqual([start, Date.UTC(2020, 1, 1), Date.UTC(2020, 2, 1), Date.UTC(2020, 3, 1), end]);
  domain.set([start, Date.UTC(2021, 0, 15)]);
  runtime.flush();
  expect(seen).toHaveLength(2);
});

it("derives immutable extents and outward UTC calendar domains without coercion", () => {
  const start = Date.UTC(2020, 0, 15), end = Date.UTC(2020, 3, 15);
  const domain = extent([null, end, start, undefined], value => value);
  expect(domain).toEqual([start, end]);
  expect(Object.isFrozen(domain)).toBe(true);
  expect(niceUTCDomain(domain!, { count: 5 })).toEqual([Date.UTC(2020, 0, 1), Date.UTC(2020, 4, 1)]);
  expect(niceUTCDomain([-8_640_000_000_000_000, 8_640_000_000_000_000], { count: 2 })).toEqual([-8_640_000_000_000_000, 8_640_000_000_000_000]);
  expect(extent([], value => value)).toBeUndefined();
  expect(() => extent([NaN], value => value)).toThrow();
});

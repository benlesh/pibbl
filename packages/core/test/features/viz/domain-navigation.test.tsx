import { signal } from "@pibbl/core";
import {
  LinearScale,
  UTCScale,
  LogScale,
  SymlogScale,
  useLinearScale,
  useUTCScale,
  useLogScale,
  useSymlogScale,
  panDomain,
  zoomDomain,
  type ResolvedContinuousScale,
} from "@pibbl/core/viz";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
it("zooms at an invariant data anchor and pans in mapped space for all continuous families", () => {
  runtime = testRuntime();
  const results: ResolvedContinuousScale[] = [];
  function Linear() {
    results.push(useLinearScale("linear").get());
    return null;
  }
  function UTC() {
    results.push(useUTCScale("utc").get());
    return null;
  }
  function Log() {
    results.push(useLogScale("log").get());
    return null;
  }
  function Symlog() {
    results.push(useSymlogScale("symlog").get());
    return null;
  }
  runtime.mount(
    <>
      <LinearScale id="linear" domain={[20, 80]} range={[0, 600]}>
        <Linear />
      </LinearScale>
      <UTCScale id="utc" domain={[20000, 80000]} range={[0, 600]}>
        <UTC />
      </UTCScale>
      <LogScale id="log" domain={[10, 1000]} range={[0, 600]}>
        <Log />
      </LogScale>
      <SymlogScale id="symlog" domain={[-50, 50]} range={[0, 600]} constant={1}>
        <Symlog />
      </SymlogScale>
    </>,
  );
  runtime.flush();
  const bounds = [
    [0, 100],
    [0, 100000],
    [1, 10000],
    [-1000, 1000],
  ] as const;
  for (let i = 0; i < results.length; i++) {
    const scale = results[i],
      constraints = { bounds: bounds[i] };
    const zoom = zoomDomain(scale, {
      ...constraints,
      rangeAnchor: 150,
      factor: 2,
    });
    expect(scale.map(zoom[0])).toBeCloseTo(75, 6);
    expect(scale.map(zoom[1])).toBeCloseTo(375, 6);
    const pan = panDomain(scale, { ...constraints, rangeDelta: 60 });
    expect(scale.map(pan[0])).toBeCloseTo(-60, 6);
    expect(scale.map(pan[1])).toBeCloseTo(540, 6);
    expect(Object.isFrozen(zoom)).toBe(true);
  }
});
it("rejects fractional UTC hard bounds before rounding navigation endpoints", () => {
  runtime = testRuntime();
  let scale: ResolvedContinuousScale | undefined;
  function Probe() {
    scale = useUTCScale("utc").get();
    return null;
  }
  runtime.mount(
    <UTCScale id="utc" domain={[20_000, 80_000]} range={[0, 600]}>
      <Probe />
    </UTCScale>,
  );
  runtime.flush();
  expect(() =>
    zoomDomain(scale!, {
      ...{ bounds: [0.5, 100_000.5] },
      rangeAnchor: 300,
      factor: 2,
    }),
  ).toThrow(/safe integer/i);
});
it("preserves source direction with descending domains and reversed ranges", () => {
  runtime = testRuntime();
  let descending: ResolvedContinuousScale | undefined,
    reversed: ResolvedContinuousScale | undefined;
  function Descending() {
    descending = useLinearScale("descending").get();
    return null;
  }
  function Reversed() {
    reversed = useLinearScale("reversed").get();
    return null;
  }
  runtime.mount(
    <>
      <LinearScale id="descending" domain={[80, 20]} range={[0, 600]}>
        <Descending />
      </LinearScale>
      <LinearScale id="reversed" domain={[20, 80]} range={[0, 600]} reverse>
        <Reversed />
      </LinearScale>
    </>,
  );
  runtime.flush();
  const bounds = { bounds: [0, 100] as const },
    descended = zoomDomain(descending!, {
      ...bounds,
      rangeAnchor: 150,
      factor: 2,
    }),
    reversedZoom = zoomDomain(reversed!, {
      ...bounds,
      rangeAnchor: 150,
      factor: 2,
    });
  expect(descended[0]).toBeGreaterThan(descended[1]);
  expect(descending!.map(descended[0])).toBeCloseTo(75, 6);
  expect(descending!.map(descended[1])).toBeCloseTo(375, 6);
  expect(reversedZoom[0]).toBeLessThan(reversedZoom[1]);
  expect(reversed!.map(reversedZoom[0])).toBeCloseTo(375, 6);
  expect(reversed!.map(reversedZoom[1])).toBeCloseTo(75, 6);
});
it("reverses an unconstrained zoom and clamps pan and minimum span in mapped bounds", () => {
  runtime = testRuntime();
  const domain = signal<readonly [number, number]>([20, 80]);
  let scale: ResolvedContinuousScale | undefined;
  function Probe() {
    scale = useLinearScale("linear").get();
    return null;
  }
  runtime.mount(
    <LinearScale id="linear" domain={domain} range={[0, 600]}>
      <Probe />
    </LinearScale>,
  );
  runtime.flush();
  const constraints = { bounds: [0, 100] as const },
    inward = zoomDomain(scale!, {
      ...constraints,
      rangeAnchor: 300,
      factor: 2,
    });
  domain.set(inward);
  runtime.flush();
  const outward = zoomDomain(scale!, {
    ...constraints,
    rangeAnchor: 300,
    factor: 0.5,
  });
  expect(outward[0]).toBeCloseTo(20, 10);
  expect(outward[1]).toBeCloseTo(80, 10);
  const minimum = zoomDomain(scale!, {
    ...{
      ...constraints,
      minimumSpanRatio: 0.1,
    },
    rangeAnchor: 300,
    factor: 10_000,
  });
  expect(Math.abs(scale!.map(minimum[1]) - scale!.map(minimum[0]))).toBeCloseTo(
    200,
    8,
  );
  const left = panDomain(scale!, {
      ...constraints,
      rangeDelta: Number.MAX_VALUE,
    }),
    right = panDomain(scale!, {
      ...constraints,
      rangeDelta: -Number.MAX_VALUE,
    });
  expect(left).toEqual([0, 30]);
  expect(right).toEqual([70, 100]);
  expect(Object.isFrozen(left)).toBe(true);
});
it("rejects invalid navigation inputs and collapsed mapped geometry", () => {
  runtime = testRuntime();
  let scale: ResolvedContinuousScale | undefined;
  function Probe() {
    scale = useLinearScale("linear").get();
    return null;
  }
  runtime.mount(
    <LinearScale id="linear" domain={[20, 80]} range={[0, 600]}>
      <Probe />
    </LinearScale>,
  );
  runtime.flush();
  const constraints = { bounds: [0, 100] as const };
  expect(() =>
    panDomain(scale!, { ...constraints, rangeDelta: Infinity }),
  ).toThrow(/finite/i);
  expect(() =>
    zoomDomain(scale!, { ...constraints, rangeAnchor: 300, factor: 0 }),
  ).toThrow(/positive/i);
  expect(() =>
    zoomDomain(scale!, { ...constraints, rangeAnchor: 300, factor: NaN }),
  ).toThrow(/finite/i);
  expect(() =>
    zoomDomain(scale!, {
      ...{ ...constraints, minimumSpanRatio: 0 },
      rangeAnchor: 300,
      factor: 2,
    }),
  ).toThrow(/minimumSpanRatio/i);
  expect(() =>
    zoomDomain(scale!, {
      ...{ ...constraints, minimumSpanRatio: 1.01 },
      rangeAnchor: 300,
      factor: 2,
    }),
  ).toThrow(/minimumSpanRatio/i);
  expect(() =>
    zoomDomain(scale!, { ...{ bounds: [1, 1] }, rangeAnchor: 300, factor: 2 }),
  ).toThrow(/nonzero/i);
  expect(() =>
    panDomain({ ...scale!, range: [0, 0] }, { ...constraints, rangeDelta: 10 }),
  ).toThrow(/noncollapsed/i);
});

it("navigates a normalized range without pixel units", () => {
  runtime = testRuntime();
  let scale: ResolvedContinuousScale | undefined;
  function Probe() {
    scale = useLinearScale("normalized").get();
    return null;
  }
  runtime.mount(
    <LinearScale id="normalized" domain={[20, 80]} range={[-1, 1]}>
      <Probe />
    </LinearScale>,
  );
  runtime.flush();
  const pan = panDomain(scale!, { rangeDelta: 1 / 3, bounds: [0, 100] });
  expect(pan[0]).toBeCloseTo(10);
  expect(pan[1]).toBeCloseTo(70);
  expect(
    zoomDomain(scale!, { rangeAnchor: 0, factor: 2, bounds: [0, 100] }),
  ).toEqual([35, 65]);
});

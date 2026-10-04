import { Absolute, Layer, crc, signal, type Signal } from "@crc/core";
import { Scale, useScale, type ResolvedLinearScale } from "@crc/core/viz";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it.each([
  { domain: [0, 10], range: [0, 240], reverse: false },
  { domain: [10, 0], range: [20, 260], reverse: false },
  { domain: [-2.5, 7.5], range: [-30, 170], reverse: true },
  { domain: [0.125, 0.625], range: [180, -20], reverse: true },
] as const)("round-trips finite linear coordinates with explicit tolerances: %j", ({ domain, range, reverse }) => {
  runtime = testRuntime();
  const fractions = [-0.25, 0, 0.125, 0.5, 1, 1.25];
  const domainTolerance = Math.abs(domain[1] - domain[0]) * 1e-12;
  const pixelTolerance = Math.abs(range[1] - range[0]) * 1e-12;
  let checked = 0;
  function Probe() {
    const scale = useScale("round-trip").get();
    const start = reverse ? range[1] : range[0];
    const end = reverse ? range[0] : range[1];
    for (const fraction of fractions) {
      // Fixture arithmetic does not derive the expected position from map/invert.
      const value = domain[0] + fraction * (domain[1] - domain[0]);
      const pixel = start + fraction * (end - start);
      expect(Math.abs(scale.map(value) - pixel)).toBeLessThanOrEqual(pixelTolerance);
      expect(Math.abs(scale.invert(pixel) - value)).toBeLessThanOrEqual(domainTolerance);
      expect(Math.abs(scale.invert(scale.map(value)) - value)).toBeLessThanOrEqual(domainTolerance);
      expect(Math.abs(scale.map(scale.invert(pixel)) - pixel)).toBeLessThanOrEqual(pixelTolerance);
      checked++;
    }
  }
  runtime.mount(
    <Scale id="round-trip" type="linear" domain={domain} range={range} reverse={reverse}>
      <Probe />
    </Scale>,
  );
  runtime.flush();
  expect(checked).toBe(fractions.length);
});

it("maps local allocations and updates the same scale signal during reflow", () => {
  runtime = testRuntime();
  const domain = signal<readonly [number, number]>([0, 10]);
  const identities: Signal<ResolvedLinearScale>[] = [];
  const values: number[][] = [];
  function Probe() {
    const x = useScale("x");
    const y = useScale("y");
    identities.push(x);
    values.push([x.get().map(5), y.get().map(25), x.get().frame.width]);
  }
  function Scene({ width }: { width: number }) {
    return (
      <Absolute>
        <Scale
          id="x"
          type="linear"
          domain={domain}
          range="width"
          style={{ width, height: width / 2 }}
        >
          <Scale id="y" type="linear" domain={[0, 100]} range="height" reverse>
            <Probe />
          </Scale>
        </Scale>
      </Absolute>
    );
  }
  const canvas = runtime.mount(<Scene width={240} />);
  runtime.flush();
  expect(values.at(-1)).toEqual([120, 90, 240]);
  expect(identities[0].get().ticks(3)).toEqual([0, 5, 10]);
  crc(canvas, <Scene width={360} />);
  runtime.flush();
  expect(values.at(-1)).toEqual([180, 135, 360]);
  expect(identities.at(-1)).toBe(identities[0]);
  domain.set([0, 20]);
  runtime.flush();
  expect(values.at(-1)).toEqual([90, 135, 360]);
});

it("restores shadowed scopes and rolls back a failed candidate", () => {
  runtime = testRuntime();
  const captured: Signal<ResolvedLinearScale>[] = [];
  function Probe() {
    const x = useScale("x");
    captured.push(x);
    x.get();
  }
  function Fail({ fail }: { fail: boolean }) {
    if (fail) throw new Error("intentional child failure");
  }
  function Scene({ end, fail = false }: { end: number; fail?: boolean }) {
    return (
      <Scale id="x" type="linear" domain={[0, end]} range={[0, 100]}>
        <Probe />
        <Scale id="x" type="linear" domain={[0, 1]} range={[10, 20]} reverse>
          <Probe />
        </Scale>
        <Probe />
        <Fail fail={fail} />
      </Scale>
    );
  }
  const canvas = runtime.mount(<Scene end={10} />);
  runtime.flush();
  expect(captured[0]).toBe(captured[2]);
  expect(captured[1].get().map(0)).toBe(20);
  expect(captured[0].get().invert(50)).toBe(5);
  const original = captured[0];
  crc(canvas, <Scene end={20} fail />);
  expect(() => runtime.flush()).toThrow("intentional child failure");
  expect(original.get().domain).toEqual([0, 10]);
  runtime.mount(<Probe />);
  expect(() => runtime.flush()).toThrow(/unknown scale/);
});

it("suppresses equivalent domain results and detaches disposed consumers", () => {
  runtime = testRuntime();
  const domain = signal<readonly [number, number]>([0, 10]);
  let renders = 0;
  function Probe() {
    useScale("x").get();
    renders++;
  }
  runtime.mount(
    <Scale id="x" type="linear" domain={domain} range={[0, 100]}>
      <Probe />
    </Scale>,
  );
  runtime.flush();
  domain.set([0, 10]);
  runtime.flush();
  expect(renders).toBe(1);
  runtime.dispose();
  domain.set([0, 20]);
  expect(runtime.pending).toBe(0);
});

it("diagnoses a malformed domain and collapsed inversion through the public API", () => {
  runtime = testRuntime();
  function Probe() {
    expect(() => useScale("x").get().invert(0)).toThrow(/collapsed/);
  }
  runtime.mount(
    <Scale id="x" type="linear" domain={[0, 10]} range={[0, 0]}>
      <Probe />
    </Scale>,
  );
  runtime.flush();
  function InvalidProbe() {
    useScale("bad").get();
  }
  runtime.mount(
    <Scale id="bad" type="linear" domain={[1, 1]} range="width">
      <InvalidProbe />
    </Scale>,
  );
  expect(() => runtime.flush()).toThrow(/domain/);
});

it("keeps complete scale scopes inside Layers and rejects cross-Layer lookup", () => {
  runtime = testRuntime();
  let mapped = 0;
  function Probe() {
    mapped = useScale("x").get().map(5);
  }
  runtime.mount(
    <Layer style={{ width: 200, height: 100 }}>
      <Scale id="x" type="linear" domain={[0, 10]} range="width">
        <Probe />
      </Scale>
    </Layer>,
  );
  runtime.flush();
  expect(mapped).toBe(100);
  runtime.mount(
    <Scale id="x" type="linear" domain={[0, 10]} range="width">
      <Layer style={{ width: 200, height: 100 }}>
        <Probe />
      </Layer>
    </Scale>,
  );
  expect(() => runtime.flush()).toThrow(/Layer|unknown scale/);
});

it("resolves whole allocation styles and dynamic scale inputs through core signals", () => {
  runtime = testRuntime();
  const style = signal({ width: 200, height: 80 });
  const reverse = signal(false);
  const range = signal<"width" | readonly [number, number]>("width");
  let scale!: ResolvedLinearScale;
  function Probe() {
    scale = useScale("x").get();
  }
  runtime.mount(
    <Absolute>
      <Scale
        id="x"
        type="linear"
        domain={[10, 0]}
        range={range}
        reverse={reverse}
        style={style}
      >
        <Probe />
      </Scale>
    </Absolute>,
  );
  runtime.flush();
  expect(scale.map(5)).toBe(100);
  expect(scale.map(15)).toBe(-100);
  expect(scale.ticks(3)).toEqual([10, 5, 0]);
  expect(Object.isFrozen(scale)).toBe(true);
  expect(Object.isFrozen(scale.domain)).toBe(true);
  style.set({ width: 300, height: 120 });
  runtime.flush();
  expect(scale.map(5)).toBe(150);
  range.set([20, 80]);
  reverse.set(true);
  runtime.flush();
  expect(scale.map(10)).toBe(80);
  expect(scale.invert(20)).toBe(0);
  expect(() => scale.ticks(1)).toThrow(/count/);
  expect(() => scale.map(Infinity)).toThrow(/finite/);
});

it("releases replaced signal dependencies after a successful provider update", () => {
  runtime = testRuntime();
  const first = signal<readonly [number, number]>([0, 10]),
    second = signal<readonly [number, number]>([0, 20]);
  let renders = 0;
  function Probe() {
    useScale("x").get();
    renders++;
  }
  function Scene({ domain }: { domain: Signal<readonly [number, number]> }) {
    return (
      <Scale id="x" type="linear" domain={domain} range={[0, 100]}>
        <Probe />
      </Scale>
    );
  }
  const canvas = runtime.mount(<Scene domain={first} />);
  runtime.flush();
  crc(canvas, <Scene domain={second} />);
  runtime.flush();
  const before = renders;
  first.set([0, 30]);
  runtime.flush();
  expect(renders).toBe(before);
  second.set([0, 40]);
  runtime.flush();
  expect(renders).toBe(before + 1);
  expect(() => useScale("x")).toThrow();
});

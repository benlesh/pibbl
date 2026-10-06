import { signal } from "@pibbl/core";
import { Layer } from "@pibbl/core";
import {
  SequentialColorScale,
  DivergingColorScale,
  useSequentialColorScale,
  useDivergingColorScale,
} from "@pibbl/core/viz";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
it("maps a sequential domain through explicit colors and updates its shared signal", () => {
  runtime = testRuntime();
  const domain = signal<readonly [number, number]>([0, 10]);
  const samples: string[][] = [];
  function Probe() {
    const scale = useSequentialColorScale("color").get();
    samples.push([-1, 0, 5, 10, 11].map(scale.map));
    expect(scale.stops.map((s) => s.value)).toEqual(domain.get());
    return null;
  }
  runtime.mount(
    <SequentialColorScale
      id="color"
      domain={domain}
      colors={["#000000", "#ffffff"]}
    >
      <Probe />
    </SequentialColorScale>,
  );
  runtime.flush();
  expect(samples.at(-1)).toEqual([
    "#000000",
    "#000000",
    "#808080",
    "#ffffff",
    "#ffffff",
  ]);
  domain.set([10, 0]);
  runtime.flush();
  expect(samples.at(-1)).toEqual([
    "#ffffff",
    "#ffffff",
    "#808080",
    "#000000",
    "#000000",
  ]);
  runtime.dispose();
  domain.set([0, 20]);
  expect(runtime.pending).toBe(0);
});
it("uses the authored diverging midpoint, with no inferred symmetry", () => {
  runtime = testRuntime();
  let result: string[] = [];
  function Probe() {
    const scale = useDivergingColorScale("color").get();
    result = [-10, -5, 0, 10, 20].map(scale.map);
    expect(scale.stops.map((s) => s.value)).toEqual([-10, 0, 20]);
    return null;
  }
  runtime.mount(
    <DivergingColorScale
      id="color"
      domain={[-10, 0, 20]}
      colors={["#000000", "#808080", "#ffffff"]}
    >
      <Probe />
    </DivergingColorScale>,
  );
  runtime.flush();
  expect(result).toEqual([
    "#000000",
    "#404040",
    "#808080",
    "#c0c0c0",
    "#ffffff",
  ]);
});

it("uses the midpoint for a collapsed sequential domain and rejects nonfinite mapping", () => {
  runtime = testRuntime();
  let scale: ReturnType<ReturnType<typeof useSequentialColorScale>["get"]>;
  function Probe() {
    scale = useSequentialColorScale("x").get();
    return null;
  }
  runtime.mount(
    <SequentialColorScale
      id="x"
      domain={[2, 2]}
      colors={["#000000", "#ffffff"]}
    >
      <Probe />
    </SequentialColorScale>,
  );
  runtime.flush();
  expect(scale!.map(-99)).toBe("#808080");
  expect(() => scale!.map(Infinity)).toThrow(RangeError);
});

it("supports descending diverging domains and rejects malformed tuples", () => {
  runtime = testRuntime();
  let scale: ReturnType<ReturnType<typeof useDivergingColorScale>["get"]>;
  function Probe() {
    scale = useDivergingColorScale("x").get();
    return null;
  }
  runtime.mount(
    <DivergingColorScale
      id="x"
      domain={[2, 0, -2]}
      colors={["#000000", "#808080", "#ffffff"]}
    >
      <Probe />
    </DivergingColorScale>,
  );
  runtime.flush();
  expect([-3, -2, -1, 0, 1, 2, 3].map(scale!.map)).toEqual([
    "#ffffff",
    "#ffffff",
    "#c0c0c0",
    "#808080",
    "#404040",
    "#000000",
    "#000000",
  ]);
  expect(() => scale!.map(NaN)).toThrow(RangeError);
  runtime.dispose();
  for (const [domain, colors] of [
    [
      [0, 1, 1],
      ["#000000", "#111111", "#222222"],
    ],
    [
      [0, 1, 2],
      ["red", "#111111", "#222222"],
    ],
  ] as const) {
    const bad = testRuntime();
    bad.mount(
      <DivergingColorScale id="x" domain={domain} colors={colors}>
        <Probe />
      </DivergingColorScale>,
    );
    expect(() => bad.flush()).toThrow();
    bad.dispose();
  }
});

it("updates both signals, retains frozen snapshots, and cleans subscriptions on disposal", () => {
  runtime = testRuntime();
  const domain = signal<readonly [number, number]>([0, 1]),
    colors = signal<readonly [string, string]>(["#000000", "#ffffff"]);
  let scale: ReturnType<ReturnType<typeof useSequentialColorScale>["get"]>;
  function Probe() {
    scale = useSequentialColorScale("x").get();
    return null;
  }
  runtime.mount(
    <SequentialColorScale id="x" domain={domain} colors={colors}>
      <Probe />
    </SequentialColorScale>,
  );
  runtime.flush();
  const snapshot = scale!;
  domain.set([1, 0]);
  colors.set(["#ffffff", "#000000"]);
  runtime.flush();
  expect(Object.isFrozen(snapshot)).toBe(true);
  expect(snapshot.map(0)).toBe("#000000");
  runtime.dispose();
  domain.set([0, 2]);
  expect(runtime.pending).toBe(0);
});

it("enforces provider family, shadows matching IDs, and rejects Layer inheritance", () => {
  runtime = testRuntime();
  function Missing() {
    useSequentialColorScale("none").get();
    return null;
  }
  runtime.mount(<Missing />);
  expect(() => runtime.flush()).toThrow(/Unknown/);
  runtime.dispose();
  const wrong = testRuntime();
  function Wrong() {
    useDivergingColorScale("x").get();
    return null;
  }
  wrong.mount(
    <SequentialColorScale
      id="x"
      domain={[0, 1]}
      colors={["#000000", "#ffffff"]}
    >
      <Wrong />
    </SequentialColorScale>,
  );
  expect(() => wrong.flush()).toThrow(TypeError);
  wrong.dispose();
  const shadow = testRuntime();
  let seen: string | undefined;
  function Inner() {
    seen = useSequentialColorScale("x").get().map(0);
    return null;
  }
  shadow.mount(
    <SequentialColorScale
      id="x"
      domain={[0, 1]}
      colors={["#000000", "#ffffff"]}
    >
      <SequentialColorScale
        id="x"
        domain={[0, 1]}
        colors={["#ffffff", "#000000"]}
      >
        <Inner />
      </SequentialColorScale>
    </SequentialColorScale>,
  );
  shadow.flush();
  expect(seen).toBe("#ffffff");
  shadow.dispose();
  const layer = testRuntime();
  function InLayer() {
    useSequentialColorScale("x").get();
    return null;
  }
  layer.mount(
    <SequentialColorScale
      id="x"
      domain={[0, 1]}
      colors={["#000000", "#ffffff"]}
    >
      <Layer>
        <InLayer />
      </Layer>
    </SequentialColorScale>,
  );
  expect(() => layer.flush()).toThrow(/Layer/);
  layer.dispose();
});

it("restores scopes around nested providers and failed roots, and accepts a local Layer provider", () => {
  runtime = testRuntime();
  const seen: string[] = [];
  function Probe() {
    seen.push(useSequentialColorScale("x").get().map(0));
    return null;
  }
  runtime.mount(
    <SequentialColorScale
      id="x"
      domain={[0, 1]}
      colors={["#000000", "#ffffff"]}
    >
      <Probe />
      <SequentialColorScale
        id="x"
        domain={[0, 1]}
        colors={["#abcdef", "#ffffff"]}
      >
        <Probe />
      </SequentialColorScale>
      <Probe />
      <Layer>
        <SequentialColorScale
          id="x"
          domain={[0, 1]}
          colors={["#123456", "#ffffff"]}
        >
          <Probe />
        </SequentialColorScale>
      </Layer>
    </SequentialColorScale>,
  );
  runtime.flush();
  expect(seen).toContain("#123456");
  expect(seen.slice(0, 3)).toEqual(["#000000", "#abcdef", "#000000"]);
  function Fail() {
    useSequentialColorScale("x").get();
    throw new Error("intentional child failure");
  }
  runtime.mount(
    <SequentialColorScale
      id="x"
      domain={[0, 1]}
      colors={["#000000", "#ffffff"]}
    >
      <Fail />
    </SequentialColorScale>,
  );
  expect(() => runtime.flush()).toThrow(/intentional child failure/);
  runtime.mount(<Probe />);
  expect(() => runtime.flush()).toThrow(/Unknown color scale/);
  runtime.mount(
    <SequentialColorScale
      id="x"
      domain={[0, 1]}
      colors={["#fedcba", "#ffffff"]}
    >
      <Probe />
    </SequentialColorScale>,
  );
  runtime.flush();
  expect(seen.at(-1)).toBe("#fedcba");
  runtime.dispose();
  expect(runtime.pending).toBe(0);
});
it("keeps extreme finite endpoints numerically stable", () => {
  runtime = testRuntime();
  function Probe() {
    const s = useSequentialColorScale("x").get();
    expect([-Number.MAX_VALUE, 0, Number.MAX_VALUE].map(s.map)).toEqual([
      "#000000",
      "#808080",
      "#ffffff",
    ]);
    return null;
  }
  runtime.mount(
    <SequentialColorScale
      id="x"
      domain={[-Number.MAX_VALUE, Number.MAX_VALUE]}
      colors={["#000000", "#FFFFFF"]}
    >
      <Probe />
    </SequentialColorScale>,
  );
  runtime.flush();
});

it("rejects sparse domain and palette arrays instead of producing invalid colors", () => {
  function SequentialProbe() {
    useSequentialColorScale("x").get();
    return null;
  }
  function DivergingProbe() {
    useDivergingColorScale("x").get();
    return null;
  }
  const sparsePair = new Array(2) as [number, number],
    sparseTriple = new Array(3) as [number, number, number];
  const cases = [
    <SequentialColorScale
      id="x"
      domain={sparsePair}
      colors={["#000000", "#ffffff"]}
    >
      <SequentialProbe />
    </SequentialColorScale>,
    <SequentialColorScale
      id="x"
      domain={[0, 1]}
      colors={new Array(2) as [string, string]}
    >
      <SequentialProbe />
    </SequentialColorScale>,
    <DivergingColorScale
      id="x"
      domain={sparseTriple}
      colors={["#000000", "#808080", "#ffffff"]}
    >
      <DivergingProbe />
    </DivergingColorScale>,
    <DivergingColorScale
      id="x"
      domain={[-1, 0, 1]}
      colors={new Array(3) as [string, string, string]}
    >
      <DivergingProbe />
    </DivergingColorScale>,
  ];
  for (const node of cases) {
    runtime = testRuntime();
    runtime.mount(node);
    expect(() => runtime.flush()).toThrow();
    runtime.dispose();
    expect(runtime.pending).toBe(0);
  }
});

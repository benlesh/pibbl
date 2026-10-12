import { signal } from "@pibbl/core";
import { expect, it } from "vitest";
import {
  SequentialColorScale,
  ThresholdColorScale,
  useThresholdColorScale,
} from "@pibbl/core/viz";
import { testRuntime } from "./support/runtime.js";

it("maps exact boundaries into their upper threshold bucket", () => {
  const runtime = testRuntime();
  let scale: ReturnType<typeof useThresholdColorScale> | undefined;
  function Probe() {
    scale = useThresholdColorScale("change");
    return null;
  }
  runtime.mount(
    <ThresholdColorScale
      id="change"
      thresholds={[-1, 0, 1]}
      colors={["#112233", "#445566", "#778899", "#aabbcc"]}
    >
      <Probe />
    </ThresholdColorScale>,
  );
  runtime.flush();
  expect(scale!.get().map(-2)).toBe("#112233");
  expect(scale!.get().map(-1)).toBe("#445566");
  expect(scale!.get().map(0)).toBe("#778899");
  expect(scale!.get().map(1)).toBe("#aabbcc");
  runtime.dispose();
});

it("supports one unbounded color and replaces signal inputs", () => {
  const runtime = testRuntime(),
    thresholds = signal<readonly number[]>([]),
    colors = signal<readonly string[]>(["#ABCDEF"]);
  let scale: ReturnType<typeof useThresholdColorScale> | undefined;
  function Probe() {
    scale = useThresholdColorScale("threshold");
    return null;
  }
  runtime.mount(
    <ThresholdColorScale id="threshold" thresholds={thresholds} colors={colors}>
      <Probe />
    </ThresholdColorScale>,
  );
  runtime.flush();
  expect(scale!.get().bands).toEqual([
    { lower: undefined, upper: undefined, color: "#abcdef" },
  ]);
  expect(Object.isFrozen(scale!.get())).toBe(true);
  expect(Object.isFrozen(scale!.get().bands)).toBe(true);
  expect(Object.isFrozen(scale!.get().bands[0])).toBe(true);
  thresholds.set([10]);
  colors.set(["#000000", "#ffffff"]);
  runtime.flush();
  expect(scale!.get().map(10)).toBe("#ffffff");
  runtime.dispose();
});

it("rejects nonfinite mapped values and a shadowed wrong-family provider", () => {
  const runtime = testRuntime();
  function Probe() {
    return useThresholdColorScale("x").get().map(Number.NaN);
  }
  runtime.mount(
    <ThresholdColorScale id="x" thresholds={[]} colors={["#000000"]}>
      <Probe />
    </ThresholdColorScale>,
  );
  expect(() => runtime.flush()).toThrow(RangeError);
  runtime.dispose();
  const shadowed = testRuntime();
  function WrongFamily() {
    useThresholdColorScale("x").get();
    return null;
  }
  shadowed.mount(
    <ThresholdColorScale id="x" thresholds={[]} colors={["#000000"]}>
      <SequentialColorScale
        id="x"
        domain={[0, 1]}
        colors={["#000000", "#ffffff"]}
      >
        <WrongFamily />
      </SequentialColorScale>
    </ThresholdColorScale>,
  );
  expect(() => shadowed.flush()).toThrow(TypeError);
  shadowed.dispose();
});

it("rejects invalid thresholds, palettes, and mapped values", () => {
  function Probe() {
    useThresholdColorScale("x").get();
    return null;
  }
  const runtime = testRuntime();
  runtime.mount(
    <ThresholdColorScale
      id="x"
      thresholds={[1, 1]}
      colors={["#000000", "#111111", "#222222"]}
    >
      <Probe />
    </ThresholdColorScale>,
  );
  expect(() => runtime.flush()).toThrow(RangeError);
  runtime.dispose();
  const palette = testRuntime();
  palette.mount(
    <ThresholdColorScale id="x" thresholds={[]} colors={["red"]}>
      <Probe />
    </ThresholdColorScale>,
  );
  expect(() => palette.flush()).toThrow(TypeError);
  palette.dispose();
});

it("rejects sparse thresholds and colors", () => {
  function Probe() {
    useThresholdColorScale("x").get();
    return null;
  }
  for (const [thresholds, colors] of [
    [new Array<number>(1), ["#000000", "#ffffff"]],
    [[0], new Array<string>(2)],
  ] as const) {
    const runtime = testRuntime();
    runtime.mount(
      <ThresholdColorScale id="x" thresholds={thresholds} colors={colors}>
        <Probe />
      </ThresholdColorScale>,
    );
    expect(() => runtime.flush()).toThrow();
    runtime.dispose();
    expect(runtime.pending).toBe(0);
  }
});

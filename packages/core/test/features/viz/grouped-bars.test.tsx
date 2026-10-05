import { Absolute, pibbl, signal } from "@pibbl/core";
import { BarSeries, Scale, useScale, type ResolvedBandScale } from "@pibbl/core/viz";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it("composes reactive inner bands and styled grouped bars in one allocated frame", () => {
  runtime = testRuntime();
  const allocation = signal({ width: 400, height: 200 });
  const groups = signal<readonly string[]>(["actual", "plan"]);
  const color = signal("#ff0000");
  const data = [
    { month: "Jan", group: "actual", value: 8 },
    { month: "Jan", group: "plan", value: 5 },
    { month: "Feb", group: "actual", value: -6 },
    { month: "Feb", group: "unknown", value: 9 },
  ];
  let inner!: ResolvedBandScale;
  let hits = 0;
  function Probe() {
    inner = useScale("group", "band").get();
  }
  function Scene() {
    return (
      <Absolute>
        <Scale
          id="month"
          type="band"
          domain={["Jan", "Feb"]}
          range="width"
          paddingInner={0.2}
          paddingOuter={0.1}
          style={allocation}
        >
          <Scale
            id="group"
            type="band"
            domain={groups}
            range={{ bandwidthOf: "month" }}
            paddingInner={0.2}
            paddingOuter={0.1}
          >
            <Scale
              id="value"
              type="linear"
              domain={[-10, 10]}
              range="height"
              reverse
            >
              <Probe />
              <BarSeries
                data={data}
                category="month"
                value="value"
                group="group"
                categoryScale="month"
                valueScale="value"
                groupScale="group"
                style={(row) => ({
                  fill: row.group === "actual" ? color.get() : "#0000ff",
                })}
                onPointerDown={() => hits++}
              />
            </Scale>
          </Scale>
        </Scale>
      </Absolute>
    );
  }
  const canvas = runtime.mount(<Scene />);
  runtime.flush();
  expect(inner.range).toEqual([0, 160]);
  expect(inner.bandwidth).toBeCloseTo(64);
  expect(inner.map("actual")).toBeCloseTo(8);
  const pixel = (x: number, y: number) => [
    ...canvas.getContext("2d")!.getImageData(x, y, 1, 1).data,
  ];
  expect(pixel(50, 30)).toEqual([255, 0, 0, 255]);
  expect(pixel(130, 70)).toEqual([0, 0, 255, 255]);
  expect(pixel(250, 130)).toEqual([255, 0, 0, 255]);
  expect(pixel(100, 70)[3]).toBe(0);
  expect(pixel(330, 130)[3]).toBe(0);
  const rect = canvas.getBoundingClientRect();
  for (const [x, y] of [
    [50, 30],
    [130, 70],
    [250, 130],
    [100, 70],
    [330, 130],
  ])
    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: rect.left + x,
        clientY: rect.top + y,
        bubbles: true,
      }),
    );
  expect(hits).toBe(3);
  allocation.set({ width: 200, height: 200 });
  groups.set(["plan", "actual"]);
  color.set("#008000");
  runtime.flush();
  expect(inner.range).toEqual([0, 80]);
  expect(inner.bandwidth).toBeCloseTo(32);
  expect(pixel(70, 30)).toEqual([0, 128, 0, 255]);
  expect(pixel(30, 70)).toEqual([0, 0, 255, 255]);
  pibbl(canvas, <Scene />);
  runtime.flush();
  expect(inner.range).toEqual([0, 80]);
});

it("keeps three slots stable for missing groups, custom widths, reversed domains and nonzero baselines", () => {
  runtime = testRuntime();
  const data = [
    { c: "A", g: "one", v: 8 },
    { c: "A", g: "three", v: -4 },
    { c: "A", g: null, v: 9 },
    { c: "A", g: "two", v: null },
  ];
  const canvas = runtime.mount(
    <Scale id="c" type="band" domain={["A"]} range={[0, 300]}>
      <Scale
        id="g"
        type="band"
        domain={["one", "two", "three"]}
        range={{ bandwidthOf: "c" }}
        reverse
      >
        <Scale id="v" type="linear" domain={[-10, 10]} range={[200, 0]}>
          <BarSeries
            data={data}
            category="c"
            value="v"
            group="g"
            categoryScale="c"
            valueScale="v"
            groupScale="g"
            baseline={2}
            style={{ bandwidth: 40, fill: "#ff0000" }}
          />
        </Scale>
      </Scale>
    </Scale>,
  );
  runtime.flush();
  const alpha = (x: number, y: number) =>
    canvas.getContext("2d")!.getImageData(x, y, 1, 1).data[3];
  expect(alpha(250, 30)).toBe(255);
  expect(alpha(210, 30)).toBe(0);
  expect(alpha(150, 30)).toBe(0);
  expect(alpha(50, 100)).toBe(255);
  expect(alpha(50, 60)).toBe(0);
});

it("collapses nested bands without painted or interactive bars and restores them reactively", () => {
  runtime = testRuntime();
  const extent = signal<readonly [number, number]>([0, 0]);
  const domains = signal<readonly string[]>(["one"]);
  let inner!: ResolvedBandScale;
  function Probe() {
    inner = useScale("g", "band").get();
  }
  const canvas = runtime.mount(
    <Scale id="c" type="band" domain={["A"]} range={extent}>
      <Scale id="g" type="band" domain={domains} range={{ bandwidthOf: "c" }}>
        <Scale id="v" type="linear" domain={[0, 10]} range={[100, 0]}>
          <Probe />
          <BarSeries
            data={[{ c: "A", g: "one", v: 8 }]}
            category="c"
            value="v"
            group="g"
            categoryScale="c"
            valueScale="v"
            groupScale="g"
            style={{ fill: "#ff0000", bandwidth: 20 }}
          />
        </Scale>
      </Scale>
    </Scale>,
  );
  runtime.flush();
  expect(inner.bandwidth).toBe(0);
  const alpha = () =>
    canvas.getContext("2d")!.getImageData(50, 50, 1, 1).data[3];
  expect(alpha()).toBe(0);
  extent.set([0, 100]);
  runtime.flush();
  expect(inner.bandwidth).toBe(100);
  expect(alpha()).toBe(255);
  domains.set([]);
  runtime.flush();
  expect(inner.bandwidth).toBe(0);
  expect(alpha()).toBe(0);
});

it.each(["missing", "linear"] as const)(
  "rejects a %s bandwidth reference through the public surface",
  (kind) => {
    runtime = testRuntime();
    function Probe() {
      useScale("g", "band").get();
    }
    expect(() => {
      runtime.mount(
        <Scale id="parent" type="linear" domain={[0, 1]} range="width">
          <Scale
            id="g"
            type="band"
            domain={["A"]}
            range={{ bandwidthOf: kind === "missing" ? "absent" : "parent" }}
          >
            <Probe />
          </Scale>
        </Scale>,
      );
      runtime.flush();
    }).toThrow(kind === "missing" ? /unknown scale/ : /type=band/);
  },
);

it("keeps captured scale signals synchronous when numeric ranges or parent padding change", () => {
  runtime = testRuntime();
  const range = signal<readonly [number, number]>([0, 300]);
  const padding = signal(0);
  let numeric!: import("@pibbl/core").Signal<
    import("@pibbl/core/viz").ResolvedLinearScale
  >;
  let nested!: import("@pibbl/core").Signal<ResolvedBandScale>;
  function Probe() {
    numeric = useScale("v");
    nested = useScale("g", "band");
    numeric.get();
    nested.get();
  }
  runtime.mount(
    <Scale
      id="c"
      type="band"
      domain={["A", "B"]}
      range={range}
      paddingInner={padding}
    >
      <Scale
        id="g"
        type="band"
        domain={["one", "two"]}
        range={{ bandwidthOf: "c" }}
      >
        <Scale id="v" type="linear" domain={[0, 10]} range={range}>
          <Probe />
        </Scale>
      </Scale>
    </Scale>,
  );
  runtime.flush();
  range.set([0, 200]);
  expect(numeric.get().map(10)).toBe(200);
  expect(nested.get().bandwidth).toBe(50);
  padding.set(0.5);
  expect(nested.get().bandwidth).toBeCloseTo(100 / 3);
});

it("switches bandwidth references and detaches old ancestor dependencies", () => {
  runtime = testRuntime();
  const first = signal<readonly [number, number]>([0, 100]);
  const second = signal<readonly [number, number]>([0, 200]);
  const range = signal<import("@pibbl/core/viz").BandScaleRange>({
    bandwidthOf: "first",
  });
  let inner!: ResolvedBandScale;
  let captured!: import("@pibbl/core").Signal<ResolvedBandScale>;
  let renders = 0;
  function Probe() {
    captured = useScale("g", "band");
    inner = captured.get();
    renders++;
  }
  runtime.mount(
    <Scale id="first" type="band" domain={["A"]} range={first}>
      <Scale id="second" type="band" domain={["B"]} range={second}>
        <Scale id="g" type="band" domain={["one", "two"]} range={range}>
          <Probe />
        </Scale>
      </Scale>
    </Scale>,
  );
  runtime.flush();
  expect(inner.bandwidth).toBe(50);
  range.set({ bandwidthOf: "second" });
  expect(captured.get().bandwidth).toBe(100);
  runtime.flush();
  expect(inner.bandwidth).toBe(100);
  const before = renders;
  first.set([0, 300]);
  runtime.flush();
  expect(renders).toBe(before);
  second.set([0, 400]);
  runtime.flush();
  expect(inner.bandwidth).toBe(200);
  range.set([0, 60]);
  runtime.flush();
  expect(inner.bandwidth).toBe(30);
  runtime.dispose();
  first.set([0, 500]);
  second.set([0, 500]);
  expect(runtime.pending).toBe(0);
});

it.each(["signal", "promise", "hook", "unknown"] as const)(
  "rejects invalid %s datum styles",
  (kind) => {
    runtime = testRuntime();
    const invalid = () => {
      if (kind === "signal") return { fill: signal("red") };
      if (kind === "promise") return Promise.resolve({ fill: "red" });
      if (kind === "hook")
        return { fill: useScale("v").get() ? "red" : "blue" };
      return { nonsense: 1 };
    };
    runtime.mount(
      <Scale id="c" type="band" domain={["A"]} range={[0, 100]}>
        <Scale id="v" type="linear" domain={[0, 10]} range={[100, 0]}>
          <BarSeries
            data={[{ c: "A", v: 8 }]}
            category="c"
            value="v"
            categoryScale="c"
            valueScale="v"
            style={
              invalid as unknown as import("@pibbl/core/viz").BarStyleResolver<{
                c: string;
                v: number;
              }>
            }
          />
        </Scale>
      </Scale>,
    );
    expect(() => runtime.flush()).toThrow();
  },
);

it("restores captured nested scopes after a failed render transaction", () => {
  runtime = testRuntime();
  let captured!: import("@pibbl/core").Signal<ResolvedBandScale>;
  function Probe() {
    captured = useScale("inner", "band");
    captured.get();
  }
  function Fail({ fail }: { fail: boolean }) {
    if (fail) throw new Error("candidate failed");
  }
  function Scene({ end, fail = false }: { end: number; fail?: boolean }) {
    return (
      <Scale id="outer" type="band" domain={["A"]} range={[0, end]}>
        <Scale
          id="inner"
          type="band"
          domain={["one", "two"]}
          range={{ bandwidthOf: "outer" }}
        >
          <Probe />
          <Fail fail={fail} />
        </Scale>
      </Scale>
    );
  }
  const canvas = runtime.mount(<Scene end={100} />);
  runtime.flush();
  const original = captured;
  pibbl(canvas, <Scene end={300} fail />);
  expect(() => runtime.flush()).toThrow("candidate failed");
  expect(original.get().bandwidth).toBe(50);
  pibbl(canvas, <Scene end={200} />);
  runtime.flush();
  // A failed root closes its refs; the next explicit render mounts fresh hooks.
  expect(captured).not.toBe(original);
  expect(captured.get().bandwidth).toBe(100);
});

import { Group, signal } from "@pibbl/core";
import { BarSeries, Scale } from "@pibbl/core/viz";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it("renders reactive positive and negative stack segments using range endpoints and ordinary bar styles", () => {
  runtime = testRuntime();
  const data = signal([
    { c: "A", start: 0, end: 3, color: "#ff0000" },
    { c: "A", start: 3, end: 8, color: "#0000ff" },
    { c: "A", start: 0, end: -2, color: "#008000" },
    { c: "A", start: -2, end: -5, color: "#ffa500" },
    { c: "A", start: null, end: 10, color: "#000000" },
  ]);
  let hits = 0;
  const canvas = runtime.mount(
    <Scale
      id="c"
      type="band"
      domain={["A"]}
      range={[0, 100]}
      paddingInner={0.2}
      paddingOuter={0.1}
    >
      <Scale id="v" type="linear" domain={[-10, 10]} range={[200, 0]}>
        <BarSeries
          data={data}
          category="c"
          valueStart="start"
          valueEnd="end"
          categoryScale="c"
          valueScale="v"
          style={(row) => ({ fill: row.color })}
          onPointerDown={() => hits++}
        />
      </Scale>
    </Scale>,
  );
  runtime.flush();
  const pixel = (x: number, y: number) => [
    ...canvas.getContext("2d")!.getImageData(x, y, 1, 1).data,
  ];
  expect(pixel(50, 85)).toEqual([255, 0, 0, 255]);
  expect(pixel(50, 45)).toEqual([0, 0, 255, 255]);
  expect(pixel(50, 110)).toEqual([0, 128, 0, 255]);
  expect(pixel(50, 135)).toEqual([255, 165, 0, 255]);
  expect(pixel(50, 10)[3]).toBe(0);
  expect(pixel(5, 85)[3]).toBe(0);
  const box = canvas.getBoundingClientRect();
  for (const [x, y] of [
    [50, 85],
    [50, 45],
    [50, 110],
    [50, 135],
    [5, 85],
    [50, 10],
  ]) {
    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: box.left + x,
        clientY: box.top + y,
        bubbles: true,
      }),
    );
  }
  expect(hits).toBe(4);
  data.set([{ c: "A", start: 8, end: 3, color: "#008000" }]);
  runtime.flush();
  expect(pixel(50, 45)).toEqual([0, 128, 0, 255]);
  expect(pixel(50, 85)[3]).toBe(0);
});

it("composes grouped ranges and absolute threshold fills without extending segments to zero", () => {
  runtime = testRuntime();
  const canvas = runtime.mount(
    <Scale id="c" type="band" domain={["A"]} range={[0, 200]}>
      <Scale
        id="g"
        type="band"
        domain={["actual", "plan"]}
        range={{ bandwidthOf: "c" }}
      >
        <Scale id="v" type="linear" domain={[0, 10]} range={[100, 0]}>
          <BarSeries
            data={[
              { c: "A", g: "actual", from: 2, to: 8 },
              { c: "A", g: "plan", from: 8, to: 2 },
            ]}
            category="c"
            group="g"
            groupScale="g"
            categoryScale="c"
            valueScale="v"
            valueStart="from"
            valueEnd="to"
            style={{
              bandwidth: 60,
              fill: {
                type: "threshold",
                thresholds: [5],
                colors: ["#008000", "#ff0000"],
              },
            }}
          />
        </Scale>
      </Scale>
    </Scale>,
  );
  runtime.flush();
  const pixel = (x: number, y: number) => [
    ...canvas.getContext("2d")!.getImageData(x, y, 1, 1).data,
  ];
  for (const x of [50, 150]) {
    expect(pixel(x, 30)).toEqual([255, 0, 0, 255]);
    expect(pixel(x, 70)).toEqual([0, 128, 0, 255]);
    expect(pixel(x, 90)[3]).toBe(0);
  }
  expect(pixel(100, 50)[3]).toBe(0);
});

it.each([
  {},
  { valueStart: "start" },
  { valueEnd: "end" },
  { value: "end", valueStart: "start", valueEnd: "end" },
  { baseline: 0, valueStart: "start", valueEnd: "end" },
])(
  "rejects incomplete or mixed geometry even for empty data: %j",
  (geometry) => {
    runtime = testRuntime();
    const props = {
      data: [],
      category: "c",
      categoryScale: "c",
      valueScale: "v",
      ...geometry,
    } as unknown as import("@pibbl/core/viz").BarSeriesProps<{
      c: string;
      start: number;
      end: number;
    }>;
    runtime.mount(
      <Scale id="c" type="band" domain={["A"]} range={[0, 100]}>
        <Scale id="v" type="linear" domain={[0, 10]} range={[100, 0]}>
          <BarSeries {...props} />
        </Scale>
      </Scale>,
    );
    expect(() => runtime.flush()).toThrow(/either value.*both valueStart and valueEnd/);
  },
);

it("omits missing, nonfinite, zero-length and excluded ranges from paint and targeting", () => {
  runtime = testRuntime();
  let hits = 0;
  const rows = [
    { c: "A", from: null, to: 9, include: true },
    { c: "B", from: 1, to: undefined, include: true },
    { c: "C", from: NaN, to: 9, include: true },
    { c: "D", from: 1, to: Infinity, include: true },
    { c: "E", from: 5, to: 5, include: true },
    { c: "F", from: 1, to: 9, include: false },
  ];
  const canvas = runtime.mount(
    <Scale
      id="c"
      type="band"
      domain={rows.map((row) => row.c)}
      range={[0, 600]}
    >
      <Scale id="v" type="linear" domain={[0, 10]} range={[100, 0]}>
        <BarSeries
          data={rows}
          category="c"
          categoryScale="c"
          valueScale="v"
          defined={(row) => row.include}
          valueStart={(row) => {
            if (!row.include) throw new Error("excluded accessor");
            return row.from;
          }}
          valueEnd="to"
          onPointerDown={() => hits++}
          style={{ fill: "red", stroke: "black", strokeWidth: 4 }}
        />
      </Scale>
    </Scale>,
  );
  runtime.flush();
  const bounds = canvas.getBoundingClientRect();
  for (const x of [50, 150, 250, 350, 450, 550]) {
    expect(canvas.getContext("2d")!.getImageData(x, 50, 1, 1).data[3]).toBe(0);
    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: bounds.left + x,
        clientY: bounds.top + 50,
        bubbles: true,
      }),
    );
  }
  expect(hits).toBe(0);
});

it("maps grouped horizontal ranges and threshold bands in normal and reversed value ranges", () => {
  runtime = testRuntime();
  let hits = 0;
  const rows = [
    { c: "A", g: "actual", from: 2, to: 8 },
    { c: "A", g: "plan", from: 8, to: 2 },
  ];
  const threshold = {
    type: "threshold" as const,
    thresholds: [5],
    colors: ["#008000", "#ff0000"],
  };
  const bars = (prefix: string, range: readonly [number, number]) => (
    <Scale id={`${prefix}-category`} type="band" domain={["A"]} range={[0, 100]}>
      <Scale id={`${prefix}-group`} type="band" domain={["actual", "plan"]} range={{ bandwidthOf: `${prefix}-category` }}>
        <Scale id={`${prefix}-value`} type="linear" domain={[0, 10]} range={range}>
          <BarSeries
            orientation="horizontal"
            data={rows}
            category="c"
            valueStart="from"
            valueEnd="to"
            group="g"
            categoryScale={`${prefix}-category`}
            groupScale={`${prefix}-group`}
            valueScale={`${prefix}-value`}
            onPointerDown={() => hits++}
            style={{ fill: threshold }}
          />
        </Scale>
      </Scale>
    </Scale>
  );
  const canvas = runtime.mount(<>{bars("normal", [0, 200])}<Group style={{ translateY: 120 }}>{bars("reverse", [200, 0])}</Group></>);
  runtime.flush();
  const pixel = (x: number, y: number) => [
    ...canvas.getContext("2d")!.getImageData(x, y, 1, 1).data,
  ];
  for (const y of [25, 75]) {
    expect(pixel(80, y)).toEqual([0, 128, 0, 255]);
    expect(pixel(120, y)).toEqual([255, 0, 0, 255]);
    expect(pixel(80, y + 120)).toEqual([255, 0, 0, 255]);
    expect(pixel(120, y + 120)).toEqual([0, 128, 0, 255]);
  }
  const bounds = canvas.getBoundingClientRect();
  for (const [x, y] of [[80, 25], [120, 75], [80, 145], [120, 195]]) {
    canvas.dispatchEvent(new PointerEvent("pointerdown", {
      clientX: bounds.left + x,
      clientY: bounds.top + y,
      bubbles: true,
    }));
  }
  expect(hits).toBe(4);
});

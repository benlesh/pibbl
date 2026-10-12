import { Clip, Group, signal, useSignal } from "@pibbl/core";
import * as Viz from "@pibbl/core/viz";
import { afterEach, expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";

let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it("maps supplied asymmetric estimates and bounds in both orientations and replaces reactive marks", () => {
  expect(Viz).toHaveProperty("HorizontalIntervalSeries");
  expect(Viz).toHaveProperty("VerticalIntervalSeries");
  runtime = testRuntime();
  const moves = vi.spyOn(Path2D.prototype, "moveTo");
  const lines = vi.spyOn(Path2D.prototype, "lineTo");
  const arcs = vi.spyOn(Path2D.prototype, "arc");
  const data = signal<
    readonly {
      study: string;
      estimate: number | null;
      lower: number;
      upper: number;
    }[]
  >([
    { study: "a", estimate: 1, lower: 0.5, upper: 2.5 },
    { study: "b", estimate: null, lower: 1, upper: 2 },
  ]);
  const canvas = runtime.mount(
    <Group>
      <Viz.BarScale
        id="rows"
        domain={["a", "b"]}
        range={[0, 200]}
        style={{ width: 300, height: 200 }}
      >
        <Viz.LinearScale id="effect" domain={[0, 3]} range={[0, 300]}>
          <Viz.HorizontalIntervalSeries
            data={data}
            category="study"
            estimate="estimate"
            lower="lower"
            upper="upper"
            categoryScale="rows"
            valueScale="effect"
            style={{
              fill: "#087f8c",
              stroke: "#087f8c",
              radius: 4,
              capSize: 10,
            }}
          />
        </Viz.LinearScale>
      </Viz.BarScale>
      <Group style={{ translateX: 340 }}>
        <Viz.PointScale
          id="columns"
          domain={["a", "b"]}
          range={[50, 150]}
          style={{ width: 200, height: 300 }}
        >
          <Viz.LinearScale id="effect" domain={[0, 3]} range={[300, 0]}>
            <Viz.VerticalIntervalSeries
              data={data}
              category="study"
              estimate="estimate"
              lower="lower"
              upper="upper"
              categoryScale="columns"
              valueScale="effect"
              style={{ radius: 4, capSize: 10 }}
            />
          </Viz.LinearScale>
        </Viz.PointScale>
      </Group>
    </Group>,
  );
  runtime.flush();
  // Data bounds map independently, rather than using a symmetric +/- error.
  expect(moves.mock.calls).toContainEqual([50, 50]);
  expect(lines.mock.calls).toContainEqual([250, 50]);
  expect(
    arcs.mock.calls.some(
      ([x, y, radius]) => x === 100 && y === 50 && radius === 4,
    ),
  ).toBe(true);
  expect(moves.mock.calls).toContainEqual([50, 250]);
  expect(lines.mock.calls).toContainEqual([50, 50]);
  expect(
    arcs.mock.calls.some(
      ([x, y, radius]) => x === 50 && y === 200 && radius === 4,
    ),
  ).toBe(true);
  expect(arcs.mock.calls).toHaveLength(2); // Null estimate omits the entire row.
  const alpha = (x: number, y: number) =>
    canvas.getContext("2d")!.getImageData(x, y, 1, 1).data[3];
  expect(alpha(100, 52)).toBe(255);
  expect(alpha(150, 150)).toBe(0);
  arcs.mockClear();
  data.set([{ study: "a", estimate: 1.5, lower: 1.25, upper: 2 }]);
  runtime.flush();
  expect(arcs.mock.calls.some(([x, y]) => x === 150 && y === 50)).toBe(true);
  expect(arcs.mock.calls.some(([x, y]) => x === 50 && y === 150)).toBe(true);
  expect(alpha(100, 52)).toBe(0); // Old geometry is removed after the scheduled update.
  expect(alpha(150, 52)).toBe(255);
});

interface Row {
  category: string | number | null;
  estimate: number | null;
  lower: number | null;
  upper: number | null;
}
function chart(data: readonly Row[], style: Viz.IntervalSeriesStyle = {}) {
  return (
    <Viz.PointScale id="category" domain={["a", 2]} range={[40, 100]}>
      <Viz.LinearScale id="value" domain={[0, 10]} range={[0, 200]}>
        <Viz.HorizontalIntervalSeries
          data={data}
          category="category"
          estimate="estimate"
          lower="lower"
          upper="upper"
          categoryScale="category"
          valueScale="value"
          style={style}
        />
      </Viz.LinearScale>
    </Viz.PointScale>
  );
}

it("omits unknown categories before interpreting their numeric bounds", () => {
  runtime = testRuntime();
  const arcs = vi.spyOn(Path2D.prototype, "arc");
  runtime.mount(
    chart([
      { category: "unknown", estimate: 1, lower: 3, upper: 2 },
      { category: null, estimate: 1, lower: 3, upper: 2 },
    ]),
  );
  expect(() => runtime.flush()).not.toThrow();
  expect(arcs).not.toHaveBeenCalled();
});

it("omits complete rows with missing or non-finite numeric coordinates", () => {
  runtime = testRuntime();
  const arcs = vi.spyOn(Path2D.prototype, "arc");
  const moves = vi.spyOn(Path2D.prototype, "moveTo");
  const rows: Row[] = [];
  for (const key of ["estimate", "lower", "upper"] as const)
    for (const value of [null, NaN, Infinity, -Infinity])
      rows.push({
        category: "a",
        estimate: 3,
        lower: 2,
        upper: 4,
        [key]: value,
      });
  runtime.mount(chart(rows));
  runtime.flush();
  expect(arcs).not.toHaveBeenCalled();
  expect(moves).not.toHaveBeenCalled();
});

it("accepts equal bounds and estimates outside bounds without changing supplied values", () => {
  runtime = testRuntime();
  const arcs = vi.spyOn(Path2D.prototype, "arc");
  const moves = vi.spyOn(Path2D.prototype, "moveTo");
  const lines = vi.spyOn(Path2D.prototype, "lineTo");
  runtime.mount(chart([{ category: 2, estimate: 8, lower: 3, upper: 3 }]));
  runtime.flush();
  expect(moves.mock.calls).toContainEqual([60, 100]);
  expect(lines.mock.calls).toContainEqual([60, 100]);
  expect(arcs.mock.calls[0].slice(0, 3)).toEqual([160, 100, 4]);
});

it.each([
  [
    "reversed bounds",
    [{ category: "a", estimate: 3, lower: 4, upper: 2 }],
    {},
    /lower must not exceed upper/,
  ],
  [
    "negative radius",
    [],
    { radius: -1 },
    /finite.*nonnegative|nonnegative.*finite/,
  ],
  ["infinite cap size", [], { capSize: Infinity }, /finite/],
  ["negative stroke width", [], { strokeWidth: -1 }, /nonnegative/],
  ["invalid opacity", [], { opacity: 2 }, /opacity/],
  ["invalid targeting width", [], { lineInteractionWidth: NaN }, /finite/],
] as const)("rejects %s", (_name, data, style, error) => {
  runtime = testRuntime();
  runtime.mount(chart(data, style));
  expect(() => runtime.flush()).toThrow(error);
});

it("observes shallow style signals and removes hidden circles and caps", () => {
  runtime = testRuntime();
  const radius = signal(4),
    capSize = signal(8);
  const arcs = vi.spyOn(Path2D.prototype, "arc"),
    moves = vi.spyOn(Path2D.prototype, "moveTo");
  runtime.mount(
    <Viz.PointScale id="category" domain={["a"]} range={[40, 40]}>
      <Viz.LinearScale id="value" domain={[10, 0]} range={[0, 200]}>
        <Viz.HorizontalIntervalSeries
          data={[{ category: "a", estimate: 3, lower: 2, upper: 4 }]}
          category="category"
          estimate="estimate"
          lower="lower"
          upper="upper"
          categoryScale="category"
          valueScale="value"
          style={{ radius, capSize }}
        />
      </Viz.LinearScale>
    </Viz.PointScale>,
  );
  runtime.flush();
  expect(arcs.mock.calls[0].slice(0, 3)).toEqual([140, 40, 4]);
  expect(moves.mock.calls).toHaveLength(3);
  arcs.mockClear();
  moves.mockClear();
  radius.set(0);
  capSize.set(0);
  runtime.flush();
  expect(arcs).not.toHaveBeenCalled();
  expect(moves.mock.calls).toEqual([[160, 40]]);
  runtime.dispose();
  radius.set(8);
  capSize.set(12);
  expect(runtime.pending).toBe(0);
});

it("maps positive logarithmic bounds and rejects zero or negative values", () => {
  runtime = testRuntime();
  const data = signal<readonly Row[]>([
    { category: "a", estimate: 10, lower: 1, upper: 100 },
  ]);
  const arcs = vi.spyOn(Path2D.prototype, "arc");
  runtime.mount(
    <Viz.PointScale id="category" domain={["a"]} range={[40, 40]}>
      <Viz.LogScale id="value" domain={[1, 100]} range={[200, 0]}>
        <Viz.VerticalIntervalSeries
          data={data}
          category="category"
          estimate="estimate"
          lower="lower"
          upper="upper"
          categoryScale="category"
          valueScale="value"
        />
      </Viz.LogScale>
    </Viz.PointScale>,
  );
  runtime.flush();
  expect(arcs.mock.calls[0].slice(0, 3)).toEqual([40, 100, 4]);
  data.set([{ category: "a", estimate: 10, lower: 0, upper: 100 }]);
  expect(() => runtime.flush()).toThrow(/positive/);
});

it("passes original records and source indices to accessors and short-circuits excluded rows", () => {
  runtime = testRuntime();
  const data = [
    { category: "a", estimate: 2, lower: 1, upper: 3 },
    { category: 2, estimate: 5, lower: 4, upper: 6 },
  ];
  const category = vi.fn((row: Row) => row.category);
  const estimate = vi.fn((row: Row) => row.estimate);
  runtime.mount(
    <Viz.PointScale id="category" domain={["a", 2]} range={[40, 100]}>
      <Viz.LinearScale id="value" domain={[0, 10]} range={[0, 200]}>
        <Viz.HorizontalIntervalSeries
          data={data}
          category={category}
          estimate={estimate}
          lower="lower"
          upper="upper"
          defined={(_row, i) => i === 1}
          categoryScale="category"
          valueScale="value"
        />
      </Viz.LinearScale>
    </Viz.PointScale>,
  );
  runtime.flush();
  expect(category.mock.calls).toEqual([[data[1], 1, data]]);
  expect(estimate.mock.calls).toEqual([[data[1], 1, data]]);
});

it("targets transformed intervals with a wider hit stroke and honors pointerEvents none", () => {
  runtime = testRuntime();
  const events: string[] = [];
  const ignored = signal(false);
  function Marks() {
    return (
      <Viz.HorizontalIntervalSeries
        data={[{ category: "a", estimate: 5, lower: 2, upper: 8 }]}
        category="category"
        estimate="estimate"
        lower="lower"
        upper="upper"
        categoryScale="category"
        valueScale="value"
        pointerEvents={ignored.get() ? "none" : "auto"}
        style={{ lineInteractionWidth: 16, radius: 0, capSize: 0 }}
        onPointerDown={() => events.push("interval")}
      />
    );
  }
  const canvas = runtime.mount(
    <Group
      onPointerDown={() => events.push("parent")}
      style={{ translateX: 20, translateY: 30 }}
    >
      <Viz.PointScale id="category" domain={["a"]} range={[40, 40]}>
        <Viz.LinearScale id="value" domain={[0, 10]} range={[0, 200]}>
          <Marks />
        </Viz.LinearScale>
      </Viz.PointScale>
    </Group>,
  );
  runtime.flush();
  const press = () => {
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: rect.left + 100,
        clientY: rect.top + 75,
        bubbles: true,
      }),
    );
  };
  press();
  expect(events).toEqual(["interval", "parent"]);
  ignored.set(true);
  runtime.flush();
  press();
  expect(events).toEqual(["interval", "parent"]);
});

it.each([
  ["non-array data", "invalid", {}, /data must be an array/],
  ["array style", [], [], /style must be an object/],
  ["unknown style field", [], { width: 10 }, /unsupported style field width/],
  ["invalid cursor", [], { cursor: 5 }, /cursor must be a string/],
] as const)(
  "rejects malformed %s through the public boundary",
  (_name, data, style, error) => {
    runtime = testRuntime();
    runtime.mount(
      chart(data as unknown as Row[], style as Viz.IntervalSeriesStyle),
    );
    expect(() => runtime.flush()).toThrow(error);
  },
);

it("requires an ancestor categorical scale", () => {
  runtime = testRuntime();
  runtime.mount(
    <Viz.LinearScale id="category" domain={[0, 1]} range={[0, 100]}>
      <Viz.LinearScale id="value" domain={[0, 10]} range={[0, 200]}>
        <Viz.HorizontalIntervalSeries
          data={[]}
          category={() => "a"}
          estimate={() => 1}
          lower={() => 0}
          upper={() => 2}
          categoryScale="category"
          valueScale="value"
        />
      </Viz.LinearScale>
    </Viz.LinearScale>,
  );
  expect(() => runtime.flush()).toThrow(/PointScale or BarScale/);
});

it("forbids signal writes in data accessors and releases failed consumers", () => {
  runtime = testRuntime();
  const value = signal(0);
  runtime.mount(
    <Viz.PointScale id="category" domain={["a"]} range={[40, 40]}>
      <Viz.LinearScale id="value" domain={[0, 10]} range={[0, 200]}>
        <Viz.HorizontalIntervalSeries
          data={[1]}
          category={() => "a"}
          estimate={() => {
            value.set(1);
            return 2;
          }}
          lower={() => 1}
          upper={() => 3}
          categoryScale="category"
          valueScale="value"
        />
      </Viz.LinearScale>
    </Viz.PointScale>,
  );
  expect(() => runtime.flush()).toThrow();
  expect(value.get()).toBe(0);
  runtime.dispose();
  value.set(2);
  expect(runtime.pending).toBe(0);
});

it("forbids hooks in accessor callbacks", () => {
  runtime = testRuntime();
  runtime.mount(
    <Viz.PointScale id="category" domain={["a"]} range={[40, 40]}>
      <Viz.LinearScale id="value" domain={[0, 10]} range={[0, 200]}>
        <Viz.HorizontalIntervalSeries
          data={[1]}
          category={() => "a"}
          estimate={() => useSignal(2).get()}
          lower={() => 1}
          upper={() => 3}
          categoryScale="category"
          valueScale="value"
        />
      </Viz.LinearScale>
    </Viz.PointScale>,
  );
  expect(() => runtime.flush()).toThrow(/hook/i);
});

it("composes explicit clipping for both paint and targets without clamping data", () => {
  runtime = testRuntime();
  const clip = new Path2D();
  clip.rect(0, 0, 100, 80);
  const handler = vi.fn();
  const canvas = runtime.mount(
    <Clip style={{ d: clip }}>
      <Viz.PointScale id="category" domain={["a"]} range={[40, 40]}>
        <Viz.LinearScale id="value" domain={[0, 10]} range={[0, 200]}>
          <Viz.HorizontalIntervalSeries
            data={[{ category: "a", estimate: 8, lower: -1, upper: 12 }]}
            category="category"
            estimate="estimate"
            lower="lower"
            upper="upper"
            categoryScale="category"
            valueScale="value"
            onPointerDown={handler}
          />
        </Viz.LinearScale>
      </Viz.PointScale>
    </Clip>,
  );
  runtime.flush();
  const ctx = canvas.getContext("2d")!;
  expect(ctx.getImageData(60, 40, 1, 1).data[3]).toBeGreaterThan(0);
  expect(ctx.getImageData(160, 40, 1, 1).data[3]).toBe(0);
  const rect = canvas.getBoundingClientRect();
  for (const x of [60, 160])
    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: rect.left + x,
        clientY: rect.top + 40,
        bubbles: true,
      }),
    );
  expect(handler).toHaveBeenCalledTimes(1);
});

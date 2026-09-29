import {
  Absolute,
  Circle,
  Group,
  Rectangle,
  signal,
  useCanvasContext,
} from "@crc/core";
import { Axis, LineSeries, Scale, ScaleAdjust } from "@crc/viz";
import { afterEach, expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it("batches ordered runs with real gaps and supports both accessor forms", () => {
  runtime = testRuntime();
  const moves = vi.spyOn(Path2D.prototype, "moveTo");
  const lines = vi.spyOn(Path2D.prototype, "lineTo");
  const strokes = vi.spyOn(CanvasRenderingContext2D.prototype, "stroke");
  const data = [
    { x: 0, y: 0 },
    { x: 2, y: 2 },
    { x: 4, y: null },
    { x: 6, y: 6 },
    { x: 10, y: 10 },
  ];
  runtime.mount(
    <Scale id="x" type="linear" domain={[0, 10]} range={[0, 200]}>
      <Scale id="y" type="linear" domain={[0, 10]} range={[100, 0]}>
        <LineSeries data={data} x="x" y={(d) => d.y} xScale="x" yScale="y" />
      </Scale>
    </Scale>,
  );
  runtime.flush();
  expect(moves.mock.calls).toEqual([
    [0, 100],
    [120, 40],
  ]);
  expect(lines.mock.calls).toEqual([
    [40, 80],
    [200, 0],
  ]);
  expect(strokes).toHaveBeenCalledTimes(1);
});

it("places axes at the local frame edges and changes ScaleAdjust axes without changing hook order", () => {
  runtime = testRuntime();
  const positions: number[][] = [];
  function Dot() {
    const t = useCanvasContext().getTransform();
    positions.push([t.e, t.f]);
    return <Circle style={{ radius: 3 }} />;
  }
  const fillText = observeTextPositions();
  const both = signal(false);
  function Marker() {
    return both.get() ? (
      <ScaleAdjust x={5} xScale="x" y={5} yScale="y">
        <Dot />
      </ScaleAdjust>
    ) : (
      <ScaleAdjust x={5} xScale="x">
        <Dot />
      </ScaleAdjust>
    );
  }
  runtime.mount(
    <Scale id="x" type="linear" domain={[0, 10]} range={[0, 200]}>
      <Scale id="y" type="linear" domain={[0, 10]} range={[100, 0]}>
        <Axis scale="x" position="bottom" tickCount={3} />
        <Axis scale="y" position="left" tickCount={3} />
        <Marker />
      </Scale>
    </Scale>,
  );
  runtime.flush();
  expect(
    fillText.some(
      ([text, x, y]) => text === "5" && x === 100 && y === 410,
    ),
  ).toBe(true);
  expect(positions).toContainEqual([100, 0]);
  both.set(true);
  runtime.flush();
  expect(positions).toContainEqual([100, 50]);
});

it("hits the stroke and bubbles ordinary events while the gap falls through", () => {
  runtime = testRuntime();
  const events: string[] = [];
  const canvas = runtime.mount(
    <Group onPointerDown={() => events.push("ancestor")}>
      <Rectangle
        style={{ width: 600, height: 400, fill: "white" }}
        onPointerDown={() => events.push("background")}
      />
      <Scale id="x" type="linear" domain={[0, 10]} range={[0, 200]}>
        <Scale id="y" type="linear" domain={[0, 10]} range={[100, 0]}>
          <LineSeries
            data={[
              { x: 0, y: 0 },
              { x: 2, y: 2 },
              { x: 4, y: null },
              { x: 6, y: 6 },
              { x: 10, y: 10 },
            ]}
            x="x"
            y="y"
            xScale="x"
            yScale="y"
            onPointerDown={() => events.push("line")}
          />
        </Scale>
      </Scale>
    </Group>,
  );
  runtime.flush();
  function click(x: number, y: number) {
    const r = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: r.left + x,
        clientY: r.top + y,
        bubbles: true,
      }),
    );
  }
  click(20, 90);
  expect(events).toEqual(["line", "ancestor"]);
  events.length = 0;
  click(80, 60);
  expect(events).toEqual(["background", "ancestor"]);
});

it("skips excluded accessors and observes a direct static style signal", () => {
  runtime = testRuntime();
  const color = signal("#ff0000");
  const seen: number[] = [];
  const colors: string[] = [];
  const nativeStroke = CanvasRenderingContext2D.prototype.stroke;
  vi.spyOn(CanvasRenderingContext2D.prototype, "stroke").mockImplementation(
    function (this: CanvasRenderingContext2D, path?: Path2D) {
      colors.push(String(this.strokeStyle));
      if (path) nativeStroke.call(this, path);
      else Reflect.apply(nativeStroke, this, []);
    },
  );
  runtime.mount(
    <Scale id="x" type="linear" domain={[0, 10]} range={[0, 200]}>
      <Scale id="y" type="linear" domain={[0, 10]} range={[100, 0]}>
        <LineSeries
          data={[0, 1, 2]}
          defined={(value) => value !== 2}
          x={(value: number) => {
            seen.push(value);
            return value;
          }}
          y={(value: number) => value}
          xScale="x"
          yScale="y"
          style={{ stroke: color }}
        />
      </Scale>
    </Scale>,
  );
  runtime.flush();
  expect(seen).toEqual([0, 1]);
  expect(colors).toEqual(["#ff0000"]);
  color.set("#0000ff");
  runtime.flush();
  expect(colors).toEqual(["#ff0000", "#0000ff"]);
});

it("reads signal data only in the series receiver, without forwarding it into Path", () => {
  runtime = testRuntime();
  const data = signal([
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ]);
  const read = vi.spyOn(data, "get");
  runtime.mount(
    <Scale id="x" type="linear" domain={[0, 1]} range={[0, 100]}>
      <Scale id="y" type="linear" domain={[0, 1]} range={[100, 0]}>
        <LineSeries data={data} x="x" y="y" xScale="x" yScale="y" />
      </Scale>
    </Scale>,
  );
  runtime.flush();
  expect(read).toHaveBeenCalledTimes(1);
  data.set([
    { x: 0, y: 1 },
    { x: 1, y: 0 },
  ]);
  runtime.flush();
  expect(read).toHaveBeenCalledTimes(2);
});

it("formats original tick values in an allocated reversed bottom axis", () => {
  runtime = testRuntime();
  const formatted: number[][] = [];
  const text = observeTextPositions();
  runtime.mount(
    <Absolute>
      <Scale
        id="x"
        type="linear"
        domain={[0, 10]}
        range="width"
        reverse
        style={{ width: 240, height: 120 }}
      >
        <Axis
          scale="x"
          position="bottom"
          tickCount={3}
          tickFormat={(value, index) => {
            formatted.push([value, index]);
            return `v${value}`;
          }}
        />
      </Scale>
    </Absolute>,
  );
  runtime.flush();
  expect(formatted).toEqual([
    [0, 0],
    [5, 1],
    [10, 2],
  ]);
  expect(text).toEqual([
    ["v0", 240, 130],
    ["v5", 120, 130],
    ["v10", 0, 130],
  ]);
});

it("keeps a large series as one painted batch", () => {
  runtime = testRuntime();
  const stroke = vi.spyOn(CanvasRenderingContext2D.prototype, "stroke");
  const data = Array.from({ length: 20000 }, (_, i) => ({
    x: i,
    y: Math.sin(i / 100),
  }));
  runtime.mount(
    <Scale id="x" type="linear" domain={[0, 19999]} range={[0, 600]}>
      <Scale id="y" type="linear" domain={[-1, 1]} range={[400, 0]}>
        <LineSeries data={data} x="x" y="y" xScale="x" yScale="y" />
      </Scale>
    </Scale>,
  );
  runtime.flush();
  expect(stroke).toHaveBeenCalledTimes(1);
});

function observeTextPositions(): Array<[string, number, number]> {
  const positions: Array<[string, number, number]> = [];
  const original = CanvasRenderingContext2D.prototype.fillText;
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(function (this: CanvasRenderingContext2D, label, x, y, maxWidth) {
    const point = this.getTransform().transformPoint({ x, y });
    positions.push([label, point.x, point.y]);
    if (maxWidth === undefined) original.call(this, label, x, y);
    else original.call(this, label, x, y, maxWidth);
  });
  return positions;
}

import { Circle, Group, Rectangle } from "@pibbl/core";
import { PointSeries, Scale } from "@pibbl/core/viz";
import { afterEach, expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
const rows = [
  { x: 2, y: 3 },
  { x: 4, y: null },
  { x: 8, y: 9 },
];
function press(canvas: HTMLCanvasElement, x: number, y: number) {
  const rect = canvas.getBoundingClientRect();
  canvas.dispatchEvent(
    new PointerEvent("pointerdown", {
      clientX: rect.left + x,
      clientY: rect.top + y,
      bubbles: true,
    }),
  );
}
it("maps valid dots, skips missing rows, and leaves space between dots untargeted", () => {
  runtime = testRuntime();
  const events: string[] = [];
  const style = vi.fn(() => ({ fill: "red", radius: 3 }));
  const canvas = runtime.mount(
    <Group onPointerDown={() => events.push("parent")}>
      <Rectangle
        style={{ width: 600, height: 400, fill: "white" }}
        onPointerDown={() => events.push("background")}
      />
      <Scale id="x" type="linear" domain={[0, 10]} range={[0, 200]}>
        <Scale id="y" type="linear" domain={[0, 10]} range={[0, 100]} reverse>
          <PointSeries
            data={rows}
            x="x"
            y="y"
            xScale="x"
            yScale="y"
            style={style}
            onPointerDown={() => events.push("point")}
          />
        </Scale>
      </Scale>
    </Group>,
  );
  runtime.flush();
  expect(style).toHaveBeenCalledTimes(2);
  expect([...canvas.getContext("2d")!.getImageData(40, 70, 1, 1).data]).toEqual(
    [255, 0, 0, 255],
  );
  press(canvas, 40, 70);
  press(canvas, 160, 10);
  press(canvas, 100, 50);
  expect(events).toEqual([
    "point",
    "parent",
    "point",
    "parent",
    "background",
    "parent",
  ]);
});
it("preserves overlapping translucent fill and stroke order", () => {
  runtime = testRuntime();
  const style = {
    radius: 12,
    fill: "red",
    stroke: "blue",
    strokeWidth: 4,
    opacity: 0.5,
  };
  const canvas = runtime.mount(
    <>
      <Scale id="x" type="linear" domain={[0, 100]} range={[0, 100]}>
        <Scale id="y" type="linear" domain={[0, 100]} range={[0, 100]}>
          <PointSeries
            data={[
              { x: 30, y: 30 },
              { x: 40, y: 30 },
            ]}
            x="x"
            y="y"
            xScale="x"
            yScale="y"
            style={style}
          />
        </Scale>
      </Scale>
      <Group style={{ translateY: 100 }}>
        <Circle style={{ ...style, cx: 30, cy: 30 }} />
        <Circle style={{ ...style, cx: 40, cy: 30 }} />
      </Group>
    </>,
  );
  runtime.flush();
  const ctx = canvas.getContext("2d")!;
  for (const [x, y] of [
    [30, 30],
    [40, 30],
    [40, 22],
    [20, 30],
  ])
    expect([...ctx.getImageData(x, y, 1, 1).data]).toEqual([
      ...ctx.getImageData(x, y + 100, 1, 1).data,
    ]);
});
it("none passes through and defined false skips accessors and style", () => {
  runtime = testRuntime();
  const x = vi.fn(() => 2);
  const style = vi.fn(() => ({ radius: 3 }));
  const hit = vi.fn();
  const canvas = runtime.mount(
    <>
      <Rectangle
        style={{ width: 600, height: 400, fill: "white" }}
        onPointerDown={hit}
      />
      <Scale id="x" type="linear" domain={[0, 10]} range={[0, 200]}>
        <Scale id="y" type="linear" domain={[0, 10]} range={[100, 0]}>
          <PointSeries
            data={rows}
            defined={(_, i) => i === 0}
            x={x}
            y="y"
            xScale="x"
            yScale="y"
            style={style}
            pointerEvents="none"
          />
        </Scale>
      </Scale>
    </>,
  );
  runtime.flush();
  press(canvas, 40, 70);
  expect(hit).toHaveBeenCalledOnce();
  expect(x).toHaveBeenCalledOnce();
  expect(style).toHaveBeenCalledOnce();
});
it("stroke-only rings leave holes and different stroke widths retain their exact union", () => {
  runtime = testRuntime();
  const events: string[] = [];
  const canvas = runtime.mount(
    <>
      <Rectangle
        style={{ width: 600, height: 400, fill: "white" }}
        onPointerDown={() => events.push("background")}
      />
      <Scale id="x" type="linear" domain={[0, 100]} range={[0, 100]}>
        <Scale id="y" type="linear" domain={[0, 100]} range={[0, 100]}>
          <PointSeries
            data={[
              { x: 30, y: 30 },
              { x: 70, y: 30 },
            ]}
            x="x"
            y="y"
            xScale="x"
            yScale="y"
            style={(_, i) => ({
              radius: 10,
              fill: "",
              stroke: "red",
              strokeWidth: i ? 8 : 2,
            })}
            onPointerDown={() => events.push("ring")}
          />
        </Scale>
      </Scale>
    </>,
  );
  runtime.flush();
  press(canvas, 30, 30);
  press(canvas, 39, 30);
  press(canvas, 70, 30);
  press(canvas, 82, 30);
  expect(events).toEqual(["background", "ring", "background", "ring"]);
});

import { signal } from "@pibbl/core";
import { getPibblInstance } from "../../../src/lib/global-state.js";
it("keeps component and target counts constant as the dot batch grows and releases them on disposal", () => {
  runtime = testRuntime();
  const rows = signal(
    Array.from({ length: 10 }, (_, i) => ({ x: i % 100, y: i % 100 })),
  );
  const canvas = runtime.mount(
    <Scale id="x" type="linear" domain={[0, 100]} range={[0, 200]}>
      <Scale id="y" type="linear" domain={[0, 100]} range={[100, 0]}>
        <PointSeries data={rows} x="x" y="y" xScale="x" yScale="y" />
      </Scale>
    </Scale>,
  );
  runtime.flush();
  const instance = getPibblInstance(canvas);
  const count = [instance.refs.size, instance.eventRoot.targets.size];
  rows.set(
    Array.from({ length: 10000 }, (_, i) => ({ x: i % 100, y: i % 100 })),
  );
  runtime.flush();
  expect([instance.refs.size, instance.eventRoot.targets.size]).toEqual(count);
  expect(instance.eventRoot.targets.size).toBe(1);
  runtime.dispose();
  expect(instance.refs.size).toBe(0);
  expect(instance.eventRoot.targets.size).toBe(0);
  rows.set([]);
  expect(runtime.pending).toBe(0);
});

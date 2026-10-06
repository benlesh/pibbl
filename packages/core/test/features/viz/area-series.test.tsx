import { Clip, Group, Rectangle, signal, type PibblNode } from "@pibbl/core";
import {
  AreaSeries,
  LinearScale,
  LogScale,
  SymlogScale,
  UTCScale,
} from "@pibbl/core/viz";
import { afterEach, expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";

let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

function press(canvas: HTMLCanvasElement, x: number, y: number) {
  const bounds = canvas.getBoundingClientRect();
  canvas.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      clientX: bounds.left + x,
      clientY: bounds.top + y,
    }),
  );
}

it("closes each observed run to the explicit data baseline without bridging gaps", () => {
  runtime = testRuntime();
  const moves = vi.spyOn(Path2D.prototype, "moveTo");
  const lines = vi.spyOn(Path2D.prototype, "lineTo");
  const closes = vi.spyOn(Path2D.prototype, "closePath");
  const baseline = signal(1);
  runtime.mount(
    <LinearScale id="x" domain={[0, 10]} range={[0, 200]}>
      <LinearScale id="y" domain={[0, 10]} range={[100, 0]}>
        <AreaSeries
          data={[
            { x: 0, y: 2 },
            { x: 2, y: 4 },
            { x: 4, y: null },
            { x: 6, y: 3 },
            { x: 8, y: 5 },
            { x: 9, y: null },
            { x: 10, y: 8 },
          ]}
          x="x"
          y="y"
          xScale="x"
          yScale="y"
          baseline={baseline}
        />
      </LinearScale>
    </LinearScale>,
  );
  runtime.flush();
  expect(moves.mock.calls).toEqual([
    [0, 80],
    [120, 70],
  ]);
  expect(lines.mock.calls).toEqual([
    [40, 60],
    [40, 90],
    [0, 90],
    [160, 50],
    [160, 90],
    [120, 90],
  ]);
  expect(closes).toHaveBeenCalledTimes(2);
  lines.mockClear();
  baseline.set(0);
  runtime.flush();
  expect(lines.mock.calls).toEqual([
    [40, 60],
    [40, 100],
    [0, 100],
    [160, 50],
    [160, 100],
    [120, 100],
  ]);
  runtime.dispose();
  baseline.set(2);
  expect(runtime.pending).toBe(0);
});

it("keeps duplicate coordinates and baseline crossings, while empty and lone runs draw nothing", () => {
  runtime = testRuntime();
  const moves = vi.spyOn(Path2D.prototype, "moveTo");
  const lines = vi.spyOn(Path2D.prototype, "lineTo");
  const closes = vi.spyOn(Path2D.prototype, "closePath");
  const x = vi.fn((datum: { x: number }) => datum.x);
  runtime.mount(
    <LinearScale id="x" domain={[0, 10]} range={[0, 100]}>
      <LinearScale id="y" domain={[-10, 10]} range={[100, 0]}>
        <AreaSeries
          data={[
            { x: 0, y: 2 },
            { x: 0, y: 3 },
            { x: 10, y: -2 },
            { x: 8, y: 9 },
          ]}
          x={x}
          y="y"
          xScale="x"
          yScale="y"
          baseline={0}
          defined={(_, index) => index !== 3}
        />
        <AreaSeries<{ x: number; y: number }>
          data={[]}
          x="x"
          y="y"
          xScale="x"
          yScale="y"
          baseline={0}
        />
        <AreaSeries
          data={[{ x: 4, y: 4 }]}
          x="x"
          y="y"
          xScale="x"
          yScale="y"
          baseline={0}
        />
      </LinearScale>
    </LinearScale>,
  );
  runtime.flush();
  expect(x).toHaveBeenCalledTimes(3);
  expect(moves.mock.calls).toEqual([[0, 40]]);
  expect(lines.mock.calls).toEqual([
    [0, 35],
    [100, 60],
    [100, 50],
    [0, 50],
  ]);
  expect(closes).toHaveBeenCalledTimes(1);
});

it("maps the same area contract through UTC, logarithmic, and symlog continuous scales", () => {
  const draw = (node: PibblNode, samples: readonly [number, number][]) => {
    runtime = testRuntime();
    const canvas = runtime.mount(node);
    runtime.flush();
    const context = canvas.getContext("2d")!;
    for (const [x, y] of samples)
      expect(context.getImageData(x, y, 1, 1).data[3]).toBeGreaterThan(0);
    runtime.dispose();
  };
  const start = Date.UTC(2024, 0, 1);
  const end = Date.UTC(2024, 0, 11);
  draw(
    <UTCScale id="x" domain={[start, end]} range={[0, 200]}>
      <LinearScale id="y" domain={[0, 10]} range={[100, 0]}>
        <AreaSeries
          data={[
            { x: start, y: 8 },
            { x: end, y: 4 },
          ]}
          x="x"
          y="y"
          xScale="x"
          yScale="y"
          baseline={0}
          style={{ opacity: 1 }}
        />
      </LinearScale>
    </UTCScale>,
    [[100, 80]],
  );
  draw(
    <LogScale id="x" domain={[1, 100]} range={[200, 0]}>
      <LinearScale id="y" domain={[0, 10]} range={[100, 0]}>
        <AreaSeries
          data={[
            { x: 1, y: 8 },
            { x: 100, y: 4 },
          ]}
          x="x"
          y="y"
          xScale="x"
          yScale="y"
          baseline={0}
          style={{ opacity: 1 }}
        />
      </LinearScale>
    </LogScale>,
    [[100, 80]],
  );
  draw(
    <SymlogScale id="x" domain={[-9, 9]} range={[0, 200]} constant={1}>
      <LinearScale id="y" domain={[0, 10]} range={[100, 0]}>
        <AreaSeries
          data={[
            { x: -9, y: 8 },
            { x: 0, y: 6 },
            { x: 9, y: 4 },
          ]}
          x="x"
          y="y"
          xScale="x"
          yScale="y"
          baseline={0}
          style={{ opacity: 1 }}
        />
      </LinearScale>
    </SymlogScale>,
    [[100, 80]],
  );
});

it("replaces whole data and style signals and releases their subscriptions after disposal", () => {
  runtime = testRuntime();
  const data = signal<readonly { x: number; y: number }[]>([
    { x: 0, y: 8 },
    { x: 10, y: 4 },
  ]);
  const style = signal({ fill: "red", opacity: 1 });
  const canvas = runtime.mount(
    <LinearScale id="x" domain={[0, 10]} range={[0, 100]}>
      <LinearScale id="y" domain={[0, 10]} range={[100, 0]}>
        <AreaSeries
          data={data}
          x="x"
          y="y"
          xScale="x"
          yScale="y"
          baseline={0}
          style={style}
        />
      </LinearScale>
    </LinearScale>,
  );
  runtime.flush();
  const pixel = () => [
    ...canvas.getContext("2d")!.getImageData(50, 80, 1, 1).data,
  ];
  expect(pixel()).toEqual([255, 0, 0, 255]);
  style.set({ fill: "blue", opacity: 1 });
  runtime.flush();
  expect(pixel()).toEqual([0, 0, 255, 255]);
  data.set([{ x: 5, y: 4 }]);
  runtime.flush();
  expect(pixel()[3]).toBe(0);
  runtime.dispose();
  data.set([
    { x: 0, y: 8 },
    { x: 10, y: 4 },
  ]);
  style.set({ fill: "green", opacity: 1 });
  expect(runtime.pending).toBe(0);
});

it("uses filled geometry for hits while preserving transformed Clip and gap boundaries", () => {
  runtime = testRuntime();
  const events: string[] = [];
  const clip = new Path2D();
  clip.rect(0, 0, 60, 100);
  const canvas = runtime.mount(
    <>
      <Rectangle
        style={{ width: 600, height: 400, fill: "white" }}
        onPointerDown={() => events.push("background")}
      />
      <Group style={{ translateX: 20, translateY: 10, scaleX: 2 }}>
        <Clip style={{ d: clip }}>
          <LinearScale id="x" domain={[0, 10]} range={[0, 100]}>
            <LinearScale id="y" domain={[0, 10]} range={[100, 0]}>
              <AreaSeries
                data={[
                  { x: 0, y: 8 },
                  { x: 4, y: 6 },
                  { x: 5, y: null },
                  { x: 6, y: 5 },
                  { x: 10, y: 4 },
                ]}
                x="x"
                y="y"
                xScale="x"
                yScale="y"
                baseline={0}
                onPointerDown={() => events.push("area")}
              />
            </LinearScale>
          </LinearScale>
        </Clip>
      </Group>
    </>,
  );
  runtime.flush();
  press(canvas, 100, 80);
  press(canvas, 140, 80);
  press(canvas, 170, 80);
  expect(events).toEqual(["area", "background", "background"]);
});

it("fails closed for invalid baseline, log-zero baseline, data, and opacity", () => {
  const invalid = [
    <AreaSeries
      data={[{ x: 0, y: 1 }]}
      x="x"
      y="y"
      xScale="x"
      yScale="y"
      baseline={Infinity}
    />,
    <AreaSeries
      data={null as never}
      x="x"
      y="y"
      xScale="x"
      yScale="y"
      baseline={0}
    />,
    <AreaSeries
      data={[{ x: 0, y: 1 }]}
      x="x"
      y="y"
      xScale="x"
      yScale="y"
      baseline={0}
      style={{ opacity: 2 }}
    />,
  ];
  for (const series of invalid) {
    runtime = testRuntime();
    runtime.mount(
      <LinearScale id="x" domain={[0, 10]} range={[0, 100]}>
        <LinearScale id="y" domain={[0, 10]} range={[100, 0]}>
          {series}
        </LinearScale>
      </LinearScale>,
    );
    expect(() => runtime.flush()).toThrow();
    expect(runtime.pending).toBe(0);
    runtime.dispose();
  }
  runtime = testRuntime();
  runtime.mount(
    <LinearScale id="x" domain={[0, 10]} range={[0, 100]}>
      <LogScale id="y" domain={[1, 10]} range={[100, 0]}>
        <AreaSeries
          data={[
            { x: 0, y: 2 },
            { x: 10, y: 4 },
          ]}
          x="x"
          y="y"
          xScale="x"
          yScale="y"
          baseline={0}
        />
      </LogScale>
    </LinearScale>,
  );
  expect(() => runtime.flush()).toThrow(/positive/);
  expect(runtime.pending).toBe(0);
});

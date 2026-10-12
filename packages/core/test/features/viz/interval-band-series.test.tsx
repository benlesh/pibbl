import { Clip, Group, Rectangle, signal, type PibblNode } from "@pibbl/core";
import {
  IntervalBandSeries,
  LinearScale,
  LogScale,
  SymlogScale,
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
it("closes each matching observed upper/lower run and leaves missing-bound gaps", () => {
  runtime = testRuntime();
  const move = vi.spyOn(Path2D.prototype, "moveTo"),
    line = vi.spyOn(Path2D.prototype, "lineTo"),
    close = vi.spyOn(Path2D.prototype, "closePath");
  runtime.mount(
    <LinearScale id="x" domain={[0, 10]} range={[0, 200]}>
      <LinearScale id="y" domain={[0, 10]} range={[100, 0]}>
        <IntervalBandSeries
          data={[
            { x: 0, lo: 1, hi: 3 },
            { x: 2, lo: 2, hi: 5 },
            { x: 4, lo: null, hi: 6 },
            { x: 6, lo: 3, hi: 7 },
            { x: 8, lo: 4, hi: 8 },
          ]}
          x="x"
          lower="lo"
          upper="hi"
          xScale="x"
          yScale="y"
        />
      </LinearScale>
    </LinearScale>,
  );
  runtime.flush();
  expect(move.mock.calls).toEqual([
    [0, 70],
    [120, 30],
  ]);
  expect(line.mock.calls).toEqual([
    [40, 50],
    [40, 80],
    [0, 90],
    [160, 20],
    [160, 60],
    [120, 70],
  ]);
  expect(close).toHaveBeenCalledTimes(2);
});

it("splits missing bounds, keeps equal bounds, and leaves isolated observations without a polygon", () => {
  runtime = testRuntime();
  const move = vi.spyOn(Path2D.prototype, "moveTo"),
    line = vi.spyOn(Path2D.prototype, "lineTo"),
    close = vi.spyOn(Path2D.prototype, "closePath");
  runtime.mount(
    <LinearScale id="x" domain={[0, 10]} range={[0, 100]}>
      <LinearScale id="y" domain={[0, 10]} range={[100, 0]}>
        <IntervalBandSeries
          data={[
            { x: 0, lo: 2, hi: 2 },
            { x: 2, lo: 2, hi: 2 },
            { x: 4, lo: 2, hi: null },
            { x: 6, lo: 3, hi: 5 },
          ]}
          x="x"
          lower="lo"
          upper="hi"
          xScale="x"
          yScale="y"
        />
        <IntervalBandSeries
          data={[{ x: 8, lo: 2, hi: 4 }]}
          x="x"
          lower="lo"
          upper="hi"
          xScale="x"
          yScale="y"
        />
      </LinearScale>
    </LinearScale>,
  );
  runtime.flush();
  expect(move.mock.calls).toEqual([[0, 80]]);
  expect(line.mock.calls).toEqual([
    [20, 80],
    [20, 80],
    [0, 80],
  ]);
  expect(close).toHaveBeenCalledTimes(1);
});

it("maps bands through reverse logarithmic and symlog ranges", () => {
  const draw = (node: PibblNode) => {
    runtime = testRuntime();
    const canvas = runtime.mount(node);
    runtime.flush();
    expect(
      canvas.getContext("2d")!.getImageData(100, 50, 1, 1).data[3],
    ).toBeGreaterThan(0);
    runtime.dispose();
  };
  draw(
    <LogScale id="x" domain={[1, 100]} range={[200, 0]}>
      <LinearScale id="y" domain={[0, 10]} range={[100, 0]}>
        <IntervalBandSeries
          data={[
            { x: 1, lo: 2, hi: 8 },
            { x: 100, lo: 3, hi: 7 },
          ]}
          x="x"
          lower="lo"
          upper="hi"
          xScale="x"
          yScale="y"
          style={{ opacity: 1 }}
        />
      </LinearScale>
    </LogScale>,
  );
  draw(
    <SymlogScale id="x" domain={[-9, 9]} range={[0, 200]} constant={1}>
      <LinearScale id="y" domain={[0, 10]} range={[100, 0]} reverse>
        <IntervalBandSeries
          data={[
            { x: -9, lo: 2, hi: 8 },
            { x: 0, lo: 3, hi: 7 },
            { x: 9, lo: 4, hi: 6 },
          ]}
          x="x"
          lower="lo"
          upper="hi"
          xScale="x"
          yScale="y"
          style={{ opacity: 1 }}
        />
      </LinearScale>
    </SymlogScale>,
  );
});

it("replaces whole data and style signals and releases both after disposal", () => {
  runtime = testRuntime();
  const data = signal<readonly { x: number; lo: number; hi: number }[]>([
      { x: 0, lo: 2, hi: 8 },
      { x: 10, lo: 3, hi: 7 },
    ]),
    style = signal({ fill: "red", opacity: 1 });
  const canvas = runtime.mount(
    <LinearScale id="x" domain={[0, 10]} range={[0, 100]}>
      <LinearScale id="y" domain={[0, 10]} range={[100, 0]}>
        <IntervalBandSeries
          data={data}
          x="x"
          lower="lo"
          upper="hi"
          xScale="x"
          yScale="y"
          style={style}
        />
      </LinearScale>
    </LinearScale>,
  );
  runtime.flush();
  const pixel = () => [
    ...canvas.getContext("2d")!.getImageData(50, 50, 1, 1).data,
  ];
  expect(pixel()).toEqual([255, 0, 0, 255]);
  style.set({ fill: "blue", opacity: 1 });
  runtime.flush();
  expect(pixel()).toEqual([0, 0, 255, 255]);
  data.set([{ x: 5, lo: 2, hi: 8 }]);
  runtime.flush();
  expect(pixel()[3]).toBe(0);
  runtime.dispose();
  data.set([
    { x: 0, lo: 2, hi: 8 },
    { x: 10, lo: 3, hi: 7 },
  ]);
  style.set({ fill: "green", opacity: 1 });
  expect(runtime.pending).toBe(0);
});

it("uses the filled band for transformed and clipped target geometry while gaps pass through", () => {
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
              <IntervalBandSeries
                data={[
                  { x: 0, lo: 2, hi: 8 },
                  { x: 4, lo: 3, hi: 7 },
                  { x: 5, lo: null, hi: 6 },
                  { x: 6, lo: 3, hi: 6 },
                  { x: 10, lo: 4, hi: 5 },
                ]}
                x="x"
                lower="lo"
                upper="hi"
                xScale="x"
                yScale="y"
                onPointerDown={() => events.push("band")}
              />
            </LinearScale>
          </LinearScale>
        </Clip>
      </Group>
    </>,
  );
  runtime.flush();
  press(canvas, 100, 60);
  press(canvas, 140, 60);
  press(canvas, 170, 60);
  expect(events).toEqual(["band", "background", "background"]);
});

it("rejects an inverted datum with its index and leaves no pending work", () => {
  runtime = testRuntime();
  runtime.mount(
    <LinearScale id="x" domain={[0, 10]} range={[0, 100]}>
      <LinearScale id="y" domain={[0, 10]} range={[100, 0]}>
        <IntervalBandSeries
          data={[
            { x: 0, lo: 2, hi: 4 },
            { x: 1, lo: 8, hi: 3 },
          ]}
          x="x"
          lower="lo"
          upper="hi"
          xScale="x"
          yScale="y"
        />
      </LinearScale>
    </LinearScale>,
  );
  expect(() => runtime.flush()).toThrow(/index 1/);
  expect(runtime.pending).toBe(0);
});

import {
  Rectangle,
  Group,
  Clip,
  signal,
  useReaction,
  useSignal,
  type PibblNode,
} from "@pibbl/core";
import { PointSeries, PlotSeries, Scale } from "@pibbl/core/viz";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
import { getPibblInstance } from "../../../src/lib/global-state.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
function Scales({ children }: { children: PibblNode }) {
  return (
    <Scale id="x" type="linear" domain={[0, 10]} range={[0, 100]}>
      <Scale id="y" type="linear" domain={[0, 10]} range={[100, 0]}>
        {children}
      </Scale>
    </Scale>
  );
}
function press(canvas: HTMLCanvasElement, x: number, y: number) {
  const r = canvas.getBoundingClientRect();
  canvas.dispatchEvent(
    new PointerEvent("pointerdown", {
      clientX: r.left + x,
      clientY: r.top + y,
      bubbles: true,
    }),
  );
}
it("respects zero radius, transparent targeting, transforms, and clips", () => {
  runtime = testRuntime();
  const radius = signal(0),
    events: string[] = [];
  const clip = new Path2D();
  clip.rect(0, 0, 55, 100);
  const canvas = runtime.mount(
    <>
      <Rectangle
        style={{ width: 600, height: 400, fill: "white" }}
        onPointerDown={() => events.push("background")}
      />
      <Group style={{ translateX: 20, translateY: 10, scaleX: 2 }}>
        <Clip style={{ d: clip }}>
          <Scales>
            <PointSeries
              data={[{ x: 5, y: 5 }]}
              x="x"
              y="y"
              xScale="x"
              yScale="y"
              style={{ radius, opacity: 0 }}
              onPointerDown={() => events.push("point")}
            />
          </Scales>
        </Clip>
      </Group>
    </>,
  );
  runtime.flush();
  press(canvas, 140, 60);
  radius.set(10);
  runtime.flush();
  press(canvas, 140, 60);
  press(canvas, 158, 60);
  expect(events).toEqual(["background", "point", "background"]);
});
it("replaces callback signal branches and releases batched and custom ownership", () => {
  runtime = testRuntime();
  const branch = signal(true),
    a = signal("red"),
    b = signal("blue"),
    visible = signal(true);
  let releases = 0;
  function Mark() {
    const own = useSignal(0);
    own.get();
    useReaction(
      () => () => {
        releases++;
      },
      [],
    );
    return <Rectangle style={{ width: 4, height: 4, fill: "blue" }} />;
  }
  function Scene() {
    return (
      <Scales>
        {visible.get() ? (
          <>
            <PointSeries
              data={[{ x: 1, y: 1 }]}
              x="x"
              y="y"
              xScale="x"
              yScale="y"
              style={() => ({ fill: branch.get() ? a.get() : b.get() })}
            />
            <PlotSeries
              data={[{ x: 1, y: 1 }]}
              x="x"
              y="y"
              xScale="x"
              yScale="y"
              render={() => <Mark />}
            />
          </>
        ) : null}
      </Scales>
    );
  }
  const canvas = runtime.mount(<Scene />);
  runtime.flush();
  branch.set(false);
  runtime.flush();
  a.set("green");
  expect(runtime.pending).toBe(0);
  b.set("purple");
  expect(runtime.pending).toBe(1);
  runtime.flush();
  visible.set(false);
  runtime.flush();
  expect(releases).toBe(1);
  b.set("orange");
  expect(runtime.pending).toBe(0);
  const instance = getPibblInstance(canvas);
  runtime.dispose();
  expect(instance.refs.size).toBe(0);
  expect(instance.eventRoot.targets.size).toBe(0);
  visible.set(true);
  expect(runtime.pending).toBe(0);
});
it.each([
  { radius: -1 },
  { radius: Infinity },
  { strokeWidth: -1 },
  { opacity: 2 },
  { opacity: NaN },
  { unexpected: 1 },
])("fails closed on invalid point style %j", (style) => {
  runtime = testRuntime();
  runtime.mount(
    <Scales>
      <PointSeries
        data={[{ x: 1, y: 1 }]}
        x="x"
        y="y"
        xScale="x"
        yScale="y"
        style={style as never}
      />
    </Scales>,
  );
  expect(() => runtime.flush()).toThrow();
  expect(runtime.pending).toBe(0);
});
it.each(["duplicate", "invalid", "exception", "async", "foreign"])(
  "rejects unsupported custom row behavior: %s",
  (mode) => {
    runtime = testRuntime();
    runtime.mount(
      <Scales>
        <PlotSeries
          data={[
            { id: 1, x: 1, y: 1 },
            { id: "1", x: 2, y: 2 },
          ]}
          x="x"
          y="y"
          xScale="x"
          yScale="y"
          keyBy={
            mode === "duplicate"
              ? "id"
              : mode === "invalid"
                ? ((() => ({})) as never)
                : undefined
          }
          render={
            (() => {
              if (mode === "exception")
                throw new Error("custom render failure");
              if (mode === "async") return Promise.resolve(null);
              if (mode === "foreign") return { type: "div", props: {} };
              return null;
            }) as never
          }
        />
      </Scales>,
    );
    expect(() => runtime.flush()).toThrow();
  },
);
it("remounts rows after invalidation while preserving original-index fallback identity", () => {
  runtime = testRuntime();
  const rows = signal<readonly { x: number; y: number | null }[]>([
    { x: 0, y: null },
    { x: 1, y: 1 },
  ]);
  const owned: object[] = [];
  let cleanup = 0;
  function Mark() {
    owned.push(useSignal(0));
    useReaction(
      () => () => {
        cleanup++;
      },
      [],
    );
    return null;
  }
  runtime.mount(
    <Scales>
      <PlotSeries
        data={rows}
        x="x"
        y="y"
        xScale="x"
        yScale="y"
        render={() => <Mark />}
      />
    </Scales>,
  );
  runtime.flush();
  const first = owned[0];
  rows.set([
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ]);
  runtime.flush();
  expect(owned.at(-1)).toBe(first);
  rows.set([
    { x: 0, y: 0 },
    { x: 1, y: null },
  ]);
  runtime.flush();
  expect(cleanup).toBe(1);
  rows.set([
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ]);
  runtime.flush();
  expect(owned.at(-1)).not.toBe(first);
});

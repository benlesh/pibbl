import {
  Rectangle,
  signal,
  useCanvasContext,
  useSignal,
  useReaction,
  useLayoutBox,
} from "@crc/core";
import { PlotSeries, Scale } from "@crc/core/viz";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
it("places custom elements, preserves keyed state on reorder, and releases removed rows", () => {
  runtime = testRuntime();
  const rows = signal([
    { id: "a", x: 2, y: 3 },
    { id: "b", x: 8, y: 9 },
  ]);
  const states = new Map<string, unknown>();
  const positions = new Map<string, number[]>();
  const cleanup: string[] = [];
  const events: string[] = [];
  function Mark({ id }: { id: string }) {
    const own = useSignal(0);
    const ctx = useCanvasContext();
    const box = useLayoutBox();
    states.set(id, own);
    positions.set(id, [
      ctx.getTransform().e,
      ctx.getTransform().f,
      box.width,
      box.height,
    ]);
    useReaction(
      () => () => {
        cleanup.push(id);
      },
      [],
    );
    return (
      <Rectangle
        style={{ left: -5, top: -5, width: 10, height: 10, fill: "red" }}
        onPointerDown={() => {
          own.update((v) => v + 1);
          events.push(id);
        }}
      />
    );
  }
  function Scene() {
    return (
      <Scale id="x" type="linear" domain={[0, 10]} range={[0, 200]}>
        <Scale id="y" type="linear" domain={[0, 10]} range={[100, 0]}>
          <PlotSeries
            data={rows}
            x="x"
            y="y"
            xScale="x"
            yScale="y"
            keyBy="id"
            render={(d) => <Mark id={d.id} />}
            onPointerDown={() => events.push("series")}
          />
        </Scale>
      </Scale>
    );
  }
  const canvas = runtime.mount(<Scene />);
  runtime.flush();
  expect(positions.get("a")).toEqual([40, 70, 600, 400]);
  expect(positions.get("b")).toEqual([160, 10, 600, 400]);
  const state = states.get("a");
  const rect = canvas.getBoundingClientRect();
  canvas.dispatchEvent(
    new PointerEvent("pointerdown", {
      clientX: rect.left + 40,
      clientY: rect.top + 70,
      bubbles: true,
    }),
  );
  runtime.flush();
  expect(events).toEqual(["a", "series"]);
  rows.set([...rows.get()].reverse());
  runtime.flush();
  expect(states.get("a")).toBe(state);
  expect(cleanup).toEqual([]);
  rows.set(rows.get().filter((d) => d.id !== "a"));
  runtime.flush();
  expect(cleanup).toEqual(["a"]);
});
it("skips invalid rows and retains the row receiver while render returns null", () => {
  runtime = testRuntime();
  const value = signal<number | null>(3),
    visible = signal(false);
  const calls: string[] = [];
  function Scene() {
    return (
      <Scale id="x" type="linear" domain={[0, 10]} range={[0, 200]}>
        <Scale id="y" type="linear" domain={[0, 10]} range={[100, 0]}>
          <PlotSeries
            data={[
              { id: "a", x: 2, y: value.get() },
              { id: "bad", x: 5, y: null },
            ]}
            x="x"
            y="y"
            xScale="x"
            yScale="y"
            keyBy="id"
            render={(d) => {
              calls.push(d.id);
              return visible.get() ? (
                <Rectangle style={{ width: 3, height: 3, fill: "red" }} />
              ) : null;
            }}
          />
        </Scale>
      </Scale>
    );
  }
  runtime.mount(<Scene />);
  runtime.flush();
  expect(calls).toEqual(["a"]);
  visible.set(true);
  expect(runtime.pending).toBe(1);
  runtime.flush();
  expect(calls).toEqual(["a", "a"]);
  value.set(null);
  runtime.flush();
  visible.set(false);
  expect(runtime.pending).toBe(0);
  expect(calls).toEqual(["a", "a"]);
});

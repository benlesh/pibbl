import { Layer, signal, useSignal, Rectangle } from "@crc/core";
import { HoverData, Scale, type HoverQueryContext } from "@crc/core/viz";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
it("releases branch reads, removed receivers, and disposed sources", () => {
  runtime = testRuntime();
  const left = signal(1),
    right = signal(2),
    branch = signal(true),
    visible = signal(true);
  let value: number | undefined;
  function Scene() {
    return visible.get() ? (
      <HoverData query={() => (branch.get() ? left.get() : right.get())}>
        {(result) => {
          value = result;
          return null;
        }}
      </HoverData>
    ) : null;
  }
  runtime.mount(<Scene />);
  runtime.flush();
  expect(value).toBe(1);
  branch.set(false);
  runtime.flush();
  expect(value).toBe(2);
  left.set(3);
  expect(runtime.pending).toBe(0);
  right.set(4);
  expect(runtime.pending).toBe(1);
  runtime.flush();
  expect(value).toBe(4);
  visible.set(false);
  runtime.flush();
  right.set(5);
  branch.set(true);
  expect(runtime.pending).toBe(0);
  runtime.dispose();
  visible.set(true);
  left.set(6);
  expect(runtime.pending).toBe(0);
});
it("supports branch-dependent scale lookup without varying hook slots", () => {
  runtime = testRuntime();
  const branch = signal(true);
  let value = 0,
    retained: HoverQueryContext | undefined;
  runtime.mount(
    <Scale id="a" type="linear" domain={[0, 10]} range={[0, 100]}>
      <Scale id="b" type="linear" domain={[0, 10]} range={[0, 200]}>
        <HoverData
          query={(context) => {
            retained = context;
            return context.scale(branch.get() ? "a" : "b").map(2);
          }}
        >
          {(result) => {
            value = result!;
            return null;
          }}
        </HoverData>
      </Scale>
    </Scale>,
  );
  runtime.flush();
  expect(value).toBe(20);
  branch.set(false);
  runtime.flush();
  expect(value).toBe(40);
  expect(() => retained!.scale("a")).toThrow(/retained/);
});
it("isolates identically named providers across roots", () => {
  runtime = testRuntime();
  const values: number[] = [];
  for (const end of [100, 200])
    runtime.mount(
      <Scale id="x" type="linear" domain={[0, 10]} range={[0, end]}>
        <HoverData query={(context) => context.scale("x").map(5)}>
          {(value) => {
            values.push(value!);
            return null;
          }}
        </HoverData>
      </Scale>,
    );
  runtime.flush();
  expect(values).toEqual([50, 100]);
});
it("diagnoses scale lookup through a Layer boundary", () => {
  runtime = testRuntime();
  runtime.mount(
    <Scale id="x" type="linear" domain={[0, 10]} range={[0, 100]}>
      <Layer style={{ width: 100, height: 100 }}>
        <HoverData query={(context) => context.scale("x")}>
          {() => null}
        </HoverData>
      </Layer>
    </Scale>,
  );
  expect(() => runtime.flush()).toThrow(/Layer boundary/);
});
it.each(["query", "children", "write", "missing"])(
  "cleans up failed %s evaluation",
  (kind) => {
    runtime = testRuntime();
    const source = signal(1);
    runtime.mount(
      <HoverData
        query={(context) => {
          const value = source.get();
          if (kind === "query") throw new Error("query failed");
          if (kind === "write") source.set(value);
          if (kind === "missing") context.scale("missing");
          return value;
        }}
      >
        {() => {
          if (kind === "children") useSignal(0);
          return <Rectangle style={{ width: 10, height: 10, fill: "red" }} />;
        }}
      </HoverData>,
    );
    expect(() => runtime.flush()).toThrow();
    source.set(2);
    expect(runtime.pending).toBe(0);
  },
);

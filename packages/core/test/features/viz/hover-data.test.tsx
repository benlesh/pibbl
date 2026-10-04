import { signal, useConst } from "@crc/core";
import * as Viz from "@crc/core/viz";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
it("evaluates custom queries reactively and preserves returned component identity", () => {
  expect(Viz.HoverData).toBeTypeOf("function");
  runtime = testRuntime();
  const cursor = signal<number | null>(2),
    version = signal(0);
  const results: unknown[] = [],
    identities: object[] = [];
  function Mark() {
    identities.push(useConst(() => ({})));
    return null;
  }
  function View() {
    version.get();
    return (
      <Viz.HoverData
        query={({ scale }) => {
          const x = cursor.get();
          if (x === null) return undefined;
          const snapshot = scale("x");
          expect(scale("x")).toBe(snapshot);
          return { x: snapshot.map(x) };
        }}
      >
        {(result) => {
          results.push(result);
          return result ? <Mark /> : null;
        }}
      </Viz.HoverData>
    );
  }
  runtime.mount(
    <Viz.Scale id="x" type="linear" domain={[0, 10]} range={[0, 100]}>
      <View />
    </Viz.Scale>,
  );
  runtime.flush();
  expect(results.at(-1)).toEqual({ x: 20 });
  cursor.set(3);
  runtime.flush();
  expect(results.at(-1)).toEqual({ x: 30 });
  version.set(1);
  runtime.flush();
  expect(new Set(identities).size).toBe(1);
  cursor.set(null);
  runtime.flush();
  expect(results.at(-1)).toBeUndefined();
  cursor.set(2);
  runtime.flush();
  expect(new Set(identities).size).toBe(2);
});
it("rejects asynchronous query results", () => {
  expect(Viz.HoverData).toBeTypeOf("function");
  runtime = testRuntime();
  runtime.mount(
    <Viz.HoverData query={(() => Promise.resolve(1)) as never}>
      {() => null}
    </Viz.HoverData>,
  );
  expect(() => runtime.flush()).toThrow(/synchronous/);
});
it("forbids hooks inside queries and render callbacks", () => {
  expect(Viz.HoverData).toBeTypeOf("function");
  runtime = testRuntime();
  runtime.mount(
    <Viz.HoverData query={() => useConst(() => 1)}>{() => null}</Viz.HoverData>,
  );
  expect(() => runtime.flush()).toThrow(/hooks.*HoverData/i);
});

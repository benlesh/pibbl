import { signal } from "@pibbl/core";
import { Circle } from "@pibbl/core";
import { Axis, SymlogScale, PointScale, useSymlogScale, usePointScale, ScaleAdjust, type ResolvedSymlogScale, type ResolvedPointScale } from "@pibbl/core/viz";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
it("maps signed values through zero and updates the explicit constant", () => {
  runtime = testRuntime(); const constant = signal(1); let scale!: ResolvedSymlogScale;
  function Probe() { scale = useSymlogScale("value").get(); }
  runtime.mount(<SymlogScale id="value" domain={[-99, 99]} range={[0, 200]} constant={constant}><Probe /></SymlogScale>);
  runtime.flush(); expect(scale.map(0)).toBe(100); expect(scale.map(9)).toBeCloseTo(150);
  expect(scale.map(-9)).toBeCloseTo(50); expect(scale.invert(150)).toBeCloseTo(9);
  expect(scale.ticks(7)).toContain(0);
  constant.set(10); runtime.flush(); expect(scale.constant).toBe(10); expect(scale.map(9)).toBeLessThan(150);
  runtime.dispose(); constant.set(2); expect(runtime.pending).toBe(0);
});
it("provides ordered categorical points, inverse lookup, ticks, and axis/custom-mark placement", () => {
  runtime = testRuntime(); let scale!: ResolvedPointScale;
  function Probe() { scale = usePointScale("state").get(); }
  runtime.mount(<PointScale id="state" domain={["Texas", "Florida", "New York"]} range={[0, 100]}>
    <Probe /><Axis scale="state" position="left" />
    <ScaleAdjust y="Florida" yScale="state"><Circle style={{ radius: 3 }} /></ScaleAdjust>
  </PointScale>);
  runtime.flush(); expect(scale.map("Texas")).toBe(0); expect(scale.map("Florida")).toBe(50);
  expect(scale.map("missing")).toBeUndefined(); expect(scale.invert(60)).toBe("Florida");
  expect(scale.invert(25)).toBe("Texas"); expect(scale.ticks(2)).toEqual(["Texas", "New York"]);
});

it("handles point padding, reversed ranges, empty/singleton domains, and signal replacement", () => {
  runtime = testRuntime(); const domain = signal<readonly (string | number)[]>(["A", "B", "C"]); const padding = signal(1);
  let scale!: ResolvedPointScale;
  function Probe() { scale = usePointScale("p").get(); }
  runtime.mount(<PointScale id="p" domain={domain} range={[100, 0]} padding={padding}><Probe /></PointScale>);
  runtime.flush(); expect(scale.map("A")).toBe(75); expect(scale.map("C")).toBe(25);
  expect(scale.invert(62.5)).toBe("A"); expect(scale.invert(-100)).toBe("C");
  padding.set(0); runtime.flush(); expect(scale.map("A")).toBe(100);
  domain.set(["only"]); runtime.flush(); expect(scale.map("only")).toBe(50); expect(scale.step).toBe(0);
  domain.set([]); runtime.flush(); expect(scale.invert(30)).toBeUndefined(); expect(scale.ticks()).toEqual([]);
  runtime.dispose(); domain.set(["later"]); expect(runtime.pending).toBe(0);
});
it("preserves signed descending domains and rejects ambiguous numeric domains", () => {
  runtime = testRuntime(); let scale!: ResolvedSymlogScale;
  function Probe() { scale = useSymlogScale("s").get(); }
  runtime.mount(<SymlogScale id="s" domain={[99, -99]} range={[0, 200]}><Probe /></SymlogScale>);
  runtime.flush(); expect(scale.map(9)).toBeCloseTo(50); expect(scale.invert(50)).toBeCloseTo(9);
  expect(scale.ticks(5)[0]).toBeGreaterThan(scale.ticks(5).at(-1)!);
  runtime.dispose();
  for (const constant of [0, -1, Infinity]) {
    runtime = testRuntime(); runtime.mount(<SymlogScale id="s" domain={[-1, 1]} range={[0, 100]} constant={constant}><Probe /></SymlogScale>);
    expect(() => runtime.flush()).toThrow(/constant/); runtime.dispose();
  }
});

import { Absolute, Group, signal } from "@pibbl/core";
import { Axis, AxisTitle, LinearScale, useLinearScale } from "@pibbl/core/viz";
import { expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";
it("centers a title on the scale range and updates its units", () => {
  const runtime = testRuntime(), unit = signal("kg");
  const labels: Array<[string, number, number]> = [];
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(function(this: CanvasRenderingContext2D, text, x, y) {
    const p = new DOMPoint(x, y).matrixTransform(this.getTransform()); labels.push([text, p.x, p.y]);
  });
  try {
    runtime.mount(<LinearScale id="x" domain={[0, 10]} range={[20, 220]}><AxisTitle scale="x" position="top" label="Mass" unit={unit} offset={24} /></LinearScale>);
    runtime.flush(); expect(labels).toContainEqual(["Mass (kg)", 120, -24]);
    unit.set("g"); runtime.flush(); expect(labels).toContainEqual(["Mass (g)", 120, -24]);
    runtime.dispose(); unit.set("kg"); expect(runtime.pending).toBe(0);
  } finally { runtime.dispose(); }
});

it.each([
  ["top", 120, -24, 1, 0],
  ["bottom", 120, 424, 1, 0],
  ["left", -24, 120, 0, -1],
  ["right", 624, 120, 0, 1],
] as const)("places %s titles using the scale frame and descending range", (position, x, y, a, b) => {
  const runtime = testRuntime(); let matrix!: DOMMatrix;
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(function(this: CanvasRenderingContext2D) { matrix = this.getTransform(); });
  try {
    runtime.mount(<LinearScale id="x" domain={[10, 0]} range={[220, 20]}><AxisTitle scale="x" position={position} label="Value" offset={24} /></LinearScale>);
    runtime.flush(); expect(matrix.e).toBeCloseTo(x); expect(matrix.f).toBeCloseTo(y);
    expect(matrix.a).toBeCloseTo(a); expect(matrix.b).toBeCloseTo(b);
  } finally { runtime.dispose(); }
});


it("composes beside Axis and follows allocation changes without altering scale geometry", () => {
  const runtime = testRuntime(), width = signal(240), height = signal(80);
  const titles: Array<[number, number]> = [], midpoints: number[] = [];
  const ends = vi.spyOn(Path2D.prototype, "lineTo");
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(function(this: CanvasRenderingContext2D, text, x, y) {
    if (text !== "Mass (kg)") return;
    const p = new DOMPoint(x, y).matrixTransform(this.getTransform()); titles.push([p.x, p.y]);
  });
  function Probe() { midpoints.push(useLinearScale("x").get().map(5)); }
  try {
    runtime.mount(<Group style={{ translateX: 30, translateY: 20 }}><Absolute>
      <LinearScale id="x" domain={[0, 10]} range="width" style={{ width, height }}>
        <Axis scale="x" position="bottom" tickValues={[0, 5, 10]} />
        <AxisTitle scale="x" position="bottom" label="Mass" unit="kg" />
        <Probe />
      </LinearScale>
    </Absolute></Group>);
    runtime.flush(); expect(titles.at(-1)).toEqual([150, 140]); expect(midpoints.at(-1)).toBe(120);
    expect(ends).toHaveBeenCalledWith(240, 80);
    width.set(360); height.set(120); runtime.flush();
    expect(titles.at(-1)).toEqual([210, 180]); expect(midpoints.at(-1)).toBe(180);
    expect(ends).toHaveBeenCalledWith(360, 120);
    runtime.dispose(); width.set(400); height.set(200); expect(runtime.pending).toBe(0);
  } finally { runtime.dispose(); }
});

import { signal } from "@pibbl/core";
import { AxisTitle, LinearScale } from "@pibbl/core/viz";
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

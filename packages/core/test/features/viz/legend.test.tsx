import { signal } from "@pibbl/core";
import { LegendItem } from "@pibbl/core/viz";
import { expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";
it("paints a reactive legend label at a stable swatch-relative position", () => {
  const runtime = testRuntime(), label = signal("Gain");
  const text: Array<[string, number, number]> = [];
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(function (this: CanvasRenderingContext2D, label, x, y) {
    const point = new DOMPoint(x, y).matrixTransform(this.getTransform());
    text.push([label, point.x, point.y]);
  });
  try {
    runtime.mount(<LegendItem label={label} color="#087f8c" />); runtime.flush();
    expect(text).toContainEqual(["Gain", 18, 7]);
    label.set("Population gain"); runtime.flush();
    expect(text).toContainEqual(["Population gain", 18, 7]);
    runtime.dispose(); label.set("Later"); expect(runtime.pending).toBe(0);
  } finally { runtime.dispose(); }
});

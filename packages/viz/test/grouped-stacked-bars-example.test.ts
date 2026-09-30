import { afterEach, expect, it, vi } from "vitest";
import mount from "../../scenarios/src/learning/composition/viz-grouped-stacked-bars.example.js";
import { testRuntime } from "./support/runtime.js";

let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it("runs the grouped-stacked lesson with inspection and an orientation toggle", () => {
  runtime = testRuntime();
  const text = vi.spyOn(CanvasRenderingContext2D.prototype, "fillText");
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:940px;height:720px";
  document.body.append(canvas);
  const controller = mount(canvas);
  try {
    runtime.flush();
    const labels = () => text.mock.calls.map((call) => call[0]);
    expect(labels()).toContain("Regional cash flow");
    expect(labels()).toContain(
      "Within each quarter: North slot first · South slot second",
    );

    const bounds = canvas.getBoundingClientRect();
    const point = (x: number, y: number) => ({
      clientX: bounds.left + x,
      clientY: bounds.top + y,
      bubbles: true,
      button: 0,
    });
    canvas.dispatchEvent(new PointerEvent("pointerdown", point(145, 381)));
    runtime.flush();
    expect(labels()).toContain("Q1 · North · Products · $160k");

    for (const type of ["mousedown", "mouseup", "click"])
      canvas.dispatchEvent(new MouseEvent(type, point(110, 99)));
    runtime.flush();
    expect(labels()).toContain("Horizontal bars");
    expect(labels()).toContain("Q1");
  } finally {
    controller.dispose();
  }
});

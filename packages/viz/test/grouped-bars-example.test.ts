import { afterEach, expect, it, vi } from "vitest";
import mount from "../../scenarios/src/learning/composition/viz-grouped-bars.example.js";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it("runs the grouped lesson, inspects a bar, and composes two or three years through controls", () => {
  runtime = testRuntime();
  const positions: [string, number][] = [];
  const original = CanvasRenderingContext2D.prototype.fillText;
  const text = vi.spyOn(CanvasRenderingContext2D.prototype, "fillText")
    .mockImplementation(function (this: CanvasRenderingContext2D, ...args: Parameters<CanvasRenderingContext2D["fillText"]>) {
      const point = new DOMPoint(args[1], args[2]).matrixTransform(this.getTransform());
      positions.push([args[0], point.x]);
      original.apply(this, args);
    });
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:940px;height:660px";
  document.body.append(canvas);
  const controller = mount(canvas);
  try {
    runtime.flush();
    const labels = () => text.mock.calls.map((call) => call[0]);
    expect(labels()).toContain("Population, side by side");
    expect(labels()).toContain("2022");
    expect(labels()).not.toContain("2020");
    const rect = canvas.getBoundingClientRect();
    const point = (x: number, y: number) => ({
      clientX: rect.left + x,
      clientY: rect.top + y,
      bubbles: true,
      button: 0,
    });
    canvas.dispatchEvent(new PointerEvent("pointerdown", point(100, 250)));
    runtime.flush();
    expect(labels()).toContain("California · 2022 · 39,040,616");
    const click = (x: number) => {
      for (const type of ["mousedown", "mouseup", "click"])
        canvas.dispatchEvent(new MouseEvent(type, point(x, 99)));
      runtime.flush();
    };
    click(240);
    expect(labels()).toContain("2020");
    expect(labels()).toContain("Remove 2020");
    text.mockClear();
    click(90);
    expect(
      labels().filter((label) => ["2020", "2022", "2023"].includes(label)),
    ).toEqual(["2023", "2022", "2020"]);
    const before = positions.findLast(
      (call) => call[0] === "Illinois",
    )![1];
    click(390);
    const after = positions.findLast(
      (call) => call[0] === "Illinois" || call[0] === "IL",
    )![1];
    expect(after).toBeLessThan(before);
  } finally {
    controller.dispose();
  }
});

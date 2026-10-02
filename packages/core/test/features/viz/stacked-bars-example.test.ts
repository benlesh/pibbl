import { afterEach, expect, it, vi } from "vitest";
import mount from "../../scenarios/src/learning/composition/viz-stacked-bars.example.js";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it("runs the stacked cash-flow lesson with segment inspection and interactive restacking", () => {
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
  canvas.style.cssText = "width:940px;height:720px";
  document.body.append(canvas);
  const controller = mount(canvas);
  try {
    runtime.flush();
    const labels = () => text.mock.calls.map((call) => call[0]);
    expect(labels()).toContain("Quarterly cash flow");
    expect(labels()).toContain(
      "Illustrative business · amounts in $ thousands",
    );
    const bounds = canvas.getBoundingClientRect();
    const point = (x: number, y: number) => ({
      clientX: bounds.left + x,
      clientY: bounds.top + y,
      bubbles: true,
      button: 0,
    });
    canvas.dispatchEvent(new PointerEvent("pointerdown", point(150, 400)));
    runtime.flush();
    expect(labels()).toContain("Q1 · Products · $180k");
    const pixel = () => [
      ...canvas.getContext("2d")!.getImageData(150, 490, 1, 1).data,
    ];
    expect(pixel().slice(0, 3)).toEqual([196, 123, 54]);
    const click = (x: number) => {
      for (const type of ["mousedown", "mouseup", "click"])
        canvas.dispatchEvent(new MouseEvent(type, point(x, 99)));
      runtime.flush();
    };
    click(90);
    expect(pixel().slice(0, 3)).toEqual([169, 81, 101]);
    click(240);
    expect(pixel().slice(0, 3)).toEqual([255, 253, 248]);
    expect(labels()).toContain("Show costs");
    const before = positions.findLast((call) => call[0] === "Q4")![1];
    click(390);
    expect(
      positions.findLast((call) => call[0] === "Q4")![1],
    ).toBeLessThan(before);
  } finally {
    controller.dispose();
  }
});

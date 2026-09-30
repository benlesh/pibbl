import { afterEach, expect, it, vi } from "vitest";
import mount from "../../scenarios/src/learning/composition/viz-band-bars.example.js";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
it("runs the editable bars lesson through its public mount", () => {
  runtime = testRuntime();
  const positions: [string, number][] = [];
  const original = CanvasRenderingContext2D.prototype.fillText;
  const text = vi.spyOn(CanvasRenderingContext2D.prototype, "fillText")
    .mockImplementation(function (this: CanvasRenderingContext2D, ...args: Parameters<CanvasRenderingContext2D["fillText"]>) {
      const point = new DOMPoint(args[1], args[2]).matrixTransform(this.getTransform());
      positions.push([args[0], point.x]);
      original.apply(this, args);
    });
  const host = document.createElement("div");
  host.style.cssText = "width:940px;height:660px";
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:940px;height:660px";
  host.append(canvas);
  document.body.append(host);
  const controller = mount(canvas);
  try {
    runtime.flush();
    const labels = text.mock.calls.map((call) => call[0]);
    expect(labels).toContain("California");
    expect(labels).toContain("+473.5k");
    expect(labels).toContain("−102.0k");
    expect(labels).not.toContain("No data");
    expect(labels).toContain("300k · color threshold");
    const ctx = canvas.getContext("2d")!;
    const beforeHover = ctx.getImageData(0, 170, 940, 345).data;
    const rect = canvas.getBoundingClientRect();
    const point = (x: number, y: number) => ({
      clientX: rect.left + x,
      clientY: rect.top + y,
      bubbles: true,
      button: 0,
    });
    canvas.dispatchEvent(new PointerEvent("pointerdown", point(140, 465)));
    runtime.flush();
    expect(text.mock.calls.map((call) => call[0])).toContain(
      "California · −75,423 residents",
    );
    expect(ctx.getImageData(0, 170, 940, 345).data).toEqual(beforeHover);
    const categoryX = () =>
      positions.findLast(
        (call) => call[0] === "California" || call[0] === "CA",
      )![1];
    const firstX = categoryX();
    const click = (x: number) => {
      for (const type of ["mousedown", "mouseup", "click"])
        canvas.dispatchEvent(new MouseEvent(type, point(x, 112)));
      runtime.flush();
    };
    click(90);
    expect(categoryX()).toBeGreaterThan(firstX);
    click(240);
    const beforeResize = categoryX();
    click(390);
    expect(categoryX()).toBeLessThan(beforeResize);
    click(540);
    expect(categoryX()).toBeLessThan(firstX);
    expect(text.mock.calls.map((call) => call[0])).toContain(
      "300k · color threshold",
    );
  } finally {
    controller.dispose();
  }
});

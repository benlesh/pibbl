import { userEvent } from "vitest/browser";
import { expect, it, vi } from "vitest";
import mount from "../../../../scenarios/src/learning/composition/viz-area-basics.example.js";
import { testRuntime } from "./support/runtime.js";
import { tab, pressKey } from "../../support/user-input.js";

it.each([
  [1000, 640],
  [560, 300],
  [360, 300],
  [320, 260],
  [360, 640],
])(
  "keeps the NOAA area, source, and inspection usable at %ix%i",
  async (width, height) => {
    const runtime = testRuntime();
    const labels: string[] = [];
    const native = CanvasRenderingContext2D.prototype.fillText;
    vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(
      function (
        this: CanvasRenderingContext2D,
        ...args: Parameters<CanvasRenderingContext2D["fillText"]>
      ) {
        if (this.globalAlpha > 0) {
          const [text, x, y] = args,
            m = this.measureText(text),
            t = this.getTransform(),
            ratio = this.canvas.width / width;
          const a = new DOMPoint(
              x - m.actualBoundingBoxLeft,
              y - m.actualBoundingBoxAscent,
            ).matrixTransform(t),
            b = new DOMPoint(
              x + m.actualBoundingBoxRight,
              y + m.actualBoundingBoxDescent,
            ).matrixTransform(t);
          labels.push(text);
          expect(a.x / ratio, text).toBeGreaterThanOrEqual(0);
          expect(b.x / ratio, text).toBeLessThanOrEqual(width);
          expect(a.y / ratio, text).toBeGreaterThanOrEqual(0);
          expect(b.y / ratio, text).toBeLessThanOrEqual(height);
        }
        native.apply(this, args);
      },
    );
    const before = document.createElement("button"),
      canvas = document.createElement("canvas");
    canvas.style.cssText = `width:${width}px;height:${height}px`;
    document.body.append(before, canvas);
    const app = mount(canvas);
    try {
      runtime.flush();
      expect(labels).toContain("Jan 1980 · 337.90 ppm");
      expect(labels).toContain(
        "Fill = distance above reference, not emissions.",
      );
      const r = canvas.getBoundingClientRect();
      for (const type of ["mousedown", "mouseup", "click"])
        canvas.dispatchEvent(
          new MouseEvent(type, {
            bubbles: true,
            clientX: r.left + 50,
            clientY: r.top + 50,
          }),
        );
      runtime.flush();
      expect(labels).toContain("Baseline: 335 ppm");
      for (const type of ["mousedown", "mouseup", "click"])
        canvas.dispatchEvent(
          new MouseEvent(type, {
            bubbles: true,
            clientX: r.left + 190,
            clientY: r.top + 50,
          }),
        );
      runtime.flush();
      expect(labels).toContain("Restore June");
      canvas.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerType: "touch",
          clientX: r.left + width - 23,
          clientY: r.top + (height < 400 ? 105 : 145),
        }),
      );
      runtime.flush();
      expect(labels).toContain("Dec 1980 · 338.29 ppm");
      before.focus();
      for (let i = 0; i < 3; i++) {
        await tab();
        runtime.flush();
      }
      labels.length = 0;
      await userEvent.keyboard("{Home}");
      runtime.flush();
      expect(labels).toContain("Jan 1980 · 337.90 ppm");
      await pressKey("ArrowRight");
      runtime.flush();
      expect(labels).toContain("Feb 1980 · 338.34 ppm");
    } finally {
      app.dispose();
      expect(runtime.pending).toBe(0);
      runtime.dispose();
    }
  },
);

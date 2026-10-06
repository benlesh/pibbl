import { userEvent } from "vitest/browser";
import { expect, it, vi } from "vitest";
import mount from "../../../../scenarios/src/learning/composition/viz-population-stack.example.js";
import { testRuntime } from "./support/runtime.js";
import { tab, pressKey } from "../../support/user-input.js";

it.each([
  [1000, 640],
  [560, 300],
  [360, 300],
  [320, 260],
  [360, 640],
])(
  "keeps the population stack, source, and inspection usable at %ix%i",
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
      expect(labels).toContain("2020 · California · 39,538,212 · 43.8%");
      expect(labels).toContain("Share denominator = CA + TX + FL, not the US.");
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
      expect(labels).toContain("View counts");
      canvas.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerType: "touch",
          clientX: r.left + width - 23,
          clientY: r.top + 105,
        }),
      );
      runtime.flush();
      expect(labels).toContain("2023 · California · 38,965,193 · 42.3%");
      before.focus();
      for (let i = 0; i < 2; i++) {
        await tab();
        runtime.flush();
      }
      await userEvent.keyboard("{End}");
      runtime.flush();
      expect(labels).toContain("2023 · Florida · 22,610,726 · 24.6%");
      labels.length = 0;
      await userEvent.keyboard("{Home}");
      runtime.flush();
      expect(labels).toContain("2020 · California · 39,538,212 · 43.8%");
      await pressKey("ArrowRight");
      runtime.flush();
      expect(labels).toContain("2020 · Texas · 29,145,459 · 32.3%");
    } finally {
      app.dispose();
      expect(runtime.pending).toBe(0);
      runtime.dispose();
    }
  },
);

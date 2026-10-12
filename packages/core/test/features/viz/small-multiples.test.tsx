import { signal } from "@pibbl/core";
import { userEvent } from "vitest/browser";
import { expect, it, vi } from "vitest";
import mount from "../../../../scenarios/src/learning/composition/viz-small-multiples.example.js";
import { testRuntime } from "./support/runtime.js";

it.each([
  [1000, 640],
  [560, 300],
  [360, 300],
  [320, 260],
  [360, 640],
])(
  "keeps quarterly NOAA small multiples usable at %ix%i",
  async (width, height) => {
    const runtime = testRuntime();
    const labels: string[] = [];
    const native = CanvasRenderingContext2D.prototype.fillText;
    vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(
      function (this: CanvasRenderingContext2D, ...args) {
        if (this.globalAlpha > 0) {
          const [text, x, y] = args;
          const metrics = this.measureText(text);
          const transform = this.getTransform(),
            ratio = this.canvas.width / width;
          const a = new DOMPoint(
            x - metrics.actualBoundingBoxLeft,
            y - metrics.actualBoundingBoxAscent,
          ).matrixTransform(transform);
          const b = new DOMPoint(
            x + metrics.actualBoundingBoxRight,
            y + metrics.actualBoundingBoxDescent,
          ).matrixTransform(transform);
          labels.push(String(text));
          expect(a.x / ratio, String(text)).toBeGreaterThanOrEqual(0);
          expect(b.x / ratio, String(text)).toBeLessThanOrEqual(width);
          expect(a.y / ratio, String(text)).toBeGreaterThanOrEqual(0);
          expect(b.y / ratio, String(text)).toBeLessThanOrEqual(height);
        }
        native.apply(this, args);
      },
    );
    const before = document.createElement("button");
    const canvas = document.createElement("canvas");
    canvas.style.cssText = `width:${width}px;height:${height}px`;
    document.body.append(before, canvas);
    const app = mount(canvas);
    try {
      runtime.flush();
      for (const label of [
        "1980 quarterly CO₂",
        "Q1 · Jan–Mar",
        "Q4 · Oct–Dec",
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ])
        expect(labels).toContain(label);
      expect(labels).toContain("Use independent y domains");
      const bounds = canvas.getBoundingClientRect();
      canvas.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          clientX: bounds.left + 75,
          clientY: bounds.top + 112,
        }),
      );
      runtime.flush();
      expect(
        labels.some((label) => label.includes("Aligned month-of-quarter:")),
      ).toBe(true);
      before.focus();
      await userEvent.tab();
      await userEvent.tab();
      labels.length = 0;
      await userEvent.keyboard("{Home}");
      runtime.flush();
      expect(labels).toContain("Aligned month-of-quarter: 1 of 3");
      labels.length = 0;
      await userEvent.keyboard("{End}");
      runtime.flush();
      expect(labels).toContain("Aligned month-of-quarter: 3 of 3");
      labels.length = 0;
      await userEvent.keyboard("{Escape}");
      runtime.flush();
      expect(labels).toContain("Align quarters by month position (1–3).");
      await userEvent.click(canvas, { position: { x: 85, y: 55 } });
      runtime.flush();
      expect(labels).toContain("Use shared y domain");
    } finally {
      app.dispose();
      expect(runtime.pending).toBe(0);
      runtime.dispose();
    }
  },
);

it("accepts signal-backed unequal and empty quarters without leaking", () => {
  const runtime = testRuntime();
  const data = signal([
    { month: 0, position: 0, ppm: 337.9 },
    { month: 1, position: 1, ppm: 338.34 },
    { month: 9, position: 0, ppm: 336.14 },
  ]);
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:360px;height:640px";
  document.body.append(canvas);
  const app = mount(canvas, { data });
  try {
    runtime.flush();
    const bounds = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: bounds.left + 80,
        clientY: bounds.top + 112,
      }),
    );
    runtime.flush();
    data.set([{ month: 3, position: 0, ppm: 340.93 }]);
    runtime.flush();
    data.set([]);
    runtime.flush();
  } finally {
    app.dispose();
    expect(runtime.pending).toBe(0);
    runtime.dispose();
  }
});

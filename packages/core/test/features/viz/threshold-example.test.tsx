import { userEvent } from "vitest/browser";
import { expect, it, vi } from "vitest";
import mount from "../../../../scenarios/src/learning/composition/viz-threshold-segments.example.js";
import { testRuntime } from "./support/runtime.js";
import { pressKey, tab } from "../../support/user-input.js";

it("splits domain-space threshold crossings at shared interpolated endpoints", () => {
  const runtime = testRuntime();
  let segments: readonly {
    side: string;
    points: readonly { time: number; ppm: number }[];
  }[] = [];
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  const app = mount(canvas, {
    onSegments: (value) => {
      segments = value;
    },
  });
  runtime.flush();
  expect(segments).toHaveLength(4);
  const firstCrossing = segments[0].points.at(-1)!;
  const secondCrossing = segments[1].points.at(-1)!;
  const thirdCrossing = segments[2].points.at(-1)!;
  expect(firstCrossing.ppm).toBe(338);
  expect(secondCrossing.ppm).toBe(338);
  expect(thirdCrossing.ppm).toBe(338);
  expect(segments[1].points[0]).toBe(firstCrossing);
  expect(segments[2].points[0]).toBe(secondCrossing);
  expect(segments[3].points[0]).toBe(thirdCrossing);
  app.dispose();
  runtime.dispose();
});

it.each([
  [1000, 640],
  [560, 300],
  [360, 300],
  [320, 260],
  [360, 640],
])(
  "keeps the NOAA threshold recipe, source, and inspection usable at %ix%i",
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
          const [text, x, y] = args;
          const metrics = this.measureText(text);
          const transform = this.getTransform();
          const ratio = this.canvas.width / width;
          const a = new DOMPoint(
            x - metrics.actualBoundingBoxLeft,
            y - metrics.actualBoundingBoxAscent,
          ).matrixTransform(transform);
          const b = new DOMPoint(
            x + metrics.actualBoundingBoxRight,
            y + metrics.actualBoundingBoxDescent,
          ).matrixTransform(transform);
          labels.push(text);
          expect(a.x / ratio, text).toBeGreaterThanOrEqual(0);
          expect(b.x / ratio, text).toBeLessThanOrEqual(width);
          expect(a.y / ratio, text).toBeGreaterThanOrEqual(0);
          expect(b.y / ratio, text).toBeLessThanOrEqual(height);
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
      expect(labels).toContain("Jan 1980 · 337.90 ppm");
      expect(labels).toContain("Threshold: 338 ppm");
      expect(labels).toContain(
        "Crossings are linearly interpolated at the selected threshold.",
      );
      expect(labels).toContain("NOAA / Scripps · Mauna Loa · 1980 · ppm · UTC");
      const bounds = canvas.getBoundingClientRect();
      for (const type of ["mousedown", "mouseup", "click"])
        canvas.dispatchEvent(
          new MouseEvent(type, {
            bubbles: true,
            clientX: bounds.left + 200,
            clientY: bounds.top + 55,
          }),
        );
      runtime.flush();
      expect(labels).toContain("Threshold: 340 ppm");
      canvas.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerType: "touch",
          clientX: bounds.left + width - 23,
          clientY: bounds.top + (height < 400 ? 105 : 145),
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

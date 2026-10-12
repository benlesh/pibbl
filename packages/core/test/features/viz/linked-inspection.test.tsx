import { signal } from "@pibbl/core";
import { userEvent } from "vitest/browser";
import { expect, it, vi } from "vitest";
import mount from "../../../../scenarios/src/learning/composition/viz-linked-inspection.example.js";
import { testRuntime } from "./support/runtime.js";
import { pressKey, tab } from "../../support/user-input.js";

type LinkedInspectionDatum = { time: number; ppm: number };
const replacement: readonly LinkedInspectionDatum[] = [
  { time: Date.UTC(1980, 0, 1), ppm: 337.9 },
  { time: Date.UTC(1980, 1, 1), ppm: 338.34 },
];

it.each([
  [1000, 640],
  [560, 300],
  [360, 300],
  [320, 260],
  [360, 640],
])(
  "keeps linked NOAA inspection visible and operable at %ix%i",
  async (width, height) => {
    const runtime = testRuntime();
    const labels: string[] = [];
    const boundsByLabel = new Map<
      string,
      Array<{ top: number; bottom: number }>
    >();
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
          const boxes = boundsByLabel.get(text) ?? [];
          boxes.push({ top: a.y / ratio, bottom: b.y / ratio });
          boundsByLabel.set(text, boxes);
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
      expect(labels).toContain("Linked monthly CO₂ inspection");
      expect(labels).toContain("NOAA / Scripps · Mauna Loa · 1980 · ppm · UTC");
      expect(labels).toContain(
        "Pointer / tap, Tab, ← →, Home / End · Esc clears",
      );
      if (width === 320 && height === 260) {
        const anomalyTitle = boundsByLabel.get("Anomaly vs 330 ppm")![0];
        const firstPlotTicks = ["Jan", "Dec"]
          .flatMap((label) => boundsByLabel.get(label) ?? [])
          .filter((box) => box.bottom <= anomalyTitle.top);
        expect(
          firstPlotTicks,
          "first plot ticks before anomaly title",
        ).not.toHaveLength(0);
        expect(
          Math.max(...firstPlotTicks.map((box) => box.bottom)),
        ).toBeLessThanOrEqual(anomalyTitle.top);
      }
      const bounds = canvas.getBoundingClientRect();
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
      for (let index = 0; index < 3; index++) {
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
      await userEvent.keyboard("{Escape}");
      runtime.flush();
      expect(labels).toContain(
        "Move, tap, or use keys to inspect an observed month.",
      );
    } finally {
      app.dispose();
      expect(runtime.pending).toBe(0);
      runtime.dispose();
    }
  },
);

it("preserves a surviving timestamp selection and clears one removed by injected data replacement", async () => {
  const runtime = testRuntime();
  const records = signal<readonly LinkedInspectionDatum[]>([
    ...replacement,
    { time: Date.UTC(1980, 2, 1), ppm: 340.07 },
  ]);
  const labels: string[] = [];
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(
    function (this: CanvasRenderingContext2D, text) {
      if (this.globalAlpha > 0) labels.push(String(text));
    },
  );
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:560px;height:300px";
  document.body.append(canvas);
  const app = mount(canvas, { data: records });
  try {
    runtime.flush();
    const bounds = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: bounds.left + 270,
        clientY: bounds.top + 115,
      }),
    );
    runtime.flush();
    expect(labels).toContain("Feb 1980 · 338.34 ppm");
    labels.length = 0;
    records.set([
      { time: Date.UTC(1980, 1, 1), ppm: 338.34 },
      { time: Date.UTC(1980, 3, 1), ppm: 340.93 },
    ]);
    runtime.flush();
    expect(labels).toContain("Feb 1980 · 338.34 ppm");
    labels.length = 0;
    records.set([{ time: Date.UTC(1980, 3, 1), ppm: 340.93 }]);
    runtime.flush();
    expect(labels).toContain(
      "Move, tap, or use keys to inspect an observed month.",
    );
  } finally {
    app.dispose();
    expect(runtime.pending).toBe(0);
    runtime.dispose();
  }
});

it("pins one observed timestamp across both views and never revives a removed pin", () => {
  const runtime = testRuntime();
  const records = signal<readonly LinkedInspectionDatum[]>([
    ...replacement,
    { time: Date.UTC(1980, 2, 1), ppm: 340.07 },
  ]);
  const labels: string[] = [];
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(
    function (this: CanvasRenderingContext2D, text) {
      if (this.globalAlpha > 0) labels.push(String(text));
    },
  );
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:560px;height:300px";
  document.body.append(canvas);
  const app = mount(canvas, { data: records });
  try {
    runtime.flush();
    const bounds = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: bounds.left + 270,
        clientY: bounds.top + 115,
      }),
    );
    runtime.flush();
    for (const type of ["mousedown", "mouseup", "click"])
      canvas.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          clientX: bounds.left + 220,
          clientY: bounds.top + 55,
        }),
      );
    runtime.flush();
    expect(labels).toContain("Pinned: Feb 1980 · +8.34 ppm vs 330");
    canvas.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    runtime.flush();
    expect(labels).toContain("Feb 1980 · 338.34 ppm");
    labels.length = 0;
    records.set([{ time: Date.UTC(1980, 2, 1), ppm: 340.07 }]);
    runtime.flush();
    records.set([
      { time: Date.UTC(1980, 1, 1), ppm: 338.34 },
      { time: Date.UTC(1980, 2, 1), ppm: 340.07 },
    ]);
    runtime.flush();
    expect(labels).not.toContain("Pinned: Feb 1980 · +8.34 ppm vs 330");
  } finally {
    app.dispose();
    expect(runtime.pending).toBe(0);
    runtime.dispose();
  }
});

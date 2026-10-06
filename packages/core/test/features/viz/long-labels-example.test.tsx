import { tab, pressKey } from "../../support/user-input.js";
import { expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";
import mount from "../../../../scenarios/src/learning/composition/viz-long-labels.example.js";
const compactMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
type Draw = {
  readonly text: string;
  readonly top: number;
  readonly bottom: number;
};

function expectVerticallySeparate(draws: readonly Draw[]): void {
  const ordered = [...draws].sort((a, b) => a.top - b.top);
  for (let index = 1; index < ordered.length; index++)
    expect(ordered[index - 1].bottom).toBeLessThanOrEqual(ordered[index].top);
}

it.each([
  [320, 260],
  [360, 300],
  [560, 300],
  [1000, 640],
  [360, 640],
])(
  "keeps every category identity and controls usable at %ix%i",
  async (width, height) => {
    const runtime = testRuntime();
    const labels: string[] = [];
    const draws: Draw[] = [];
    vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(
      function (this: CanvasRenderingContext2D, text, x, y) {
        if (!this.globalAlpha) return;
        labels.push(text);
        const metrics = this.measureText(text),
          matrix = this.getTransform();
        const ratio = this.canvas.width / width;
        const start = new DOMPoint(
          x - metrics.actualBoundingBoxLeft,
          y - metrics.actualBoundingBoxAscent,
        ).matrixTransform(matrix);
        const end = new DOMPoint(
          x + metrics.actualBoundingBoxRight,
          y + metrics.actualBoundingBoxDescent,
        ).matrixTransform(matrix);
        expect(start.x / ratio, text).toBeGreaterThanOrEqual(0);
        expect(end.x / ratio, text).toBeLessThanOrEqual(width);
        expect(start.y / ratio, text).toBeGreaterThanOrEqual(0);
        expect(end.y / ratio, text).toBeLessThanOrEqual(height);
        draws.push({
          text: String(text),
          top: start.y / ratio,
          bottom: end.y / ratio,
        });
      },
    );
    const canvas = document.createElement("canvas");
    canvas.style.cssText = `width:${width}px;height:${height}px`;
    document.body.append(canvas);
    const app = mount(canvas);
    try {
      runtime.flush();
      if (height <= 350) {
        for (const month of compactMonths) expect(labels).toContain(month);
        expect(labels).toContain("NOAA GML / Scripps");
        expect(labels).toContain("Mauna Loa · Jan–Jun 1980");
        expectVerticallySeparate(
          compactMonths.map((month) =>
            draws.find((draw) => draw.text === month)!,
          ),
        );
        const source = draws.filter(
          (draw) =>
            draw.text === "NOAA GML / Scripps" ||
            draw.text === "Mauna Loa · Jan–Jun 1980",
        );
        const valueAxis = draws.filter((draw) =>
          ["0", "100", "200", "300"].includes(draw.text),
        );
        for (const sourceLabel of source)
          for (const axisLabel of valueAxis)
            expect(
              sourceLabel.bottom <= axisLabel.top ||
                axisLabel.bottom <= sourceLabel.top,
            ).toBe(true);
      } else {
        expect(
          labels.some((text) => text.startsWith("January 1980 · Mauna Loa")),
        ).toBe(true);
      }
      const box = canvas.getBoundingClientRect();
      const event = {
        bubbles: true,
        clientX: box.left + 70,
        clientY: box.top + (height <= 350 ? 60 : 100),
      };
      for (const type of ["mousedown", "mouseup", "click"])
        canvas.dispatchEvent(new MouseEvent(type, event));
      runtime.flush();
      expect(labels).toContain("Truncate labels · change");
      canvas.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerType: "touch",
          clientX: box.left + (width < 500 ? 160 : 220),
          clientY: box.top + (height <= 350 ? 165 : 290),
        }),
      );
      runtime.flush();
      expect(
        labels.some(
          (text) =>
            text.includes("1980 · Mauna Loa ·") && !text.startsWith("January"),
        ),
      ).toBe(true);
      const before = document.createElement("button");
      before.textContent = "before";
      canvas.before(before);
      before.focus();
      await tab();
      runtime.flush();
      await tab();
      runtime.flush();
      expect(document.activeElement).toBe(canvas);
      const prior = labels
        .filter((text) => text.includes("1980 · Mauna Loa ·"))
        .at(-1);
      await pressKey("ArrowRight");
      runtime.flush();
      expect(
        labels.filter((text) => text.includes("1980 · Mauna Loa ·")).at(-1),
      ).not.toBe(prior);
    } finally {
      app.dispose();
      runtime.dispose();
    }
  },
);

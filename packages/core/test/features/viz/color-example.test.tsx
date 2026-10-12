import { userEvent } from "vitest/browser";
import { expect, it, vi } from "vitest";
import mount from "../../../../scenarios/src/learning/composition/viz-color-encodings.example.js";
import { testRuntime } from "./support/runtime.js";
import { tab, tapTouchLogicalPoint } from "../../support/user-input.js";

const values = [
  337.9, 338.34, 340.07, 340.93, 341.45, 341.36, 339.45, 337.67, 336.25, 336.14,
  337.3, 338.29,
];
const months = [
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
];
type Paint = {
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
};
type PaintedText = { text: string; color: string };

function mix(a: string, b: string, t: number) {
  const channel = (index: number) =>
    Math.round(
      parseInt(a.slice(index, index + 2), 16) * (1 - t) +
        parseInt(b.slice(index, index + 2), 16) * t,
    )
      .toString(16)
      .padStart(2, "0");
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}
function sequential(value: number, domain: readonly [number, number]) {
  return mix(
    "#e5f0ed",
    "#12575a",
    Math.max(0, Math.min(1, (value - domain[0]) / (domain[1] - domain[0]))),
  );
}
function diverging(value: number, domain: readonly [number, number, number]) {
  return value <= domain[1]
    ? mix(
        "#245c88",
        "#f5f1dd",
        Math.max(0, Math.min(1, (value - domain[0]) / (domain[1] - domain[0]))),
      )
    : mix(
        "#f5f1dd",
        "#b64c32",
        Math.max(0, Math.min(1, (value - domain[1]) / (domain[2] - domain[1]))),
      );
}
function luminance(color: string) {
  const channels = [1, 3, 5].map((index) => {
    const value = parseInt(color.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

it.each([
  [1000, 640],
  [560, 300],
  [360, 300],
  [320, 260],
  [360, 640],
])(
  "shows color-mapped observations and scale-derived keys at %ix%i",
  async (width, height) => {
    const runtime = testRuntime(),
      labels: string[] = [],
      paints: Paint[] = [],
      texts: PaintedText[] = [];
    const nativeText = CanvasRenderingContext2D.prototype.fillText,
      nativeFill = CanvasRenderingContext2D.prototype.fill,
      nativeRect = Path2D.prototype.rect,
      nativeRoundRect = Path2D.prototype.roundRect;
    const paths = new WeakMap<
      Path2D,
      { x: number; y: number; width: number; height: number }
    >();
    vi.spyOn(Path2D.prototype, "rect").mockImplementation(function (
      this: Path2D,
      x,
      y,
      rectWidth,
      rectHeight,
    ) {
      paths.set(this, { x, y, width: rectWidth, height: rectHeight });
      return nativeRect.call(this, x, y, rectWidth, rectHeight);
    });
    vi.spyOn(Path2D.prototype, "roundRect").mockImplementation(function (
      this: Path2D,
      x,
      y,
      rectWidth,
      rectHeight,
      radii,
    ) {
      paths.set(this, { x, y, width: rectWidth, height: rectHeight });
      return nativeRoundRect.call(this, x, y, rectWidth, rectHeight, radii);
    });
    vi.spyOn(CanvasRenderingContext2D.prototype, "fill").mockImplementation(
      function (
        this: CanvasRenderingContext2D,
        path: Path2D,
        ...args: unknown[]
      ) {
        const rect = paths.get(path);
        if (rect) {
          const matrix = this.getTransform(),
            ratio = this.canvas.width / width;
          paints.push({
            left: (matrix.a * rect.x + matrix.e) / ratio,
            top: (matrix.d * rect.y + matrix.f) / ratio,
            width: Math.abs(matrix.a * rect.width) / ratio,
            height: Math.abs(matrix.d * rect.height) / ratio,
            color: String(this.fillStyle).toLowerCase(),
          });
        }
        return nativeFill.call(this, path, ...(args as []));
      },
    );
    vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(
      function (
        this: CanvasRenderingContext2D,
        ...args: Parameters<CanvasRenderingContext2D["fillText"]>
      ) {
        const [text, x, y] = args;
        if (this.globalAlpha > 0) {
          const metrics = this.measureText(text),
            matrix = this.getTransform(),
            ratio = this.canvas.width / width;
          const a = new DOMPoint(
            x - metrics.actualBoundingBoxLeft,
            y - metrics.actualBoundingBoxAscent,
          ).matrixTransform(matrix);
          const b = new DOMPoint(
            x + metrics.actualBoundingBoxRight,
            y + metrics.actualBoundingBoxDescent,
          ).matrixTransform(matrix);
          labels.push(text);
          texts.push({ text, color: String(this.fillStyle).toLowerCase() });
          expect(a.x / ratio, text).toBeGreaterThanOrEqual(0);
          expect(b.x / ratio, text).toBeLessThanOrEqual(width);
          expect(a.y / ratio, text).toBeGreaterThanOrEqual(0);
          expect(b.y / ratio, text).toBeLessThanOrEqual(height);
        }
        return nativeText.apply(this, args);
      },
    );
    const before = document.createElement("button"),
      canvas = document.createElement("canvas");
    canvas.style.cssText = `width:${width}px;height:${height}px`;
    document.body.append(before, canvas);
    const app = mount(canvas);
    const cellWidth = (width - 28 - 5 * 4) / 6,
      cellHeight = (height - 190) / 2;
    const cells = () =>
      paints
        .filter(
          (paint) =>
            Math.abs(paint.width - cellWidth) < 0.01 &&
            Math.abs(paint.height - cellHeight) < 0.01,
        )
        .sort((a, b) => a.top - b.top || a.left - b.left);
    const ramp = () =>
      paints
        .filter(
          (paint) =>
            Math.abs(paint.height - 9) < 0.01 &&
            Math.abs(paint.width - ((width - 28) / 48 + 0.5)) < 0.01,
        )
        .sort((a, b) => a.left - b.left);
    const reset = () => {
      paints.length = 0;
      texts.length = 0;
    };
    const threshold = (value: number, wide = false) =>
      value < (wide ? 337 : 338)
        ? "#245c88"
        : value < (wide ? 341 : 340)
          ? "#e7bd66"
          : "#b64c32";
    const buckets = () =>
      paints
        .filter(
          (paint) =>
            Math.abs(paint.height - 9) < 0.01 &&
            Math.abs(paint.width - (width - 28) / 3 + 3) < 0.01,
        )
        .sort((a, b) => a.left - b.left);
    try {
      runtime.flush();
      for (const month of months) expect(labels).toContain(month);
      expect(labels).toContain("Jan 1980 · 337.90 ppm");
      expect(cells()).toHaveLength(12);
      expect(cells().map((paint) => paint.color)).toEqual(
        values.map((value) => sequential(value, [336, 342])),
      );
      expect(ramp()).toHaveLength(48);
      expect(ramp()[0]?.color).toBe("#e5f0ed");
      expect(ramp().at(-1)?.color).toBe("#12575a");
      for (const [index, value] of values.entries())
        for (const text of texts.filter(
          (item) =>
            item.text === months[index] || item.text === value.toFixed(2),
        ))
          expect(
            contrast(text.color, sequential(value, [336, 342])),
            text.text,
          ).toBeGreaterThanOrEqual(4.5);

      reset();
      await userEvent.click(canvas, { position: { x: 120, y: 55 } });
      runtime.flush();
      expect(labels).toContain("Center: 340 ppm (authored reference)");
      expect(cells()).toHaveLength(12);
      expect(cells().map((paint) => paint.color)).toEqual(
        values.map((value) => diverging(value, [336, 340, 342])),
      );
      expect(cells()[0]?.color).toBe(diverging(337.9, [336, 340, 342]));
      expect(cells()[2]?.color).toBe(diverging(340.07, [336, 340, 342]));
      expect(ramp()[0]?.color).toBe("#245c88");
      expect(ramp().at(-1)?.color).toBe("#b64c32");
      for (const [index, value] of values.entries())
        for (const text of texts.filter(
          (item) =>
            item.text === months[index] || item.text === value.toFixed(2),
        ))
          expect(
            contrast(text.color, cells()[index]!.color),
            text.text,
          ).toBeGreaterThanOrEqual(4.5);

      reset();
      await userEvent.click(canvas, { position: { x: 195, y: 55 } });
      runtime.flush();
      expect(labels).toContain("<338");
      expect(labels).toContain("≥340");
      expect(cells().map((paint) => paint.color)).toEqual(
        values.map((value) => threshold(value)),
      );
      expect(buckets().map((paint) => paint.color)).toEqual([
        "#245c88",
        "#e7bd66",
        "#b64c32",
      ]);

      reset();
      await userEvent.click(canvas, { position: { x: 270, y: 55 } });
      runtime.flush();
      expect(labels).toContain("<337");
      expect(labels).toContain("≥341");
      expect(cells().map((paint) => paint.color)).toEqual(
        values.map((value) => threshold(value, true)),
      );
      expect(buckets().map((paint) => paint.color)).toEqual([
        "#245c88",
        "#e7bd66",
        "#b64c32",
      ]);

      before.focus();
      for (let index = 0; index < 5; index++) {
        await tab();
        runtime.flush();
      }
      await userEvent.keyboard("{End}");
      runtime.flush();
      expect(labels).toContain("Dec 1980 · 338.29 ppm");
      await userEvent.keyboard("{Escape}");
      runtime.flush();
      expect(labels).toContain("Select a month · exact observed ppm");
      await tapTouchLogicalPoint(canvas, { x: 35, y: 120 });
      runtime.flush();
      expect(labels.at(-1)).toBeDefined();
    } finally {
      app.dispose();
      expect(runtime.pending).toBe(0);
      runtime.dispose();
      vi.restoreAllMocks();
    }
  },
);

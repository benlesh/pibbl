import { expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import mount from "../../../../scenarios/src/learning/composition/viz-size-symbols.example.js";
import { testRuntime } from "./support/runtime.js";
import { tab } from "../../support/user-input.js";

const rows = [
  { state: "CA", change: -75423 },
  { state: "TX", change: 473453 },
  { state: "FL", change: 365205 },
  { state: "NY", change: -101984 },
  { state: "PA", change: -10408 },
  { state: "IL", change: -32826 },
] as const;
const maximum = Math.max(...rows.map((row) => Math.abs(row.change)));
it.each([
  [1000, 640],
  [560, 300],
  [360, 300],
  [320, 260],
  [360, 640],
])(
  "keeps all signed area symbols, text, touch, and keys usable at %ix%i",
  async (width, height) => {
    const runtime = testRuntime(),
      canvas = document.createElement("canvas"),
      before = document.createElement("button"),
      labels: string[] = [],
      boxes = new Map<string, Array<{ top: number; bottom: number }>>(),
      arcs: number[] = [],
      squares: number[] = [],
      strokes: string[] = [];
    canvas.style.cssText = `width:${width}px;height:${height}px`;
    document.body.append(before, canvas);
    const text = CanvasRenderingContext2D.prototype.fillText,
      arc = Path2D.prototype.arc,
      rect = Path2D.prototype.rect,
      stroke = CanvasRenderingContext2D.prototype.stroke;
    vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(
      function (
        this: CanvasRenderingContext2D,
        ...args: Parameters<CanvasRenderingContext2D["fillText"]>
      ) {
        const [value, x, y] = args;
        if (this.globalAlpha > 0) {
          const metrics = this.measureText(value),
            transform = this.getTransform(),
            ratio = this.canvas.width / width,
            a = new DOMPoint(
              x - metrics.actualBoundingBoxLeft,
              y - metrics.actualBoundingBoxAscent,
            ).matrixTransform(transform),
            b = new DOMPoint(
              x + metrics.actualBoundingBoxRight,
              y + metrics.actualBoundingBoxDescent,
            ).matrixTransform(transform);
          labels.push(value);
          const next = boxes.get(value) ?? [];
          next.push({ top: a.y / ratio, bottom: b.y / ratio });
          boxes.set(value, next);
          expect(a.x / ratio, value).toBeGreaterThanOrEqual(0);
          expect(b.x / ratio, value).toBeLessThanOrEqual(width);
          expect(a.y / ratio, value).toBeGreaterThanOrEqual(0);
          expect(b.y / ratio, value).toBeLessThanOrEqual(height);
        }
        text.apply(this, args);
      },
    );
    vi.spyOn(Path2D.prototype, "arc").mockImplementation(function (
      this: Path2D,
      ...args: Parameters<Path2D["arc"]>
    ) {
      arcs.push(args[2]);
      return arc.apply(this, args);
    });
    vi.spyOn(Path2D.prototype, "rect").mockImplementation(function (
      this: Path2D,
      ...args: Parameters<Path2D["rect"]>
    ) {
      const [, , w, h] = args;
      if (Math.abs(w - h) < 1e-8 && w > 1 && w < 40) squares.push(w);
      return rect.apply(this, args);
    });
    vi.spyOn(CanvasRenderingContext2D.prototype, "stroke").mockImplementation(
      function (
        this: CanvasRenderingContext2D,
        ...args: Parameters<CanvasRenderingContext2D["stroke"]>
      ) {
        strokes.push(this.strokeStyle as string);
        return stroke.apply(this, args);
      },
    );
    const app = mount(canvas);
    try {
      runtime.flush();
      for (const row of rows) expect(labels).toContain(row.state);
      expect(labels).toContain(
        "Census Bureau · Vintage 2023 · July 2022–July 2023 · people",
      );
      expect(labels).toContain(
        "Area = |change| · circle = gain · square = loss",
      );
      for (const [label, seen] of boxes)
        if (
          label === "State population change" ||
          label.startsWith("Census Bureau")
        )
          for (const box of seen) {
            expect(box.top, label).toBeGreaterThanOrEqual(0);
            expect(box.bottom, label).toBeLessThanOrEqual(height);
          }
      const expectedPositive = rows
          .filter((row) => row.change > 0)
          .map((row) => (1100 * Math.abs(row.change)) / maximum)
          .sort((a, b) => a - b),
        expectedNegative = rows
          .filter((row) => row.change < 0)
          .map((row) => (1100 * Math.abs(row.change)) / maximum)
          .sort((a, b) => a - b);
      expect(
        arcs
          .filter((radius) => radius < 25)
          .map((radius) => Math.PI * radius * radius)
          .sort((a, b) => a - b),
      ).toEqual(expectedPositive.map((area) => expect.closeTo(area, 7)));
      expect(squares.map((side) => side * side).sort((a, b) => a - b)).toEqual(
        expectedNegative.map((area) => expect.closeTo(area, 7)),
      );
      strokes.length = 0;
      before.focus();
      await tab();
      await userEvent.keyboard("{Enter}");
      runtime.flush();
      expect(labels).toContain("Use sign shapes");
      await tab();
      runtime.flush();
      expect(strokes.join(" ")).toMatch(/(?:#172f3d|23, 47, 61)/);
      await userEvent.keyboard("{Home}");
      runtime.flush();
      expect(labels.some((label) => label.includes("CA: -75,423 people"))).toBe(
        true,
      );
      await userEvent.keyboard("{ArrowRight}");
      runtime.flush();
      expect(labels.some((label) => label.includes("TX: 473,453 people"))).toBe(
        true,
      );
      const bounds = canvas.getBoundingClientRect();
      canvas.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerType: "touch",
          clientX: bounds.left + 58 + (width - 76) * 0.9,
          clientY: bounds.top + (height < 400 ? 130 : 210),
        }),
      );
      runtime.flush();
      expect(labels.some((label) => label.includes("IL: -32,826 people"))).toBe(
        true,
      );
    } finally {
      app.dispose();
      expect(runtime.pending).toBe(0);
      runtime.dispose();
      vi.restoreAllMocks();
    }
  },
);
it("hides zero-area values and rejects nonfinite signed changes", () => {
  const runtime = testRuntime(),
    canvas = document.createElement("canvas");
  canvas.style.cssText = "width:560px;height:300px";
  document.body.append(canvas);
  const arcs: number[] = [];
  const native = Path2D.prototype.arc;
  vi.spyOn(Path2D.prototype, "arc").mockImplementation(function (
    this: Path2D,
    ...args: Parameters<Path2D["arc"]>
  ) {
    arcs.push(args[2]);
    return native.apply(this, args);
  });
  const app = mount(canvas, { data: [...rows, { state: "ZERO", change: 0 }] });
  try {
    runtime.flush();
    expect(arcs.filter((radius) => radius < 25)).toHaveLength(2);
    app.dispose();
    const invalid = mount(canvas, {
      data: [{ state: "BAD", change: NaN }] as never,
    });
    expect(() => runtime.flush()).toThrow(/change.*finite/i);
    invalid.dispose();
  } finally {
    app.dispose();
    expect(runtime.pending).toBe(0);
    runtime.dispose();
    vi.restoreAllMocks();
  }
});

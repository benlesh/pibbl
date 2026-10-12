import mount from "../../../../scenarios/src/learning/composition/financial-trend-volatility.example.js";
import { afterEach, expect, it, vi } from "vitest";
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function scene(width = 960, height = 620) {
  const pending = new Map<number, FrameRequestCallback>();
  let id = 0,
    time = performance.now();
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
    pending.set(++id, cb);
    return id;
  });
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    pending.delete(id);
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, width, height),
  );
  document.body.append(canvas);
  let labels: string[] = [];
  const context = canvas.getContext("2d")!,
    native = context.fillText.bind(context);
  vi.spyOn(context, "fillText").mockImplementation((text, x, y, maxWidth) => {
    labels.push(String(text));
    const metrics = context.measureText(text),
      transform = context.getTransform();
    const left = transform.transformPoint(
      new DOMPoint(
        x - metrics.actualBoundingBoxLeft,
        y - metrics.actualBoundingBoxAscent,
      ),
    );
    const right = transform.transformPoint(
      new DOMPoint(
        x + metrics.actualBoundingBoxRight,
        y + metrics.actualBoundingBoxDescent,
      ),
    );
    expect(left.x, String(text)).toBeGreaterThanOrEqual(-1);
    expect(right.x, String(text)).toBeLessThanOrEqual(width + 1);
    expect(left.y, String(text)).toBeGreaterThanOrEqual(-1);
    expect(right.y, String(text)).toBeLessThanOrEqual(height + 1);
    native(text, x, y, maxWidth);
  });
  const controller = mount(canvas);
  const flush = () => {
    time += 40;
    const callbacks = [...pending.values()];
    pending.clear();
    if (callbacks.length) labels = [];
    callbacks.forEach((cb) => cb(time));
    return labels;
  };
  const click = (x: number, y: number) => {
    for (const type of ["mousedown", "mouseup", "click"])
      canvas.dispatchEvent(
        new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }),
      );
    for (let i = 0; i < 8; i++) flush();
    return labels;
  };
  return { controller, flush, click, canvas };
}
it("shows realistic candle context, all three overlays and adjustable calculation periods", () => {
  const s = scene();
  try {
    const labels = s.flush();
    expect(labels).toContain("Trend and Volatility");
    expect(labels.some((text) => text.includes("simulated USD"))).toBe(true);
    expect(labels.some((text) => text.includes("SMA 20"))).toBe(true);
    expect(labels.some((text) => text.includes("EMA 20"))).toBe(true);
    expect(labels.some((text) => text.includes("BB 20"))).toBe(true);
    expect(labels).toContain("Price (USD)");
    expect(s.click(381, 100).some((text) => text.includes("SMA 30"))).toBe(
      true,
    );
    const gap = s.click(373, 130);
    expect(gap.some((text) => text.includes("Missing close"))).toBe(true);
    expect(gap.some((text) => text.includes("warming"))).toBe(true);
  } finally {
    s.controller.dispose();
  }
});
it("keeps meaningful values and controls visible in a phone allocation and both palettes", () => {
  const s = scene(360, 260);
  try {
    expect(s.flush()).toContain("Trend and Volatility");
    expect(s.click(315, 22)).toContain("Light");
    expect(
      s.click(268, 130).some((text) => text.includes("Missing close")),
    ).toBe(true);
  } finally {
    s.controller.dispose();
  }
});

it("paints readable band shading in both palettes without compounded transparency", () => {
  const fills: { color: string; alpha: number }[] = [];
  const nativeFill = CanvasRenderingContext2D.prototype.fill;
  vi.spyOn(CanvasRenderingContext2D.prototype, "fill").mockImplementation(
    function (
      this: CanvasRenderingContext2D,
      ...args: Parameters<CanvasRenderingContext2D["fill"]>
    ) {
      if (typeof this.fillStyle === "string")
        fills.push({ color: this.fillStyle, alpha: this.globalAlpha });
      Reflect.apply(nativeFill, this, args);
    },
  );
  const s = scene();
  try {
    s.flush();
    expect(
      fills.some((fill) => fill.color === "#a487eb" && fill.alpha >= 0.2),
    ).toBe(true);
    fills.length = 0;
    s.click(915, 22);
    expect(
      fills.some((fill) => fill.color === "#9675cf" && fill.alpha >= 0.18),
    ).toBe(true);
  } finally {
    s.controller.dispose();
  }
});

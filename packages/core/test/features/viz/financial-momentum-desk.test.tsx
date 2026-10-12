import mount from "../../../../scenarios/src/learning/composition/financial-momentum-desk.example.js";
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
it("links price inspection to RSI, MACD and stochastic study panes", () => {
  const s = scene();
  try {
    const initial = s.flush();
    expect(initial).toContain("Momentum Desk");
    expect(initial.some((label) => label.includes("RSI 14"))).toBe(true);
    expect(initial).toContain("Price (USD)");
    expect(initial).toContain("70");
    expect(
      s.click(130, 84).some((label) => label.includes("MACD 12/26/9")),
    ).toBe(true);
    expect(
      s.click(215, 84).some((label) => label.includes("Stochastic 14/3/3")),
    ).toBe(true);
    expect(
      s.click(373, 114).some((label) => label.includes("Missing close")),
    ).toBe(true);
  } finally {
    s.controller.dispose();
  }
});
it("keeps the active study and price context legible on a phone", () => {
  const s = scene(360, 260);
  try {
    expect(s.flush()).toContain("Momentum Desk");
    expect(
      s.click(98, 84).some((label) => label.includes("MACD 12/26/9")),
    ).toBe(true);
    expect(
      s.click(151, 84).some((label) => label.includes("Stochastic 14/3/3")),
    ).toBe(true);
    expect(s.click(315, 22)).toContain("Light");
  } finally {
    s.controller.dispose();
  }
});

it("inspects the same recorded time from either linked pane", () => {
  const s = scene();
  try {
    const initial = s.flush().find((label) => label.includes("Close $"));
    const hover = (y: number) => {
      s.canvas.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX: 500,
          clientY: y,
          bubbles: true,
        }),
      );
      return s.flush().find((label) => label.includes("Close $"));
    };
    const price = hover(200);
    expect(price).toBeDefined();
    expect(price).not.toEqual(initial);
    expect(hover(470)).toEqual(price);
  } finally {
    s.controller.dispose();
  }
});

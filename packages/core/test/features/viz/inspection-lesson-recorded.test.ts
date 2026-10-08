import { afterEach, expect, it, vi } from "vitest";
import mount from "../../../../scenarios/src/learning/composition/viz-recorded-inspection.example.js";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
it("explains the requested order time and visibly identifies the nearest recorded quote", () => {
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
    frames.set(++id, cb);
    return id;
  });
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    frames.delete(id);
  });
  const flush = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((cb) => cb(performance.now()));
  };
  const canvas = document.createElement("canvas");
  canvas.width = 340;
  canvas.height = 280;
  document.body.append(canvas);
  const ctx = canvas.getContext("2d")!;
  const text: string[] = [];
  const original = ctx.fillText.bind(ctx);
  vi.spyOn(ctx, "fillText").mockImplementation((label, x, y, maxWidth) => {
    text.push(label);
    const metrics = ctx.measureText(label),
      transform = ctx.getTransform();
    const a = transform.transformPoint(
      new DOMPoint(
        x - metrics.actualBoundingBoxLeft,
        y - metrics.actualBoundingBoxAscent,
      ),
    );
    const b = transform.transformPoint(
      new DOMPoint(
        x + metrics.actualBoundingBoxRight,
        y + metrics.actualBoundingBoxDescent,
      ),
    );
    expect(a.x, label).toBeGreaterThanOrEqual(0);
    expect(a.y, label).toBeGreaterThanOrEqual(0);
    expect(b.x, label).toBeLessThanOrEqual(canvas.width);
    expect(b.y, label).toBeLessThanOrEqual(canvas.height);
    if (maxWidth === undefined) original(label, x, y);
    else original(label, x, y, maxWidth);
  });
  const controller = mount(canvas);
  try {
    flush();
    expect(text).toContain("Price at an order time");
    expect(text).toContain("Recorded quotes · deterministic simulation");
    expect(text).toContain("Choose an order time");
    const bounds = canvas.getBoundingClientRect();
    for (const type of ["mousedown", "mouseup", "click"])
      canvas.dispatchEvent(
        new MouseEvent(type, {
          clientX: bounds.left + 160,
          clientY: bounds.top + 195,
          bubbles: true,
        }),
      );
    flush();
    expect(text).toContain("Order 09:36 → quote 09:35");
    expect(text).toContain("$103.00 · source row 1 · 1 min away");
    expect(text).toContain("Nearest recorded quote; no interpolation");
    canvas.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    flush();
    expect(text).toContain("Order 09:39 → quote 09:40");
    expect(text).toContain("$101.00 · source row 2 · 1 min away");
  } finally {
    controller.dispose();
  }
  expect(frames.size).toBe(0);
});

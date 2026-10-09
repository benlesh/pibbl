import mount from "../../../../scenarios/src/learning/composition/financial-market-session.example.js";
import { afterEach, expect, it, vi } from "vitest";
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
it("shows responsive market geometry and lazy native mouse/touch-equivalent inspection", () => {
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
    const entries = [...frames.values()];
    frames.clear();
    entries.forEach((cb) => cb(performance.now()));
  };
  const canvas = document.createElement("canvas");
  canvas.width = 760;
  canvas.height = 460;
  document.body.append(canvas);
  const ctx = canvas.getContext("2d")!,
    labels: string[] = [],
    native = ctx.fillText.bind(ctx);
  vi.spyOn(ctx, "fillText").mockImplementation((text, x, y, maxWidth) => {
    labels.push(text);
    const m = ctx.measureText(text),
      t = ctx.getTransform();
    const a = t.transformPoint(
        new DOMPoint(
          x - m.actualBoundingBoxLeft,
          y - m.actualBoundingBoxAscent,
        ),
      ),
      b = t.transformPoint(
        new DOMPoint(
          x + m.actualBoundingBoxRight,
          y + m.actualBoundingBoxDescent,
        ),
      );
    expect(a.x, text).toBeGreaterThanOrEqual(0);
    expect(b.x, text).toBeLessThanOrEqual(760);
    expect(a.y, text).toBeGreaterThanOrEqual(0);
    expect(b.y, text).toBeLessThanOrEqual(460);
    native(text, x, y, maxWidth);
  });
  const c = mount(canvas);
  try {
    flush();
    expect(labels).toContain("Market Session");
    expect(labels).toContain("Daily · simulation");
    const box = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new MouseEvent("mousemove", {
        clientX: box.left + 16 + (28.5 / 56) * (760 - 94),
        clientY: box.top + 120,
        bubbles: true,
      }),
    );
    flush();
    expect(labels).toContain("12 Feb 2026");
    for (const type of ["mousedown", "mouseup", "click"])
      canvas.dispatchEvent(
        new MouseEvent(type, {
          clientX: box.left + 16 + (6.5 / 56) * (760 - 94),
          clientY: box.top + 424,
          bubbles: true,
        }),
      );
    flush();
    expect(labels).toContain("13 Jan 2026");
    canvas.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    canvas.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    flush();
    expect(labels).toContain("14 Jan 2026");
  } finally {
    c.dispose();
  }
  expect(frames.size).toBe(0);
});

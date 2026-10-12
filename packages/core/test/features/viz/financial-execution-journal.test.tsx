import mount from "../../../../scenarios/src/learning/composition/financial-execution-journal.example.js";
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
  let positions: { text: string; x: number; y: number }[] = [];
  const context = canvas.getContext("2d")!,
    native = context.fillText.bind(context);
  vi.spyOn(context, "fillText").mockImplementation((text, x, y, maxWidth) => {
    labels.push(String(text));
    const at = context.getTransform().transformPoint(new DOMPoint(x, y));
    positions.push({ text: String(text), x: at.x, y: at.y });
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
    if (callbacks.length) {
      labels = [];
      positions = [];
    }
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
  return { controller, flush, click, canvas, positions: () => positions };
}
it("shows OHLC bars, baseline comparison and selectable simulated entry fills", () => {
  const s = scene();
  try {
    const labels = s.flush();
    expect(labels).toContain("Execution Journal");
    expect(labels.some((text) => text.includes("simulated USD"))).toBe(true);
    expect(labels.some((text) => text.includes("Entry B2"))).toBe(true);
    expect(labels).toContain("Price (USD)");
    expect(s.click(280, 100).some((text) => text.includes("Entry B1"))).toBe(
      true,
    );
    expect(
      s.click(373, 130).some((text) => text.includes("Missing close")),
    ).toBe(true);
  } finally {
    s.controller.dispose();
  }
});
it("keeps the selected fill and views legible on a phone in both palettes", () => {
  const s = scene(360, 260);
  try {
    expect(s.flush()).toContain("Execution Journal");
    expect(s.click(205, 100).some((text) => text.includes("Entry B1"))).toBe(
      true,
    );
    expect(s.click(315, 22)).toContain("Light");
  } finally {
    s.controller.dispose();
  }
});

it("pans an offscreen entry to the center without changing the visible session span", () => {
  const s = scene();
  const sessions = (labels: string[]) => {
    const window = labels.find((text) => text.startsWith("Window "))!;
    return Number(/· ([0-9.]+) sessions wide/.exec(window)![1]);
  };
  try {
    s.flush();
    const zoomed = s.click(36, 130);
    const span = sessions(zoomed);
    expect(
      s.positions().some((label) => label.text === "B1" && label.y > 153),
    ).toBe(false);
    const panned = s.click(280, 100);
    expect(sessions(panned)).toBe(span);
    const marker = s
      .positions()
      .find((label) => label.text === "B1" && label.y > 153);
    expect(marker).toBeDefined();
    expect(marker!.x - 7).toBeCloseTo((50 + 942) / 2, 3);
    expect(panned.some((label) => label.includes("outside window"))).toBe(
      false,
    );
    const unchanged = s.click(373, 100); // B2 requires panning again, preserving the span.
    expect(sessions(unchanged)).toBe(span);
    const b2 = s
      .positions()
      .find((label) => label.text === "B2" && label.y > 153);
    expect(b2!.x - 7).toBeCloseTo((50 + 942) / 2, 3);
    const window = unchanged.find((label) => label.startsWith("Window "));
    expect(
      s.click(373, 100).find((label) => label.startsWith("Window ")),
    ).toEqual(window);
  } finally {
    s.controller.dispose();
  }
});

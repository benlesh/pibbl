import mount from "../../../../scenarios/src/learning/composition/financial-market-session.example.js";
import { afterEach, expect, it, vi } from "vitest";

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((dispose) => dispose());
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function scene(width = 760, height = 460) {
  const frames = new Map<number, FrameRequestCallback>();
  let frame = 0;
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
    frames.set(++frame, cb);
    return frame;
  });
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    frames.delete(id);
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, width, height),
  );
  document.body.append(canvas);
  let labels: string[] = [];
  const ctx = canvas.getContext("2d")!;
  const native = ctx.fillText.bind(ctx);
  vi.spyOn(ctx, "fillText").mockImplementation((text, x, y, maxWidth) => {
    labels.push(String(text));
    const m = ctx.measureText(text),
      t = ctx.getTransform();
    const a = t.transformPoint(
      new DOMPoint(x - m.actualBoundingBoxLeft, y - m.actualBoundingBoxAscent),
    );
    const b = t.transformPoint(
      new DOMPoint(
        x + m.actualBoundingBoxRight,
        y + m.actualBoundingBoxDescent,
      ),
    );
    expect(a.x, String(text)).toBeGreaterThanOrEqual(-1);
    expect(b.x, String(text)).toBeLessThanOrEqual(width + 1);
    expect(a.y, String(text)).toBeGreaterThanOrEqual(-1);
    expect(b.y, String(text)).toBeLessThanOrEqual(height + 1);
    native(text, x, y, maxWidth);
  });
  const controller = mount(canvas);
  cleanups.push(() => controller.dispose());
  const flush = () => {
    if (frames.size) labels = [];
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((cb) => cb(performance.now()));
    return labels;
  };
  const click = (x: number, y: number) => {
    for (const type of ["mousedown", "mouseup", "click"])
      canvas.dispatchEvent(
        new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }),
      );
    return flush();
  };
  const move = (x: number, y: number) => {
    canvas.dispatchEvent(
      new MouseEvent("mousemove", { clientX: x, clientY: y, bubbles: true }),
    );
    return flush();
  };
  const key = (key: string) => {
    canvas.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
    );
    return flush();
  };
  return { canvas, ctx, flush, click, move, key };
}

it("snaps both panes to one recorded OHLCV timestamp and pins independently of mouse preview", () => {
  const s = scene();
  expect(s.flush()).toContain("Auto");
  const x = (slot: number) => 16 + ((slot + 0.5) / 56) * (760 - 94);
  expect(s.move(x(6), 170)).toContain("13 Jan 2026");
  expect(s.click(x(6), 405)).toContain("Pinned");
  expect(s.move(x(28), 170)).toContain("13 Jan 2026");
  expect(s.key("ArrowRight")).toContain("14 Jan 2026");
  expect(s.key("Escape")).toContain("Inspect");
  expect(s.move(x(28), 170)).toContain("12 Feb 2026");
});

it("changes the visible domain independently of selection and freezes a manual domain", () => {
  const s = scene();
  const initial = s.flush();
  expect(initial.some((text) => text.startsWith("Visible range "))).toBe(true);
  const initialRange = initial.find((text) =>
    text.startsWith("Visible range "),
  );
  const recent = s.click(99, 92);
  expect(recent.find((text) => text.startsWith("Visible range "))).not.toBe(
    initialRange,
  );
  expect(recent).toContain("Recent");
  const manual = s.click(224, 92);
  expect(manual).toContain("Manual");
  const locked = manual.find((text) => text.startsWith("Visible range "));
  expect(
    s.click(156, 92).find((text) => text.startsWith("Visible range ")),
  ).toBe(locked);
  expect(s.click(292, 92)).toContain("Log");
});

it("adds calendar and bounded navigation while preserving the pinned timestamp", () => {
  const s = scene();
  s.flush();
  const x = 16 + 6.5 / 56 * (760 - 94);
  s.click(x, 170);
  const labels = s.click(30, 120);
  expect(labels).toContain("1M");
  expect(labels).toContain("13 Jan 2026");
  expect(labels.some(text => text.includes("outside window"))).toBe(true);
  expect(s.click(300, 120)).toContain("13 Jan 2026");
});

it("keeps the OHLCV readout and controls bounded on a narrow phone in both palettes", () => {
  const s = scene(360, 260);
  const labels = s.flush();
  expect(labels.some((text) => text.includes("shares"))).toBe(true);
  expect(labels.some((text) => text.includes("USD"))).toBe(true);
  expect(s.click(314, 22)).toContain("Light");
  expect(s.key("Enter")).toContain("Dark");
});

it("preserves recorded OHLC when that exact observation has missing volume", () => {
  const s = scene();
  s.flush();
  const texts = s.move(16 + (18.5 / 56) * (760 - 94), 170);
  expect(texts).toContain("29 Jan 2026");
  expect(texts.some((text) => text.includes("— shares"))).toBe(true);
  expect(texts.some((text) => text.startsWith("O "))).toBe(true);
});

import calendarMount from "../../../../scenarios/src/learning/composition/financial-calendar-ranges.example.js";
import linkedMount from "../../../../scenarios/src/learning/composition/financial-linked-panes.example.js";
import normalizedMount from "../../../../scenarios/src/learning/composition/financial-normalized-returns.example.js";
import { afterEach, expect, it, vi } from "vitest";

const frames = new Map<number, FrameRequestCallback>(); let id = 0;
afterEach(() => { frames.clear(); id = 0; document.body.replaceChildren(); vi.restoreAllMocks(); });
function scene(example: (canvas: HTMLCanvasElement) => { dispose(): void }, width = 480, height = 300) {
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => { frames.set(++id, callback); return id; });
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((key) => { frames.delete(key); });
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, width, height)); document.body.append(canvas);
  const labels: string[] = []; const bounds: { left: number; right: number; top: number; bottom: number; text: string }[] = []; const context = canvas.getContext("2d")!; const native = context.fillText.bind(context);
  vi.spyOn(context, "fillText").mockImplementation((text, x, y, maxWidth) => { const label = String(text); labels.push(label); const measured = context.measureText(label), transform = context.getTransform(); const start = transform.transformPoint(new DOMPoint(x - measured.actualBoundingBoxLeft, y - measured.actualBoundingBoxAscent)); const end = transform.transformPoint(new DOMPoint(x + measured.actualBoundingBoxRight, y + measured.actualBoundingBoxDescent)); bounds.push({ left: start.x, right: end.x, top: start.y, bottom: end.y, text: label }); native(text, x, y, maxWidth); });
  const controller = example(canvas); const flush = () => { const next = [...frames.values()]; frames.clear(); next.forEach((callback) => callback(performance.now())); }; flush();
  return { canvas, labels, bounds, controller, flush };
}

it("coordinates a selected supplied timestamp across price and volume", () => {
  const view = scene(linkedMount);
  try {
    expect(view.labels).toContain("Northstar Materials · daily OHLCV");
    expect(view.labels.some((label) => label.includes("shares"))).toBe(true);
    const before = view.labels.filter((label) => label.includes("O $")).at(-1);
    for (const type of ["mousedown", "mouseup", "click"]) view.canvas.dispatchEvent(new MouseEvent(type, { clientX: 130, clientY: 250, bubbles: true }));
    view.flush();
    expect(view.labels.filter((label) => label.includes("O $")).at(-1)).not.toBe(before);
  } finally { view.controller.dispose(); }
});

it("uses calendar membership and bounded controls without inventing observations", () => {
  const view = scene(calendarMount);
  try {
    expect(view.labels).toContain("Northstar Materials · calendar windows");
    expect(view.labels.some((label) => label.includes("65 supplied sessions"))).toBe(true);
    expect(view.labels.some((label) => label.includes("1M starts 28 Feb UTC"))).toBe(true);
  } finally { view.controller.dispose(); }
});

it("shows a fixed common base, explicit line gap, and unavailable asset status", () => {
  const view = scene(normalizedMount);
  try {
    expect(view.labels).toContain("Normalized returns from a common base");
    expect(view.labels).toContain("Price return (%)");
    expect(view.labels.some(label => label.includes("Jan") || label.includes("Feb") || label.includes("Mar"))).toBe(true);
    expect(view.labels.some((label) => label.includes("Orbit") && (label.includes("base missing") || label.includes("no exact common base")))).toBe(true);
    expect(view.labels.some((label) => label.includes("Index 100"))).toBe(true);
  } finally { view.controller.dispose(); }
});

it("keeps coordinated lesson text within a 360 × 260 phone canvas", () => {
  for (const example of [linkedMount, calendarMount, normalizedMount]) {
    const view = scene(example, 360, 260);
    try {
      for (const bound of view.bounds) {
        expect(bound.left, bound.text).toBeGreaterThanOrEqual(-1);
        expect(bound.right, bound.text).toBeLessThanOrEqual(361);
        expect(bound.top, bound.text).toBeGreaterThanOrEqual(-1);
        expect(bound.bottom, bound.text).toBeLessThanOrEqual(261);
      }
    } finally { view.controller.dispose(); vi.restoreAllMocks(); }
  }
});

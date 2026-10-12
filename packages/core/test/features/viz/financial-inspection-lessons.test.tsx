import crosshairMount from "../../../../scenarios/src/learning/composition/financial-crosshair.example.js";
import guidesMount from "../../../../scenarios/src/learning/composition/financial-price-guides.example.js";
import autoscaleMount from "../../../../scenarios/src/learning/composition/financial-visible-autoscale.example.js";
import { afterEach, expect, it, vi } from "vitest";

const frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
afterEach(() => {
  frames.clear();
  frameId = 0;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function mount(example: (canvas: HTMLCanvasElement) => { dispose(): void }, width = 480, height = 300) {
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((key) => {
    frames.delete(key);
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, width, height));
  document.body.append(canvas);
  const labels: string[] = [];
  const bounds: { left: number; right: number; top: number; bottom: number; text: string }[] = [];
  const context = canvas.getContext("2d")!;
  const native = context.fillText.bind(context);
  vi.spyOn(context, "fillText").mockImplementation((text, x, y, maxWidth) => {
    labels.push(String(text));
    const measured = context.measureText(String(text));
    const transform = context.getTransform();
    const start = transform.transformPoint(new DOMPoint(x - measured.actualBoundingBoxLeft, y - measured.actualBoundingBoxAscent));
    const end = transform.transformPoint(new DOMPoint(x + measured.actualBoundingBoxRight, y + measured.actualBoundingBoxDescent));
    bounds.push({ left: start.x, right: end.x, top: start.y, bottom: end.y, text: String(text) });
    native(text, x, y, maxWidth);
  });
  const controller = example(canvas);
  const flush = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(performance.now()));
  };
  flush();
  return { canvas, controller, flush, labels, bounds };
}

it("teaches snapped pinning and keyboard inspection without persisting a borrowed hit", () => {
  const scene = mount(crosshairMount);
  try {
    expect(scene.labels).toContain("Snapped OHLCV inspection");
    expect(scene.labels.some((label) => label.includes("12 Oct 2026"))).toBe(true);
    expect(scene.labels).toContain("Preview");
    for (const type of ["mousedown", "mouseup", "click"])
      scene.canvas.dispatchEvent(new MouseEvent(type, { clientX: 240, clientY: 100, bubbles: true }));
    scene.flush();
    expect(scene.labels).toContain("Pinned");
    scene.canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    scene.flush();
    expect(scene.labels.some((label) => label.includes("08 Oct 2026"))).toBe(true);
  } finally { scene.controller.dispose(); }
});

it("teaches data-anchored price guides with Intl-backed labels", () => {
  const scene = mount(guidesMount);
  try {
    expect(scene.labels).toContain("Price guides and formatting");
    expect(scene.labels.some((label) => label.includes("Last $104.35"))).toBe(true);
    expect(scene.labels.some((label) => label.includes("shares"))).toBe(true);
  } finally { scene.controller.dispose(); }
});

it("teaches visible OHLC autoscaling without an off-window extreme", () => {
  const scene = mount(autoscaleMount);
  try {
    expect(scene.labels).toContain("Visible-window autoscaling");
    expect(scene.labels).toContain("Recent window · $98.50–$104.50");
    expect(scene.labels).toContain("$98.50");
    expect(scene.labels).toContain("$104.50");
    expect(scene.labels).toContain("08 Oct");
    expect(scene.labels).toContain("09 Oct");
    scene.labels.length = 0;
    for (const type of ["mousedown", "mouseup", "click"])
      scene.canvas.dispatchEvent(new MouseEvent(type, { clientX: 240, clientY: 140, bubbles: true }));
    scene.flush();
    expect(scene.labels).toContain("Earlier window · $33.90–$167.10");
    expect(scene.labels).toContain("$33.90");
    expect(scene.labels).toContain("$167.10");
    expect(scene.labels).toContain("05 Oct");
    expect(scene.labels).toContain("07 Oct");
    expect(scene.labels).not.toContain("08 Oct");
    scene.labels.length = 0;
    scene.canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    scene.flush();
    expect(scene.labels).toContain("Recent window · $98.50–$104.50");
    scene.labels.length = 0;
    scene.canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    scene.flush();
    expect(scene.labels).toContain("Earlier window · $33.90–$167.10");
    scene.labels.length = 0;
    for (const type of ["mousedown", "mouseup", "click"])
      scene.canvas.dispatchEvent(new MouseEvent(type, { clientX: 234, clientY: 261, bubbles: true }));
    scene.flush();
    expect(scene.labels).toContain("Recent window · $98.50–$104.50");
    scene.labels.length = 0;
    for (const type of ["mousedown", "mouseup", "click"])
      scene.canvas.dispatchEvent(new MouseEvent(type, { clientX: 86, clientY: 261, bubbles: true }));
    scene.flush();
    expect(scene.labels).toContain("Earlier window · $33.90–$167.10");
  } finally { scene.controller.dispose(); }
});

it("keeps all three financial lessons' text inside a narrow 360 × 260 canvas", () => {
  for (const example of [crosshairMount, guidesMount, autoscaleMount]) {
    const scene = mount(example, 360, 260);
    expect(scene.bounds.length).toBeGreaterThan(0);
    for (const label of scene.bounds) {
      expect(label.left, label.text).toBeGreaterThanOrEqual(-1);
      expect(label.right, label.text).toBeLessThanOrEqual(361);
      expect(label.top, label.text).toBeGreaterThanOrEqual(-1);
      expect(label.bottom, label.text).toBeLessThanOrEqual(261);
    }
    scene.controller.dispose();
    vi.restoreAllMocks();
  }
});

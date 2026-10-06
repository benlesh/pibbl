import { expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";
import { tab, pressKey } from "../../support/user-input.js";
import mount from "../../../../scenarios/src/learning/composition/viz-signed-population.example.js";
it.each([[320, 260], [360, 300], [560, 300], [1000, 640]])("preserves all state identities and inspection at %ix%i", async (width, height) => {
  const runtime = testRuntime();
  const labels: string[] = [], names = ["Texas", "Florida", "Pennsylvania", "Illinois", "California", "New York"];
  const axisNames = width <= 600 ? ["TX", "FL", "PA", "IL", "CA", "NY"] : names;
  const boxes = new Map<string, { left: number; right: number }>();
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(function (this: CanvasRenderingContext2D, text, x, y) {
    if (!this.globalAlpha) return; labels.push(text);
    const m = this.measureText(text), matrix = this.getTransform(), ratio = this.canvas.width / width;
    const a = new DOMPoint(x - m.actualBoundingBoxLeft, y - m.actualBoundingBoxAscent).matrixTransform(matrix);
    const b = new DOMPoint(x + m.actualBoundingBoxRight, y + m.actualBoundingBoxDescent).matrixTransform(matrix);
    expect(a.x / ratio, text).toBeGreaterThanOrEqual(0); expect(b.x / ratio, text).toBeLessThanOrEqual(width);
    expect(a.y / ratio, text).toBeGreaterThanOrEqual(0); expect(b.y / ratio, text).toBeLessThanOrEqual(height);
    if (axisNames.includes(text)) boxes.set(text, { left: a.x / ratio, right: b.x / ratio });
  });
  const before = document.createElement("button"); before.textContent = "before";
  const canvas = document.createElement("canvas"); canvas.style.cssText = `width:${width}px;height:${height}px`; document.body.append(before, canvas);
  const app = mount(canvas);
  try {
    runtime.flush(); expect(labels).toContain("Texas · +473,453 people");
    for (const name of [...axisNames, "Gain", "Loss"]) expect(labels).toContain(name);
    for (let i = 1; i < axisNames.length; i++) expect(boxes.get(axisNames[i])!.left).toBeGreaterThan(boxes.get(axisNames[i - 1])!.right);
    before.focus(); await tab(); runtime.flush(); await pressKey("Enter"); runtime.flush(); expect(labels).toContain("Restore compression");
    await tab(); runtime.flush(); await pressKey("ArrowRight"); runtime.flush(); expect(labels).toContain("Florida · +365,205 people");
    const box = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch", clientX: box.left + (58 + (width - 82) / 12), clientY: box.top + (height <= 400 ? 130 : 260) }));
    runtime.flush(); expect(labels).toContain("Texas · +473,453 people");
  } finally { app.dispose(); expect(runtime.pending).toBe(0); runtime.dispose(); }
});

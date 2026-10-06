import { tab, pressKey } from "../../support/user-input.js";
import { expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";
import mount from "../../../../scenarios/src/learning/composition/viz-long-labels.example.js";
it.each([[360, 300], [560, 300], [900, 640]])("keeps long labels and controls usable at %ix%i", async (width, height) => {
  const runtime = testRuntime();
  const labels: string[] = [];
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(function (this: CanvasRenderingContext2D, text, x, y) {
    if (!this.globalAlpha) return;
    labels.push(text);
    const metrics = this.measureText(text), matrix = this.getTransform();
    const ratio = this.canvas.width / width;
    const start = new DOMPoint(x - metrics.actualBoundingBoxLeft, y - metrics.actualBoundingBoxAscent).matrixTransform(matrix);
    const end = new DOMPoint(x + metrics.actualBoundingBoxRight, y + metrics.actualBoundingBoxDescent).matrixTransform(matrix);
    expect(start.x / ratio, text).toBeGreaterThanOrEqual(0);
    expect(end.x / ratio, text).toBeLessThanOrEqual(width);
    expect(start.y / ratio, text).toBeGreaterThanOrEqual(0);
    expect(end.y / ratio, text).toBeLessThanOrEqual(height);
  });
  const canvas = document.createElement("canvas"); canvas.style.cssText = `width:${width}px;height:${height}px`; document.body.append(canvas);
  const app = mount(canvas);
  try {
    runtime.flush();
    const box = canvas.getBoundingClientRect();
    const event = { bubbles: true, clientX: box.left + 70, clientY: box.top + (height <= 350 ? 60 : 100) };
    for (const type of ["mousedown", "mouseup", "click"]) canvas.dispatchEvent(new MouseEvent(type, event));
    runtime.flush(); expect(labels).toContain("Truncate labels · change");
    canvas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch", clientX: box.left + (width < 500 ? 160 : 220), clientY: box.top + (height <= 350 ? 165 : 290) }));
    runtime.flush();
    expect(labels.some(text => text.includes("1980 · Mauna Loa ·") && !text.startsWith("January"))).toBe(true);
    const before = document.createElement("button"); before.textContent = "before"; canvas.before(before); before.focus();
    await tab(); runtime.flush();
    await tab(); runtime.flush();
    expect(document.activeElement).toBe(canvas);
    const prior = labels.filter(text => text.includes("1980 · Mauna Loa ·")).at(-1);
    await pressKey("ArrowRight");
    runtime.flush();
    expect(labels.filter(text => text.includes("1980 · Mauna Loa ·")).at(-1)).not.toBe(prior);
  } finally { app.dispose(); runtime.dispose(); }
});

import { expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";
import { tab, pressKey } from "../../support/user-input.js";
import mount from "../../../../scenarios/src/learning/composition/viz-log-masses.example.js";
import basics from "../../../../scenarios/src/learning/composition/viz-log-basics.example.js";
it.each([[320, 260], [360, 300], [560, 300], [1000, 660]])("keeps NASA chart text and keyboard controls usable at %ix%i", async (width, height) => {
  const runtime = testRuntime();
  const labels: string[] = [];
  const bodyBounds = new Map<string, { top: number; bottom: number }>();
  const names = ["Mercury", "Venus", "Earth", "Moon", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(function (this: CanvasRenderingContext2D, text, x, y) {
    if (!this.globalAlpha) return;
    labels.push(text);
    const metrics = this.measureText(text), matrix = this.getTransform(), ratio = this.canvas.width / width;
    const start = new DOMPoint(x - metrics.actualBoundingBoxLeft, y - metrics.actualBoundingBoxAscent).matrixTransform(matrix);
    const end = new DOMPoint(x + metrics.actualBoundingBoxRight, y + metrics.actualBoundingBoxDescent).matrixTransform(matrix);
    if (names.includes(text)) bodyBounds.set(text, { top: start.y / ratio, bottom: end.y / ratio });
    expect(start.x / ratio, text).toBeGreaterThanOrEqual(0); expect(end.x / ratio, text).toBeLessThanOrEqual(width);
    expect(start.y / ratio, text).toBeGreaterThanOrEqual(0); expect(end.y / ratio, text).toBeLessThanOrEqual(height);
  });
  const before = document.createElement("button"); before.textContent = "before";
  const canvas = document.createElement("canvas"); canvas.style.cssText = `width:${width}px;height:${height}px`; document.body.append(before, canvas);
  const app = mount(canvas);
  try {
    runtime.flush(); expect(labels).toContain("Jupiter · 1,898 × 10²⁴ kg");
    for (const name of ["Mercury", "Venus", "Earth", "Moon", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]) expect(labels, `Missing identity: ${name}`).toContain(name);
    for (let i = 1; i < names.length; i++) expect(bodyBounds.get(names[i])!.top, `Overlapping identity: ${names[i]}`).toBeGreaterThan(bodyBounds.get(names[i - 1])!.bottom);
    before.focus(); await tab(); runtime.flush();
    await pressKey("Enter"); runtime.flush(); expect(labels).toContain("Earth = 1 · reset");
    await tab(); runtime.flush(); expect(document.activeElement).toBe(canvas);
    await pressKey("ArrowDown"); runtime.flush(); expect(labels.some(text => text.startsWith("Saturn ·") && text.endsWith("Earth masses"))).toBe(true);
    const bounds = canvas.getBoundingClientRect();
    const left = width <= 600 ? 76 : 112;
    const mercuryX = left + Math.log10((0.330 / 5.97) / 0.001) / 6 * (width - left - 32);
    canvas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch", clientX: bounds.left + mercuryX, clientY: bounds.top + (height <= 400 ? 101 : 239) }));
    runtime.flush(); expect(labels.some(text => text.startsWith("Mercury ·"))).toBe(true);
  } finally { app.dispose(); expect(runtime.pending).toBe(0); runtime.dispose(); }
});
it("runs the minimal dedicated log provider/hook demo", () => {
  const runtime = testRuntime(); const canvas = document.createElement("canvas"); canvas.width = 360; canvas.height = 260; document.body.append(canvas);
  const app = basics(canvas);
  try { expect(() => runtime.flush()).not.toThrow(); } finally { app.dispose(); runtime.dispose(); }
});

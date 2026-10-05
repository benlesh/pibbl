import { page } from "vitest/browser";
import { afterEach, expect, it, vi } from "vitest";
import climate from "../../../../scenarios/src/learning/composition/viz-utc-climate.example.js";
import basics from "../../../../scenarios/src/learning/composition/viz-utc-basics.example.js";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it.each([360, 1100])("runs the actual NOAA UTC example at %ipx with inspection and range changes", async width => {
  runtime = testRuntime();
  await page.viewport(width + 20, 710);
  const labels: string[] = [];
  const original = CanvasRenderingContext2D.prototype.fillText;
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(function (this: CanvasRenderingContext2D, ...args: Parameters<CanvasRenderingContext2D["fillText"]>) {
    labels.push(args[0]); original.apply(this, args);
  });
  const canvas = document.createElement("canvas");
  canvas.style.cssText = `width:${width}px;height:680px`;
  document.body.append(canvas);
  const app = climate(canvas);
  try {
    runtime.flush();
    expect(labels).toContain("Dec 2021 · 416.67 ppm");
    expect(labels).toContain("1980");
    if (import.meta.env.VITE_PIBBL_VIZ_CAPTURE === "1")
      await page.screenshot({ element: canvas, path: `__screenshots__/pibbl-utc-${width}.png` });
    const rect = canvas.getBoundingClientRect();
    const point = (x: number, y: number) => ({ clientX: rect.left + x, clientY: rect.top + y, bubbles: true, button: 0 });
    const buttonY = width < 620 ? 235 : 202;
    for (const type of ["mousedown", "mouseup", "click"]) canvas.dispatchEvent(new MouseEvent(type, point(70, buttonY)));
    runtime.flush();
    expect(labels).toContain("2012–2021 · reset");
    canvas.dispatchEvent(new PointerEvent("pointerdown", point(width < 620 ? 53 : 78, 400)));
    runtime.flush();
    expect(labels).toContain("Jan 2012 · 393.31 ppm");
    expect(labels).toContain("Pinned · tap again to explore");
  } finally { app.dispose(); }
});

it("mounts the minimal UTC API demo", () => {
  runtime = testRuntime();
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:620px;height:360px";
  document.body.append(canvas);
  const app = basics(canvas);
  try { expect(() => runtime.flush()).not.toThrow(); }
  finally { app.dispose(); }
});

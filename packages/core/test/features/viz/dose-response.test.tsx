import { signal, type PibblController } from "@pibbl/core";
import mount from "../../../../scenarios/src/learning/composition/viz-dose-response.example";
import { afterEach, expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";

let runtime: ReturnType<typeof testRuntime>;
let controller: PibblController | undefined;
afterEach(() => {
  controller?.dispose();
  runtime?.dispose();
});
it("composes observed doses, supplied predictions and intervals while separating zero-dose controls", () => {
  runtime = testRuntime();
  const canvas = document.createElement("canvas");
  canvas.style.width = "960px";
  canvas.style.height = "640px";
  document.body.append(canvas);
  const showBand = signal(true);
  const labels: string[] = [];
  const fillText = CanvasRenderingContext2D.prototype.fillText;
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(
    function (this: CanvasRenderingContext2D, text, x, y, maxWidth) {
      labels.push(String(text));
      if (maxWidth === undefined) fillText.call(this, text, x, y);
      else fillText.call(this, text, x, y, maxWidth);
    },
  );
  controller = mount(canvas, { showBand });
  runtime.flush();
  expect(labels).toContain("Dose (mg) · logarithmic axis");
  expect(labels).toContain("0 mg control · observed response 4%");
  expect(labels).toContain("Supplied 95% confidence band for mean response");
  // At dose 5 / response 21, the supplied band has fill but neither the
  // model line nor any observation is present. Hiding the band clears it.
  const x = Math.round(80 + (824 * Math.log(5)) / Math.log(300));
  const y = Math.round(172 + 318 * (1 - 0.21));
  const pixel = () => [
    ...canvas.getContext("2d")!.getImageData(x, y, 1, 1).data,
  ];
  expect(pixel()[0]).toBeLessThan(255);
  expect(pixel()[1]).toBeGreaterThan(pixel()[0]);
  const checkbox = document.querySelector<HTMLInputElement>(
    'input[type="checkbox"]',
  )!;
  checkbox.click();
  runtime.flush();
  expect(showBand.get()).toBe(false);
  expect(pixel()).toEqual([255, 255, 255, 255]);
  expect(document.querySelectorAll("tbody tr")).toHaveLength(7);
  controller.dispose();
  controller = undefined;
  expect(document.querySelector("details")).toBeNull();
  showBand.set(true);
  expect(runtime.pending).toBe(0);
});

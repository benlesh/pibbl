import { type PibblController } from "@pibbl/core";
import mount from "../../../../scenarios/src/learning/composition/viz-evidence-synthesis.example";
import { afterEach, expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>,
  controller: PibblController | undefined;
afterEach(() => {
  controller?.dispose();
  runtime?.dispose();
});
it("renders published BCG study results and the supplied REML summary through public marks", () => {
  runtime = testRuntime();
  const canvas = document.createElement("canvas");
  canvas.style.width = "1080px";
  document.body.append(canvas);
  const labels: string[] = [];
  const original = CanvasRenderingContext2D.prototype.fillText;
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(
    function (this: CanvasRenderingContext2D, text, x, y, maxWidth) {
      labels.push(String(text));
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    },
  );
  controller = mount(canvas);
  runtime.flush();
  expect(labels).toContain("BCG vaccine · evidence synthesis");
  expect(labels).toContain("REML summary · 13 studies");
  expect(labels).toContain("0.49 [0.34, 0.70]");
  expect(document.querySelectorAll("tbody tr")).toHaveLength(14);
  expect(document.querySelector<HTMLAnchorElement>("a")?.href).toContain(
    "metadat/reference/dat.bcg.html",
  );
  controller.dispose();
  controller = undefined;
  expect(document.querySelector("details")).toBeNull();
  expect(runtime.pending).toBe(0);
});

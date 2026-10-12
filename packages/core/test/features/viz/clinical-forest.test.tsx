import { signal, type PibblController } from "@pibbl/core";
import mount from "../../../../scenarios/src/learning/composition/viz-clinical-forest.example";
import { afterEach, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { testRuntime } from "./support/runtime.js";

let runtime: ReturnType<typeof testRuntime>;
let controller: PibblController | undefined;
afterEach(() => {
  controller?.dispose();
  runtime?.dispose();
});

it("drives the public clinical forest example through row inspection, ordering, and its HTML table", async () => {
  runtime = testRuntime();
  const canvas = document.createElement("canvas");
  canvas.style.width = "960px";
  canvas.style.height = "680px";
  document.body.append(canvas);
  const selected = signal<string | null>(null),
    sorted = signal(false);
  const labels: Array<[string, number]> = [];
  const fillText = CanvasRenderingContext2D.prototype.fillText;
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(
    function (this: CanvasRenderingContext2D, text, x, y, maxWidth) {
      labels.push([
        String(text),
        this.getTransform().transformPoint({ x, y }).y,
      ]);
      if (maxWidth === undefined) fillText.call(this, text, x, y);
      else fillText.call(this, text, x, y, maxWidth);
    },
  );
  controller = mount(canvas, { selected, sorted });
  runtime.flush();
  expect(labels.map(([label]) => label)).toContain(
    "Risk ratio · logarithmic axis · null = 1",
  );
  expect(labels).toContainEqual(["Trial E", 421]);
  await userEvent.click(canvas, { position: { x: 60, y: 131 } });
  runtime.flush();
  expect(sorted.get()).toBe(true);
  expect(labels).toContainEqual(["Trial E", 259]);
  const button = [...document.querySelectorAll("button")].find(
    (button) => button.textContent === "Inspect Trial C",
  )!;
  button.click();
  runtime.flush();
  expect(selected.get()).toBe("Trial C");
  expect(labels.map(([label]) => label)).toContain(
    "Trial C: RR 0.93 · n = 510",
  );
  expect(document.querySelectorAll("tbody tr")).toHaveLength(6);
  controller.dispose();
  controller = undefined;
  expect(document.querySelector("details")).toBeNull();
});

it("disposes once, restoring host styles without overwriting later application changes", () => {
  runtime = testRuntime();
  const host = document.createElement("div");
  host.style.overflow = "hidden";
  host.style.display = "grid";
  const canvas = document.createElement("canvas");
  canvas.style.width = "390px";
  canvas.style.height = "200px";
  canvas.style.minHeight = "100px";
  canvas.style.touchAction = "none";
  host.append(canvas);
  document.body.append(host);
  controller = mount(canvas);
  runtime.flush();
  expect(canvas.style.height).toBe("880px");
  expect(host.style.overflow).toBe("auto");
  controller.dispose();
  expect(canvas.style.height).toBe("200px");
  expect(canvas.style.minHeight).toBe("100px");
  expect(canvas.style.touchAction).toBe("none");
  expect(host.style.display).toBe("grid");
  expect(document.querySelector("details")).toBeNull();
  host.style.overflow = "scroll";
  canvas.style.height = "300px";
  controller.dispose();
  expect(host.style.overflow).toBe("scroll");
  expect(canvas.style.height).toBe("300px");
  expect(runtime.pending).toBe(0);
});

it("replaces an example mount without leaking its HTML or letting an old controller dispose the new one", () => {
  runtime = testRuntime();
  const canvas = document.createElement("canvas");
  canvas.style.width = "960px";
  document.body.append(canvas);
  controller = mount(canvas);
  runtime.flush();
  const old = controller;
  controller = mount(canvas);
  runtime.flush();
  expect(document.querySelectorAll("details")).toHaveLength(1);
  old.dispose();
  expect(document.querySelectorAll("details")).toHaveLength(1);
  expect(canvas.style.height).toBe("680px");
  controller.dispose();
  controller = undefined;
  expect(document.querySelector("details")).toBeNull();
  expect(runtime.pending).toBe(0);
});

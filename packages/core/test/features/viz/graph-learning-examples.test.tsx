import { page } from "vitest/browser";
import { afterEach, expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";
import matrixMount from "../../../../scenarios/src/learning/composition/viz-graph-matrix.example.tsx";
import sankeyMount from "../../../../scenarios/src/learning/composition/viz-graph-sankey.example.tsx";
import bipartiteMount from "../../../../scenarios/src/learning/composition/viz-graph-bipartite.example.tsx";
import chordMount from "../../../../scenarios/src/learning/composition/viz-graph-chord.example.tsx";

const offscreenDraw = OffscreenCanvasRenderingContext2D.prototype.fillText;

type Mount = (canvas: HTMLCanvasElement) => { dispose(): void };
const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function click(canvas: HTMLCanvasElement, x: number, y: number) {
  const box = canvas.getBoundingClientRect();
  for (const type of ["mousedown", "mouseup", "click"])
    canvas.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        clientX: box.left + x,
        clientY: box.top + y,
      }),
    );
}

function runExample(
  mount: Mount,
  title: string,
  visibleLabel: string,
  selected: string,
  point: readonly [number, number],
) {
  const runtime = testRuntime();
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 580;
  document.body.append(canvas);
  const labels: string[] = [];
  const context = canvas.getContext("2d")!;
  vi.spyOn(context, "fillText").mockImplementation((text) => {
    labels.push(String(text));
    return undefined;
  });
  vi.spyOn(
    OffscreenCanvasRenderingContext2D.prototype,
    "fillText",
  ).mockImplementation(function (
    this: OffscreenCanvasRenderingContext2D,
    ...args: Parameters<OffscreenCanvasRenderingContext2D["fillText"]>
  ) {
    labels.push(String(args[0]));
    offscreenDraw.apply(this, args);
  });
  const app = mount(canvas);
  cleanups.push(() => {
    app.dispose();
    runtime.dispose();
  });
  runtime.flush();
  expect(labels).toContain(title);
  expect(labels).toContain(visibleLabel);
  labels.length = 0;
  click(canvas, point[0], point[1]);
  runtime.flush();
  runtime.flush();
  expect(labels).toContain(selected);
}

it("mounts the exact graph lessons with visible labels and selection readouts", () => {
  runExample(
    matrixMount,
    "Product delivery handoffs",
    "Research",
    "Research → Product · 42 requests · reverse: 14",
    [440, 205],
  );
  runExample(
    sankeyMount,
    "Regional energy budget",
    "Solar generation",
    "Solar generation → Electricity · 300 MWh",
    [300, 170],
  );
  runExample(
    bipartiteMount,
    "Climate research network",
    "River Watch",
    "Eastside clinic and Heat safety · participation in the current cohort",
    [450, 232],
  );
  runExample(
    chordMount,
    "District trips",
    "North",
    "North → Central",
    [400, 255],
  );
});

it("lets the climate-network cards select and summarize their connected records", () => {
  runExample(
    bipartiteMount,
    "Climate research network",
    "River Watch",
    "River Watch · 2 study tracks in the current cohort",
    [160, 200],
  );
});

it("makes a selected energy route visibly dominate the rendered Sankey", () => {
  const runtime = testRuntime();
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 580;
  document.body.append(canvas);
  const app = sankeyMount(canvas);
  cleanups.push(() => {
    app.dispose();
    runtime.dispose();
  });
  runtime.flush();
  const context = canvas.getContext("2d")!;
  const selectedBefore = [...context.getImageData(300, 170, 1, 1).data];
  const otherBefore = [...context.getImageData(300, 285, 1, 1).data];
  const background = [248, 246, 240];
  const distance = (pixel: readonly number[]) =>
    Math.hypot(...background.map((channel, index) => channel - pixel[index]));
  click(canvas, 300, 170);
  runtime.flush();
  runtime.flush();
  const selectedAfter = [...context.getImageData(300, 170, 1, 1).data];
  const otherAfter = [...context.getImageData(300, 285, 1, 1).data];
  expect(distance(selectedAfter)).toBeGreaterThan(
    distance(selectedBefore) * 1.5,
  );
  expect(distance(otherBefore)).toBeGreaterThan(25);
  expect(distance(otherAfter)).toBeLessThan(distance(otherBefore) * 0.3);
});

it("clears chord selection on empty canvas clicks and Escape, while preserving it when focus moves away", () => {
  const runtime = testRuntime();
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 580;
  canvas.style.cssText = "width:900px;height:580px";
  document.body.append(canvas);
  const labels: string[] = [];
  const draw = canvas.getContext("2d")!.fillText;
  vi.spyOn(canvas.getContext("2d")!, "fillText").mockImplementation(function (
    this: CanvasRenderingContext2D,
    ...args: Parameters<CanvasRenderingContext2D["fillText"]>
  ) {
    labels.push(args[0]);
    draw.apply(this, args);
  });
  const app = chordMount(canvas);
  cleanups.push(() => {
    app.dispose();
    runtime.dispose();
  });
  runtime.flush();
  click(canvas, 400, 255);
  runtime.flush();
  expect(labels).toContain("SELECTED ROUTE");
  labels.length = 0;
  click(canvas, 20, 500);
  runtime.flush();
  expect(labels).toContain("WEEKDAY TOTAL");
  click(canvas, 400, 255);
  runtime.flush();
  labels.length = 0;
  const other = document.createElement("button");
  document.body.append(other);
  other.focus();
  runtime.flush();
  expect(labels).not.toContain("WEEKDAY TOTAL");
  click(canvas, 400, 255);
  runtime.flush();
  labels.length = 0;
  canvas.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      bubbles: true,
      cancelable: true,
    }),
  );
  runtime.flush();
  expect(labels).toContain("WEEKDAY TOTAL");
});

it("keeps the actual Sankey label readable across a highlighted natural-gas ribbon", async () => {
  const runtime = testRuntime();
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 580;
  canvas.style.cssText = "width:900px;height:580px";
  document.body.append(canvas);
  const labels: string[] = [];
  let labelPoint: { x: number; y: number } | undefined;
  const context = canvas.getContext("2d")!;
  const rootDraw = context.fillText;
  vi.spyOn(context, "fillText").mockImplementation(function (
    this: CanvasRenderingContext2D,
    ...args: Parameters<CanvasRenderingContext2D["fillText"]>
  ) {
    labels.push(args[0]);
    rootDraw.apply(this, args);
  });
  vi.spyOn(
    OffscreenCanvasRenderingContext2D.prototype,
    "fillText",
  ).mockImplementation(function (
    this: OffscreenCanvasRenderingContext2D,
    ...args: Parameters<OffscreenCanvasRenderingContext2D["fillText"]>
  ) {
    if (args[0] === "Natural gas")
      labelPoint = this.getTransform().transformPoint({
        x: args[1],
        y: args[2],
      });
    offscreenDraw.apply(this, args);
  });
  const app = sankeyMount(canvas);
  cleanups.push(() => {
    app.dispose();
    runtime.dispose();
  });
  runtime.flush();
  expect(labelPoint).toBeDefined();
  const { x, y } = labelPoint!;
  const whites = () => {
    const data = context.getImageData(
      Math.floor(x),
      Math.floor(y),
      85,
      36,
    ).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4)
      if (data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245) count++;
    return count;
  };
  const before = whites();
  click(canvas, x + 35, y + 14);
  runtime.flush();
  runtime.flush();
  expect(labels.some((text) => text.startsWith("Natural gas →"))).toBe(true);
  if (import.meta.env.VITE_PIBBL_VIZ_CAPTURE === "1") {
    await page.viewport(920, 620);
    await page.screenshot({
      element: canvas,
      path: "__screenshots__/sankey-backdrop-contrast.png",
    });
  }
  expect(whites()).toBeGreaterThan(before + 15);
});

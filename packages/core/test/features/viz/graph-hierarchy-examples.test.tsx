import { userEvent } from "vitest/browser";
import { afterEach, expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";
import mountTree from "../../../../scenarios/src/learning/composition/viz-graph-tree.example.js";
import mountTreemap from "../../../../scenarios/src/learning/composition/viz-graph-treemap.example.js";
import mountIcicle from "../../../../scenarios/src/learning/composition/viz-graph-icicle.example.js";
import mountNeighborhood from "../../../../scenarios/src/learning/composition/viz-graph-neighborhood.example.js";
import mountTreeReconstruction from "../../../../scenarios/src/learning/composition/viz-graph-tree-reconstruction.example.js";
import mountTreemapReconstruction from "../../../../scenarios/src/learning/composition/viz-graph-treemap-reconstruction.example.js";
import mountIcicleReconstruction from "../../../../scenarios/src/learning/composition/viz-graph-icicle-reconstruction.example.js";
import mountNeighborhoodReconstruction from "../../../../scenarios/src/learning/composition/viz-graph-neighborhood-reconstruction.example.js";
import type { PibblController } from "@pibbl/core";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function canvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 570;
  canvas.style.cssText = "width:1000px;height:570px";
  document.body.append(canvas);
  return canvas;
}

function labels() {
  const painted: Array<{ text: string; x: number; y: number }> = [];
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(
    function (this: CanvasRenderingContext2D, text, x, y) {
      const transform = this.getTransform();
      painted.push({
        text: String(text),
        x: transform.e + Number(x),
        y: transform.f + Number(y),
      });
    },
  );
  return painted;
}

async function click(canvas: HTMLCanvasElement, x: number, y: number) {
  await userEvent.click(canvas, { position: { x, y } });
}

it.each([
  ["tidy tree", mountTree, "Product organization", "Product Design"],
  ["treemap", mountTreemap, "Storage footprint", "Projects"],
  ["icicle", mountIcicle, "Storage by ancestry", "Applications"],
  ["neighborhood", mountNeighborhood, "Incident neighborhood", "payments"],
] as const)(
  "mounts the exact %s learning example with visible labels and a clickable mark",
  async (_name, mount, title, mark) => {
    const runtime = testRuntime();
    const painted = labels();
    const surface = canvas();
    const controller = mount(surface);
    try {
      runtime.flush();
      expect(painted.some((item) => item.text === title)).toBe(true);
      const target = painted.find((item) => item.text.startsWith(mark));
      expect(target, `visible ${mark} label`).toBeDefined();
      const before = surface
        .getContext("2d")!
        .getImageData(0, 0, surface.width, surface.height)
        .data.slice();
      await click(
        surface,
        target!.x + 2,
        target!.y - (title === "Incident neighborhood" ? 30 : 8),
      );
      runtime.flush();
      expect(
        surface
          .getContext("2d")!
          .getImageData(0, 0, surface.width, surface.height).data,
      ).not.toEqual(before);
    } finally {
      controller.dispose();
      runtime.dispose();
    }
  },
);

it.each([
  [
    "tidy tree",
    mountTreeReconstruction,
    "Using TidyTree",
    "Using public marks",
  ],
  [
    "treemap",
    mountTreemapReconstruction,
    "Using Treemap",
    "Using public marks",
  ],
  ["icicle", mountIcicleReconstruction, "Using Icicle", "Using public marks"],
  [
    "neighborhood",
    mountNeighborhoodReconstruction,
    "Using RadialNeighborhood",
    "Using public marks",
  ],
] as const)(
  "toggles the exact %s public reconstruction",
  async (_name, mount, componentText, publicMarksText) => {
    const runtime = testRuntime();
    const painted = labels();
    const surface = canvas();
    const controller: PibblController = mount(surface);
    try {
      runtime.flush();
      expect(painted.some((item) => item.text === componentText)).toBe(true);
      await click(surface, 850, 44);
      runtime.flush();
      expect(painted.some((item) => item.text === publicMarksText)).toBe(true);
    } finally {
      controller.dispose();
      runtime.dispose();
    }
  },
);

it("restores the checkout overview after recentering a selected leaf", async () => {
  const runtime = testRuntime();
  const painted = labels();
  const surface = canvas();
  const controller = mountNeighborhood(surface);
  try {
    runtime.flush();
    const fraud = painted.find((item) => item.text === "fraud");
    expect(fraud, "fraud card is painted").toBeDefined();
    await click(surface, fraud!.x, fraud!.y);
    runtime.flush();
    painted.length = 0;
    await click(surface, 680, 103);
    runtime.flush();
    expect(painted.some((item) => item.text === "Focal: fraud")).toBe(true);
    expect(painted.some((item) => item.text === "fraud")).toBe(true);
    expect(painted.some((item) => item.text === "checkout-api")).toBe(false);
    painted.length = 0;
    await click(surface, 875, 103);
    runtime.flush();
    expect(painted.some((item) => item.text === "Focal: checkout")).toBe(true);
    expect(painted.some((item) => item.text === "checkout-api")).toBe(true);
    expect(painted.some((item) => item.text === "payments")).toBe(true);
    expect(painted.some((item) => item.text === "ledger")).toBe(true);
  } finally {
    controller.dispose();
    runtime.dispose();
  }
});

it.each([
  ["tidy tree", mountTree, "Product UI", 10, 560],
  ["treemap", mountTreemap, "Projects", 10, 560],
  ["icicle", mountIcicle, "Applications", 10, 560],
  ["neighborhood", mountNeighborhood, "fraud", 10, 560],
] as const)(
  "clears the %s selection when the empty canvas is clicked",
  async (_name, mount, mark, blankX, blankY) => {
    const runtime = testRuntime();
    const painted = labels();
    const surface = canvas();
    const controller = mount(surface);
    try {
      runtime.flush();
      const context = surface.getContext("2d")!;
      const initial = context
        .getImageData(0, 0, surface.width, surface.height)
        .data.slice();
      const target = painted.find((item) => item.text === mark);
      expect(target, `${mark} is painted`).toBeDefined();
      await click(surface, target!.x, target!.y);
      runtime.flush();
      expect(
        context.getImageData(0, 0, surface.width, surface.height).data,
      ).not.toEqual(initial);
      await click(surface, blankX, blankY);
      runtime.flush();
      expect(
        context.getImageData(0, 0, surface.width, surface.height).data,
      ).toEqual(initial);
    } finally {
      controller.dispose();
      runtime.dispose();
    }
  },
);

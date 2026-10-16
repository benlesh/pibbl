import { expect, it, vi } from "vitest";
import dependency from "../../../../scenarios/src/learning/composition/viz-graph-dependency.example.js";
import force from "../../../../scenarios/src/learning/composition/viz-graph-force.example.js";
import matrix from "../../../../scenarios/src/learning/composition/viz-graph-matrix.example.js";
import sankey from "../../../../scenarios/src/learning/composition/viz-graph-sankey.example.js";
import bipartite from "../../../../scenarios/src/learning/composition/viz-graph-bipartite.example.js";
import { testRuntime } from "./support/runtime.js";

function click(canvas: HTMLCanvasElement, x: number, y: number) {
  const rect = canvas.getBoundingClientRect();
  for (const type of ["mousedown", "mouseup", "click"])
    canvas.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        clientX: rect.left + x,
        clientY: rect.top + y,
      }),
    );
}

it.each([
  {
    name: "dependency",
    mount: dependency,
    width: 1100,
    height: 620,
    point: [100, 280],
    selected: "Source release",
    cleared: "Choose a stage",
    plotBlank: [50, 100],
  },
  {
    name: "force",
    mount: force,
    width: 1100,
    height: 620,
    point: null,
    selected: "Checkout · 5 connected teams",
    cleared: "Select a team",
    plotBlank: [50, 150],
  },
  {
    name: "matrix",
    mount: matrix,
    width: 900,
    height: 580,
    point: [440, 205],
    selected: "Research → Product · 42 requests · reverse: 14",
    cleared: "Select a colored cell to inspect a directed handoff.",
  },
  {
    name: "sankey",
    mount: sankey,
    width: 900,
    height: 580,
    point: [300, 170],
    selected: "Solar generation → Electricity · 300 MWh",
    cleared: "Select a ribbon to inspect generation, conversion, or delivery.",
  },
  {
    name: "bipartite",
    mount: bipartite,
    width: 900,
    height: 580,
    point: [160, 200],
    selected: "River Watch · 2 study tracks in the current cohort",
    cleared:
      "Select an organization, study, or connecting line to inspect the network.",
  },
])(
  "clears $name selection on empty space without swallowing subsequent mark clicks",
  (config) => {
    const runtime = testRuntime();
    const canvas = document.createElement("canvas");
    canvas.width = config.width;
    canvas.height = config.height;
    canvas.style.cssText = `width:${config.width}px;height:${config.height}px`;
    document.body.append(canvas);
    const painted: { text: string; x: number; y: number }[] = [];
    const context = canvas.getContext("2d")!;
    const draw = context.fillText;
    vi.spyOn(context, "fillText").mockImplementation(function (
      this: CanvasRenderingContext2D,
      ...args: Parameters<CanvasRenderingContext2D["fillText"]>
    ) {
      const point = this.getTransform().transformPoint({
        x: args[1],
        y: args[2],
      });
      painted.push({ text: args[0], x: point.x, y: point.y });
      draw.apply(this, args);
    });
    const controller = config.mount(canvas);
    try {
      runtime.flush();
      const team = painted.find((item) => item.text === "Checkout");
      const point = config.point ?? [team!.x, team!.y - 36];
      click(canvas, point[0], point[1]);
      runtime.flush();
      expect(painted.some((item) => item.text === config.selected)).toBe(true);
      painted.length = 0;
      click(canvas, 16, config.height - 16);
      runtime.flush();
      expect(painted.some((item) => item.text === config.cleared)).toBe(true);
      painted.length = 0;
      click(canvas, point[0], point[1]);
      runtime.flush();
      expect(painted.some((item) => item.text === config.selected)).toBe(true);
      if (config.plotBlank) {
        painted.length = 0;
        click(canvas, config.plotBlank[0], config.plotBlank[1]);
        runtime.flush();
        expect(painted.some((item) => item.text === config.cleared)).toBe(true);
      }
    } finally {
      controller.dispose();
      runtime.dispose();
    }
  },
);

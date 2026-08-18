import {
  getLearningExampleRoute,
  learningExampleCatalog,
  loadLearningExample,
  validateLearningExampleCatalog,
} from "@crc/scenarios";
import { afterEach, describe, expect, it } from "vitest";
import {
  learningSourcePaths,
  loadLearningSource,
} from "../../../playground/src/learning-sources";

const mountedControllers: Array<{ dispose: () => void }> = [];

afterEach(() => {
  for (const controller of mountedControllers.splice(0)) controller.dispose();
  document.body.replaceChildren();
});

describe("learning example catalog", () => {
  it("contains 28 unique, ordered, source-backed routes", () => {
    expect(validateLearningExampleCatalog(learningExampleCatalog)).toBe(
      learningExampleCatalog,
    );
    expect(learningExampleCatalog).toHaveLength(28);
    expect(
      learningExampleCatalog.map((entry) => entry.source.path).sort(),
    ).toEqual(learningSourcePaths);
    expect(
      new Set(learningExampleCatalog.map(getLearningExampleRoute)).size,
    ).toBe(learningExampleCatalog.length);
    expect(learningExampleCatalog.map((entry) => entry.order)).toEqual(
      [...learningExampleCatalog.map((entry) => entry.order)].sort(
        (left, right) => left - right,
      ),
    );
  });

  it("contains exactly the four canonical layout lessons", async () => {
    const layouts = learningExampleCatalog.filter(
      (entry) => entry.section === "layout",
    );
    expect(layouts.map((entry) => entry.slug)).toEqual([
      "absolute-and-overlay",
      "flow",
      "flex",
      "grid",
    ]);
    expect(layouts.map(getLearningExampleRoute)).toEqual([
      "#/examples/layout/absolute-and-overlay",
      "#/examples/layout/flow",
      "#/examples/layout/flex",
      "#/examples/layout/grid",
    ]);
    for (const entry of layouts) {
      expect(entry.objectives).toHaveLength(2);
      const source = await loadLearningSource(entry);
      expect(source.match(/from ["'][^"']+["']/g)).toEqual([
        expect.stringMatching(/from ["']@crc\/core["']/),
      ]);
      expect(source).not.toMatch(/test|fixture|diagnostic/i);
    }
  });

  it("covers every drawing/composition export and supported mouse event", () => {
    const drawingAndComposition = learningExampleCatalog
      .filter(
        (entry) =>
          entry.section === "drawing" || entry.section === "composition",
      )
      .flatMap((entry) => entry.api);
    expect(new Set(drawingAndComposition)).toEqual(
      new Set([
        "rect",
        "path",
        "svgPath",
        "line",
        "horizontalLine",
        "verticalLine",
        "text",
        "img",
        "g",
        "clip",
        "layer",
      ]),
    );

    const mouseEvents = learningExampleCatalog
      .filter((entry) => entry.section === "mouse-events")
      .flatMap((entry) => entry.api);
    expect(new Set(mouseEvents)).toEqual(
      new Set([
        "onClick",
        "onDblClick",
        "onContextMenu",
        "onMouseMove",
        "onMouseOver",
        "onMouseOut",
        "onMouseDown",
        "onMouseUp",
      ]),
    );
  });

  it.each(learningExampleCatalog)(
    "loads, mounts, paints, and disposes $slug from its canonical source",
    async (entry) => {
      const source = await loadLearningSource(entry);
      expect(source).toContain(
        "export default function mount(canvas: HTMLCanvasElement): CRCController",
      );

      const module = await loadLearningExample(entry);
      const canvas = document.createElement("canvas");
      canvas.width = entry.canvas.width;
      canvas.height = entry.canvas.height;
      document.body.appendChild(canvas);
      const controller = module.default(canvas);
      mountedControllers.push(controller);

      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      const pixels = canvas
        .getContext("2d")
        ?.getImageData(0, 0, canvas.width, canvas.height).data;
      expect(pixels).toBeDefined();
      expect(pixels?.some((channel) => channel !== 0)).toBe(true);

      controller.dispose();
      controller.dispose();
      mountedControllers.splice(mountedControllers.indexOf(controller), 1);
    },
    15_000,
  );
});

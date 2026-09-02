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
import { clickLogicalPoint, pressKey } from "./support/user-input";

const mountedControllers: Array<{ dispose: () => void }> = [];

interface TextPaint {
  readonly text: string;
  readonly x: number;
  readonly y: number;
}

async function renderLearningExample(slug: string): Promise<{
  readonly canvas: HTMLCanvasElement;
  readonly controller: { dispose: () => void };
  readonly textPaints: readonly TextPaint[];
}> {
  const entry = learningExampleCatalog.find(
    (candidate) => candidate.slug === slug,
  );
  if (!entry) throw new Error(`Missing learning example ${slug}.`);

  const canvas = document.createElement("canvas");
  canvas.width = entry.canvas.width;
  canvas.height = entry.canvas.height;
  document.body.appendChild(canvas);

  const context = canvas.getContext("2d");
  if (!context) throw new Error(`Learning example ${slug} has no 2D context.`);

  const textPaints: TextPaint[] = [];
  const fillText = context.fillText;
  context.fillText = function (...args) {
    const [text, x, y] = args;
    const point = new DOMPoint(x, y).matrixTransform(this.getTransform());
    textPaints.push({ text, x: point.x, y: point.y });
    fillText.apply(this, args);
  };

  const module = await loadLearningExample(entry);
  const controller = module.default(canvas);
  mountedControllers.push(controller);
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

  return { canvas, controller, textPaints };
}

function pixelAt(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
): readonly number[] {
  return Array.from(canvas.getContext("2d")!.getImageData(x, y, 1, 1).data);
}

async function nextPaint(): Promise<void> {
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

afterEach(() => {
  for (const controller of mountedControllers.splice(0)) controller.dispose();
  document.body.replaceChildren();
});

describe("learning example catalog", () => {
  it("rejects learning sources that are not TSX", () => {
    const [first, ...rest] = learningExampleCatalog;
    if (!first) throw new Error("The learning catalog must not be empty.");
    const invalidCatalog = [
      {
        ...first,
        source: { path: first.source.path.replace(/\.tsx$/u, ".ts") },
      },
      ...rest,
    ];

    expect(() => validateLearningExampleCatalog(invalidCatalog)).toThrow(
      /\.example\.tsx/u,
    );
  });

  it("contains 42 unique, ordered, source-backed routes", () => {
    expect(validateLearningExampleCatalog(learningExampleCatalog)).toBe(
      learningExampleCatalog,
    );
    expect(learningExampleCatalog).toHaveLength(42);
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

  it("teaches one complete createElement scene immediately after getting started", async () => {
    const authoringEntries =
      learningExampleCatalog as readonly ((typeof learningExampleCatalog)[number] & {
        readonly authoring?: "jsx" | "createElement";
      })[];
    const nonJsxEntries = authoringEntries.filter(
      (entry) => entry.authoring === "createElement",
    );

    expect(nonJsxEntries).toHaveLength(1);
    const [nonJsx] = nonJsxEntries;
    expect(nonJsx).toBeDefined();
    expect(nonJsx?.api).toEqual(
      expect.arrayContaining(["createElement", "non-jsx"]),
    );
    expect(
      learningExampleCatalog.map((entry) => entry.slug).slice(0, 2),
    ).toEqual(["getting-started", nonJsx?.slug]);
    expect(
      authoringEntries
        .filter((entry) => entry !== nonJsx)
        .every((entry) => entry.authoring === "jsx"),
    ).toBe(true);

    const source = await loadLearningSource(nonJsx!);
    expect(source).toContain("createElement(");
    expect(source).toMatch(/crc\(canvas,\s*createElement\(/u);
    expect(source).not.toMatch(/<[A-Z][A-Za-z0-9]*(?:\s|\/>|>)/u);
    expect(source).not.toMatch(/<>|<\/>/u);
  });

  it("uses canonical component authoring throughout every learning source", async () => {
    const forbiddenPublicNames = [
      "defineComp",
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
      "absolute",
      "overlay",
      "flow",
      "flex",
      "grid",
      "withFocusManagement",
      "withKeyboardNavigation",
    ];

    for (const entry of learningExampleCatalog) {
      expect(entry.source.path, entry.slug).toMatch(/\.example\.tsx$/u);
      const source = await loadLearningSource(entry);
      expect(source, entry.slug).toContain('from "@crc/core"');
      expect(source, entry.slug).not.toMatch(
        /\b(?:defineComp|withFocusManagement|withKeyboardNavigation)\b/u,
      );
      expect(source, entry.slug).not.toMatch(/\btext\s*:/u);
      expect(source, entry.slug).not.toMatch(/\brender\s*:/u);

      for (const name of forbiddenPublicNames) {
        const directCall = new RegExp(`(?<![.\\w])${name}\\s*\\(`, "u");
        const importedName = new RegExp(`\\b${name}\\b(?=[\\s,}])`, "u");
        const coreImport =
          source.match(/import[\s\S]*?from ["']@crc\/core["'];/u)?.[0] ?? "";
        expect(coreImport, `${entry.slug} imports ${name}`).not.toMatch(
          importedName,
        );
        expect(source, `${entry.slug} calls ${name}`).not.toMatch(directCall);
      }

      if ((entry as { authoring?: string }).authoring === "jsx") {
        expect(source, entry.slug).toMatch(/<[A-Z][A-Za-z0-9]*(?:\s|\/>|>)/u);
      }
    }
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

  it.each([
    { slug: "rectangle", label: "RECTANGLE STUDY", x: 536, y: 330 },
    {
      slug: "absolute-and-overlay",
      label: "CLICK THE OVERLAY",
      x: 360,
      y: 210,
    },
  ])(
    "centers the $slug label on its intended box",
    async ({ slug, label, x, y }) => {
      const { textPaints } = await renderLearningExample(slug);

      expect(textPaints.find((paint) => paint.text === label)).toEqual({
        text: label,
        x,
        y,
      });
    },
  );

  it.each([
    {
      slug: "flex",
      clearPoint: [360, 80] as const,
      contentPoint: [620, 200] as const,
      contentColor: [255, 107, 87, 255],
    },
    {
      slug: "grid",
      clearPoint: [360, 76] as const,
      contentPoint: [620, 220] as const,
      contentColor: [116, 211, 174, 255],
    },
  ])(
    "keeps the $slug headline above horizontally centered content",
    async ({ slug, clearPoint, contentPoint, contentColor }) => {
      const { canvas } = await renderLearningExample(slug);

      expect(pixelAt(canvas, clearPoint[0], clearPoint[1])).toEqual([
        247, 240, 223, 255,
      ]);
      expect(pixelAt(canvas, contentPoint[0], contentPoint[1])).toEqual(
        contentColor,
      );
    },
  );

  it("covers every drawing/composition export and supported mouse event", () => {
    const drawingAndComposition = learningExampleCatalog
      .filter(
        (entry) =>
          entry.section === "drawing" || entry.section === "composition",
      )
      .flatMap((entry) => entry.api);
    expect(new Set(drawingAndComposition)).toEqual(
      new Set([
        "Rectangle",
        "Path",
        "SvgPath",
        "Line",
        "HorizontalLine",
        "VerticalLine",
        "Text",
        "Image",
        "Group",
        "Clip",
        "Layer",
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

  it("keeps arrow focus at a nested-grid edge and renders its active ownership", async () => {
    const { canvas, textPaints } = await renderLearningExample(
      "nested-directional-navigation",
    );

    await clickLogicalPoint(canvas, { x: 296, y: 229 });
    await pressKey("ArrowRight");
    await pressKey("ArrowRight");
    await nextPaint();

    const latestPaints = textPaints.slice(-12).map((paint) => paint.text);
    expect(latestPaints).toContain("FOCUSED: INNER 2");
    expect(latestPaints).toContain("ACTIVE BOUNDARY: INNER");
    expect(latestPaints).toContain("LAST INPUT: ArrowRight");
  });

  it.each(learningExampleCatalog)(
    "loads, mounts, paints, and disposes $slug from its canonical source",
    async (entry) => {
      const source = await loadLearningSource(entry);
      expect(source).toContain(
        "export default function mount(canvas: HTMLCanvasElement): CRCController",
      );

      const { canvas, controller } = await renderLearningExample(entry.slug);
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

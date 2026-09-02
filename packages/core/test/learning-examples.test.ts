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
import {
  learningSourceContainsJsx,
  validateLearningSourceText,
} from "../../../tooling/learning-source-contract";
import { clickLogicalPoint, pressKey } from "./support/user-input";

const mountedControllers: Array<{ dispose: () => void }> = [];

function expectValidNonJsxSource(source: string): void {
  expect(() =>
    validateLearningSourceText(source, {
      authoring: "createElement",
      label: "fixture",
    }),
  ).not.toThrow();
}

function expectInvalidNonJsxSource(source: string): void {
  expect(() =>
    validateLearningSourceText(source, {
      authoring: "createElement",
      label: "fixture",
    }),
  ).toThrow();
}

function expectInvalidLearningSource(
  source: string,
  authoring: "jsx" | "createElement",
): void {
  expect(() =>
    validateLearningSourceText(source, {
      authoring,
      label: "fixture",
    }),
  ).toThrow();
}

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
  it.each([
    ["fragment", "<>fragment</>"],
    ["member expression", "<CRC.Rectangle />"],
    ["namespaced name", "<crc:Rectangle />"],
  ])("detects JSX %s syntax structurally", (_name, source) => {
    expect(learningSourceContainsJsx(source)).toBe(true);
  });

  it("does not confuse legal TypeScript with JSX", () => {
    const source = `
      import { crc, createElement, Group, type CRCController } from "@crc/core";
      interface Widget { value: number }
      function identity<T>(value: T): T { return value; }
      export default function mount(canvas: HTMLCanvasElement): CRCController {
        const widget = identity<Widget>({ value: 1 });
        const asserted = widget as Widget;
        const compared = asserted.value < 2 && asserted.value > 0;
        return crc(canvas, createElement(Group, { key: compared ? "yes" : "no" }));
      }
    `;

    expect(learningSourceContainsJsx(source)).toBe(false);
    expectValidNonJsxSource(source);
  });

  it.each([
    [
      "namespace legacy member",
      `
        import * as CRC from "@crc/core";
        type CRCController = CRC.CRCController;
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return CRC.crc(canvas, CRC.createElement(CRC.rect, { width: 10, height: 10 }));
        }
      `,
    ],
    [
      "default import",
      `
        import CRC, { createElement, Group, type CRCController } from "@crc/core";
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return CRC.crc(canvas, createElement(Group, null));
        }
      `,
    ],
    [
      "side-effect import",
      `
        import "./helper";
        import { crc, createElement, Group, type CRCController } from "@crc/core";
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return crc(canvas, createElement(Group, null));
        }
      `,
    ],
    [
      "named helper import",
      `
        import { helper } from "./helper";
        import { crc, createElement, Group, type CRCController } from "@crc/core";
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          helper();
          return crc(canvas, createElement(Group, null));
        }
      `,
    ],
    [
      "dynamic import",
      `
        import { crc, createElement, Group, type CRCController } from "@crc/core";
        void import("./helper");
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return crc(canvas, createElement(Group, null));
        }
      `,
    ],
    [
      "aliased legacy import",
      `
        import { crc, createElement, rect as Draw, type CRCController } from "@crc/core";
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return crc(canvas, createElement(Draw, { width: 10, height: 10 }));
        }
      `,
    ],
    [
      "aliased legacy focus import",
      `
        import { crc, createElement, Group, withFocusManagement as FocusPolicy, type CRCController } from "@crc/core";
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return crc(canvas, FocusPolicy(createElement(Group, null)));
        }
      `,
    ],
    [
      "legacy local alias",
      `
        import { crc, createElement, Rectangle as rect, type CRCController } from "@crc/core";
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return crc(canvas, createElement(rect, { width: 10, height: 10 }));
        }
      `,
    ],
    [
      "type-only core import",
      `
        import type { CRCController } from "@crc/core";
        function createElement(): never { throw new Error("unused"); }
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          void canvas;
          return createElement();
        }
      `,
    ],
    [
      "source-marker scaffolding",
      `
        import { crc, createElement, Group, type CRCController } from "@crc/core";
        const SOURCE_ID = "fixture";
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return crc(canvas, createElement(Group, { key: SOURCE_ID }));
        }
      `,
    ],
    [
      "test-call scaffolding",
      `
        import { crc, createElement, Group, type CRCController } from "@crc/core";
        function test(): void {}
        test();
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return crc(canvas, createElement(Group, null));
        }
      `,
    ],
  ])("rejects the %s module shape", (_name, source) => {
    expectInvalidNonJsxSource(source);
  });

  it("ignores legacy-looking words outside resolved CRC authoring", () => {
    const source = `
      import { crc, createElement, Group, type CRCController } from "@crc/core";
      interface Notes { text: string; render: string }
      export default function mount(canvas: HTMLCanvasElement): CRCController {
        const notes: Notes = { text: "defineComp", render: "withFocusManagement" };
        return crc(canvas, createElement(Group, { key: notes.text }));
      }
    `;

    expectValidNonJsxSource(source);
  });

  it.each([
    [
      "aliased Text style.text",
      "jsx" as const,
      `
        import { crc, Text as Label, type CRCController } from "@crc/core";
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return crc(canvas, <Label style={{ text: "legacy" }} />);
        }
      `,
    ],
    [
      "aliased Layer render prop",
      "jsx" as const,
      `
        import { crc, Layer as Surface, Rectangle, type CRCController } from "@crc/core";
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return crc(canvas, <Surface render={<Rectangle style={{ width: 10, height: 10 }} />} />);
        }
      `,
    ],
    [
      "createElement Text style.text",
      "createElement" as const,
      `
        import { crc, createElement, Text as Label, type CRCController } from "@crc/core";
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return crc(canvas, createElement(Label, { style: { text: "legacy" } }));
        }
      `,
    ],
    [
      "createElement Layer render prop",
      "createElement" as const,
      `
        import { crc, createElement, Group, Layer as Surface, type CRCController } from "@crc/core";
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return crc(canvas, createElement(Surface, { render: createElement(Group, null) }));
        }
      `,
    ],
  ])("rejects %s through resolved component aliases", (_name, authoring, source) => {
    expectInvalidLearningSource(source, authoring);
  });

  it.each([
    [
      "a local component alias",
      "jsx" as const,
      `
        import { crc, Text, type CRCController } from "@crc/core";
        const Label = Text;
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return crc(canvas, <Label style={{ text: "legacy" }}>Legacy</Label>);
        }
      `,
    ],
    [
      "a destructured component alias",
      "jsx" as const,
      `
        import { crc, Layer, Rectangle, type CRCController } from "@crc/core";
        const { Layer: Surface } = { Layer };
        const props = { render: <Rectangle style={{ width: 10, height: 10 }} /> };
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return crc(canvas, <Surface {...props} />);
        }
      `,
    ],
    [
      "a shadowed createElement binding",
      "createElement" as const,
      `
        import { crc, createElement, type CRCController } from "@crc/core";
        function Scene(createElement: () => never): never {
          return createElement();
        }
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return crc(canvas, Scene(() => { throw new Error("fixture"); }));
        }
      `,
    ],
    [
      "a reassigned createElement binding",
      "createElement" as const,
      `
        import { crc, createElement, Group, type CRCController } from "@crc/core";
        function localCreateElement(): never { throw new Error("fixture"); }
        createElement = localCreateElement;
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return crc(canvas, createElement(Group, null));
        }
      `,
    ],
  ])("rejects %s structurally", (_name, authoring, source) => {
    expectInvalidLearningSource(source, authoring);
  });

  it.each([
    [
      "a JSX style variable",
      "jsx" as const,
      `
        import { crc, Text, type CRCController } from "@crc/core";
        const style = { text: "legacy" };
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return crc(canvas, <Text style={style}>Visible</Text>);
        }
      `,
    ],
    [
      "a JSX props spread",
      "jsx" as const,
      `
        import { crc, Text, type CRCController } from "@crc/core";
        const props = { style: { text: "legacy" } };
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return crc(canvas, <Text {...props}>Visible</Text>);
        }
      `,
    ],
    [
      "a JSX style object spread",
      "jsx" as const,
      `
        import { crc, Rectangle, type CRCController } from "@crc/core";
        const box = { width: 10, height: 10 };
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return crc(canvas, <Rectangle style={{ ...box }} />);
        }
      `,
    ],
    [
      "an indirect createElement style",
      "createElement" as const,
      `
        import { crc, createElement, Text, type CRCController } from "@crc/core";
        const style = { text: "legacy" };
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return crc(canvas, createElement(Text, { style }, "Visible"));
        }
      `,
    ],
    [
      "indirect createElement props",
      "createElement" as const,
      `
        import { crc, createElement, Layer, Group, type CRCController } from "@crc/core";
        const props = { render: createElement(Group, null) };
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return crc(canvas, createElement(Layer, props));
        }
      `,
    ],
    [
      "a createElement props object spread",
      "createElement" as const,
      `
        import { crc, createElement, Text, type CRCController } from "@crc/core";
        const props = { style: { text: "legacy" } };
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return crc(canvas, createElement(Text, { ...props }, "Visible"));
        }
      `,
    ],
  ])("rejects %s so props remain directly inspectable", (_name, authoring, source) => {
    expectInvalidLearningSource(source, authoring);
  });

  it.each([
    [
      "a source-backed named re-export",
      `export { helper } from "./helper";`,
    ],
    ["a star re-export", `export * from "./helper";`],
    ["a local named export", `export const helper = 1;`],
    ["an import.meta expression", `const helperUrl = import.meta.url;`],
    [
      "a TypeScript import-equals declaration",
      `import helper = require("./helper");`,
    ],
  ])("rejects %s", (_name, extraModuleSyntax) => {
    expectInvalidNonJsxSource(`
      import { crc, createElement, Group, type CRCController } from "@crc/core";
      ${extraModuleSyntax}
      export default function mount(canvas: HTMLCanvasElement): CRCController {
        return crc(canvas, createElement(Group, null));
      }
    `);
  });

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
    expect(() =>
      validateLearningSourceText(source, {
        authoring: "createElement",
        label: nonJsx!.slug,
      }),
    ).not.toThrow();
    expect(source).toContain("createElement(");
    expect(source).toMatch(/crc\(canvas,\s*createElement\(/u);
  });

  it.each([
    ["createElement on JSX", "getting-started", "createElement"],
    ["non-jsx on JSX", "getting-started", "non-jsx"],
    ["duplicate reserved tag", "create-element-authoring", "createElement"],
    ["duplicate ordinary tag", "rectangle", "Rectangle"],
  ])("rejects %s", (_name, slug, tag) => {
    const invalidCatalog = learningExampleCatalog.map((entry) =>
      entry.slug === slug ? { ...entry, api: [...entry.api, tag] } : entry,
    );

    expect(() => validateLearningExampleCatalog(invalidCatalog)).toThrow();
  });

  it.each(["createElement", "non-jsx"])(
    "requires the non-JSX lesson to keep its %s tag",
    (tag) => {
      const invalidCatalog = learningExampleCatalog.map((entry) =>
        entry.slug === "create-element-authoring"
          ? { ...entry, api: entry.api.filter((value) => value !== tag) }
          : entry,
      );

      expect(() => validateLearningExampleCatalog(invalidCatalog)).toThrow();
    },
  );

  it("uses canonical component authoring throughout every learning source", async () => {
    for (const entry of learningExampleCatalog) {
      expect(entry.source.path, entry.slug).toMatch(/\.example\.tsx$/u);
      const source = await loadLearningSource(entry);
      expect(() =>
        validateLearningSourceText(source, {
          authoring: entry.authoring,
          label: entry.slug,
        }),
      ).not.toThrow();
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

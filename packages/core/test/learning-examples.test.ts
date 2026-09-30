import {
  getLearningExampleLegacyRoutes,
  getLearningExampleRoute,
  getLearningExamplesByBrowseGroup,
  learningExampleCatalog,
  loadLearningExample,
  validateLearningExampleCatalog,
} from "@crc/scenarios";
import type { LearningBrowseGroup } from "@crc/scenarios";
import { afterEach, describe, expect, it } from "vitest";
import {
  learningSourcePaths,
  loadLearningSource,
} from "../../../playground/src/learning-sources";
import {
  learningSourceContainsJsx,
  validateLearningSourceText,
} from "../../../tooling/learning-source-contract";
import {
  clickLogicalPoint,
  pointerDownLogicalPoint,
  pointerMoveLogicalPoint,
  pointerUpLogicalPoint,
  pressKey,
} from "./support/user-input";
import { backingPointForLogical } from "./support/mouse-input";

const mountedControllers: Array<{ dispose: () => void }> = [];
const removedDefinitionWrapper = ["define", "Comp"].join("");
const removedFocusWrapper = ["with", "Focus", "Management"].join("");

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

function expectValidLearningSource(
  source: string,
  authoring: "jsx" | "createElement",
): void {
  expect(() =>
    validateLearningSourceText(source, {
      authoring,
      label: "fixture",
    }),
  ).not.toThrow();
}

function expectUninspectableNonJsxSource(source: string): void {
  expect(() =>
    validateLearningSourceText(source, {
      authoring: "createElement",
      label: "fixture",
    }),
  ).toThrow(/inline object props/u);
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

function solidBlueBounds(canvas: HTMLCanvasElement): {
  readonly centerX: number;
  readonly centerY: number;
} {
  const pixels = canvas
    .getContext("2d")!
    .getImageData(0, 0, canvas.width, canvas.height).data;
  let left = canvas.width;
  let right = -1;
  let top = canvas.height;
  let bottom = -1;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const offset = (y * canvas.width + x) * 4;
      if (
        pixels[offset] === 37 &&
        pixels[offset + 1] === 99 &&
        pixels[offset + 2] === 235 &&
        pixels[offset + 3] === 255
      ) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  if (right < left || bottom < top) {
    throw new Error("Expected the physics lesson's solid blue ball to paint.");
  }
  return {
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
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
  const threeLayerSourcePath =
    "packages/scenarios/src/learning/three/three-layer.example.tsx";
  const threeInstancingSourcePath =
    "packages/scenarios/src/learning/three/three-instancing.example.tsx";

  it("permits Three imports only for the two attributed Three lessons", () => {
    const baseSource = `
      import { crc, type CRCController } from "@crc/core";
      import { defineThreeLayer } from "@crc/three";
      import { PerspectiveCamera, Scene } from "three";
      const Layer = defineThreeLayer({
        create() {
          return { scene: new Scene(), camera: new PerspectiveCamera() };
        },
      });
      function SceneExample() {
        return <Layer style={{ width: 320, height: 180 }} />;
      }
      export default function mount(canvas: HTMLCanvasElement): CRCController {
        return crc(canvas, <SceneExample />);
      }
    `;

    expect(() =>
      validateLearningSourceText(baseSource, {
        authoring: "jsx",
        label: "fixture",
        sourcePath: threeLayerSourcePath,
      }),
    ).not.toThrow();

    expect(() =>
      validateLearningSourceText(baseSource, {
        authoring: "jsx",
        label: "fixture",
        sourcePath: threeInstancingSourcePath,
      }),
    ).toThrow(/OrbitControls/u);

    expect(() =>
      validateLearningSourceText(baseSource, {
        authoring: "jsx",
        label: "rectangle",
      }),
    ).toThrow(/only from @crc\/core/u);

    const controlsSource = baseSource
      .replace(
        'import { PerspectiveCamera, Scene } from "three";',
        'import { PerspectiveCamera, Scene } from "three";\nimport { OrbitControls } from "three/addons/controls/OrbitControls.js";',
      )
      .replace(
        "return { scene: new Scene(), camera: new PerspectiveCamera() };",
        "const camera = new PerspectiveCamera(); const controls = context.input.connect(element => new OrbitControls(camera, element)); return { scene: new Scene(), camera, controls };",
      )
      .replace("create() {", "create(context) {");

    expect(() =>
      validateLearningSourceText(controlsSource, {
        authoring: "jsx",
        label: "fixture",
        sourcePath: threeInstancingSourcePath,
      }),
    ).not.toThrow();
  });

  const physicsLessonSourcePath =
    "packages/scenarios/src/learning/composition/physics-2d.example.tsx";

  it("permits only the exact physics lesson to import the public 2D entry", () => {
    const source = `
      import { Circle, crc, type CRCController } from "@crc/core";
      import { PhysicsWorld2D, dynamicBody2D } from "@crc/physics/2d";
      function Scene() {
        return (
          <PhysicsWorld2D>
            <Circle physics={dynamicBody2D()} style={{ radius: 10 }} />
          </PhysicsWorld2D>
        );
      }
      export default function mount(canvas: HTMLCanvasElement): CRCController {
        return crc(canvas, <Scene />);
      }
    `;

    expect(() =>
      validateLearningSourceText(source, {
        authoring: "jsx",
        label: "fixture",
        sourcePath: physicsLessonSourcePath,
      }),
    ).not.toThrow();
    expect(() =>
      validateLearningSourceText(source, {
        authoring: "jsx",
        label: "physics-2d",
      }),
    ).not.toThrow();
    expect(() =>
      validateLearningSourceText(source, {
        authoring: "jsx",
        label: "circle",
      }),
    ).toThrow(/only from @crc\/core/u);
    expect(() =>
      validateLearningSourceText(
        source.replace("@crc/physics/2d", "@crc/physics/src/2d"),
        {
          authoring: "jsx",
          label: "fixture",
          sourcePath: physicsLessonSourcePath,
        },
      ),
    ).toThrow(/both @crc\/core and @crc\/physics\/2d/u);
  });

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

  it("rejects an imported createElement call mixed into a JSX lesson", () => {
    const source = `
      import { crc, createElement, Group, Rectangle, type CRCController } from "@crc/core";
      function Scene() {
        return (
          <Group>
            {createElement(Rectangle, { style: { width: 10, height: 10 } })}
          </Group>
        );
      }
      export default function mount(canvas: HTMLCanvasElement): CRCController {
        return crc(canvas, <Scene />);
      }
    `;

    expect(() =>
      validateLearningSourceText(source, {
        authoring: "jsx",
        label: "fixture",
      }),
    ).toThrow(/only JSX without createElement/u);
  });

  it.each([
    ["optional call", "createElement?.(Scene, null)"],
    ["constructor call", "new createElement(Scene, null)"],
    ["tagged-template call", "createElement`fixture`"],
  ])(
    "counts an imported createElement %s as createElement authoring in a JSX lesson",
    (_name, construction) => {
      const source = `
        import { crc, createElement, Group, type CRCController } from "@crc/core";
        function Scene() { return <Group />; }
        const child = ${construction};
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return crc(canvas, <Group>{child as never}</Group>);
        }
      `;

      expect(() =>
        validateLearningSourceText(source, {
          authoring: "jsx",
          label: "fixture",
        }),
      ).toThrow(/only JSX without createElement/u);
    },
  );

  it.each([
    ["optional call", "createElement?.(Scene, null)"],
    ["constructor call", "new createElement(Scene, null)"],
    ["tagged-template call", "createElement`fixture`"],
  ])(
    "rejects an imported createElement %s in the non-JSX lesson",
    (_name, construction) => {
      const source = `
        import { crc, createElement, Group, type CRCController } from "@crc/core";
        function Scene() { return createElement(Group, null); }
        const child = ${construction};
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return crc(canvas, createElement(Group, null, child as never));
        }
      `;

      expect(() =>
        validateLearningSourceText(source, {
          authoring: "createElement",
          label: "fixture",
        }),
      ).toThrow(/normal CallExpression/u);
    },
  );

  it.each([
    [
      "indirect props",
      `const props = {};
       const child = createElement?.(Scene, props);`,
    ],
    [
      "indirect style",
      `const style = {};
       const child = createElement?.(Scene, { style });`,
    ],
  ])("inspects %s on an optional createElement call", (_name, setup) => {
    const source = `
      import { crc, createElement, Group, type CRCController } from "@crc/core";
      function Scene() { return createElement(Group, null); }
      ${setup}
      export default function mount(canvas: HTMLCanvasElement): CRCController {
        return crc(canvas, createElement(Group, null, child as never));
      }
    `;

    expect(() =>
      validateLearningSourceText(source, {
        authoring: "createElement",
        label: "fixture",
      }),
    ).toThrow(/inline object props/u);
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
        import { crc, createElement, Group, ${removedFocusWrapper} as FocusPolicy, type CRCController } from "@crc/core";
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
        const notes: Notes = { text: "${removedDefinitionWrapper}", render: "${removedFocusWrapper}" };
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
  ])(
    "rejects %s through resolved component aliases",
    (_name, authoring, source) => {
      expectInvalidLearningSource(source, authoring);
    },
  );

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
      "object method",
      `
        const builder = {
          build(createElement: (type: unknown, props: null) => unknown): unknown {
            return createElement(Group, null);
          },
        };
        const scene = builder.build(() => null);
      `,
    ],
    [
      "class method",
      `
        class Builder {
          build(createElement: (type: unknown, props: null) => unknown): unknown {
            return createElement(Group, null);
          }
        }
        const scene = new Builder().build(() => null);
      `,
    ],
    [
      "private class method",
      `
        class Builder {
          build(): unknown {
            return this.#build(() => null);
          }
          #build(createElement: (type: unknown, props: null) => unknown): unknown {
            return createElement(Group, null);
          }
        }
        const scene = new Builder().build();
      `,
    ],
  ])(
    "rejects a createElement binding shadowed by an %s parameter",
    (_name, setup) => {
      const source = `
      import { crc, createElement, Group, type CRCController } from "@crc/core";
      ${setup}
      export default function mount(canvas: HTMLCanvasElement): CRCController {
        return crc(canvas, scene as never);
      }
    `;

      expect(() =>
        validateLearningSourceText(source, {
          authoring: "createElement",
          label: "fixture",
        }),
      ).toThrow(/without aliases, reassignment, or shadowing/u);
    },
  );

  it("allows unrelated object, class, and private method parameters", () => {
    expectValidNonJsxSource(`
      import { crc, createElement, Group, type CRCController } from "@crc/core";
      const objectBuilder = {
        build(factory: () => unknown): unknown {
          return factory();
        },
      };
      class Builder {
        build(factory: () => unknown): unknown {
          return this.#build(factory);
        }
        #build(factory: () => unknown): unknown {
          return factory();
        }
      }
      void objectBuilder;
      void Builder;
      export default function mount(canvas: HTMLCanvasElement): CRCController {
        return crc(canvas, createElement(Group, null));
      }
    `);
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
  ])(
    "rejects %s so props remain directly inspectable",
    (_name, authoring, source) => {
      expectInvalidLearningSource(source, authoring);
    },
  );

  it.each([
    ["a source-backed named re-export", `export { helper } from "./helper";`],
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

  it.each([
    "Absolute",
    "Clip",
    "Flex",
    "Flow",
    "FocusManagement",
    "Fragment",
    "Grid",
    "Group",
    "HorizontalLine",
    "Image",
    "KeyboardNavigation",
    "Layer",
    "Line",
    "Overlay",
    "Path",
    "Rectangle",
    "SvgPath",
    "Text",
    "VerticalLine",
  ])("rejects direct invocation of the %s component", (componentName) => {
    expectInvalidLearningSource(
      `
        import { crc, ${componentName}, type CRCController } from "@crc/core";
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return crc(canvas, <>{${componentName}({})}</>);
        }
      `,
      "jsx",
    );
  });

  it("rejects a component call mixed into the createElement lesson", () => {
    expectInvalidNonJsxSource(`
      import { crc, createElement, Group, Rectangle, type CRCController } from "@crc/core";
      export default function mount(canvas: HTMLCanvasElement): CRCController {
        return crc(canvas, createElement(Group, null, Rectangle({})));
      }
    `);
  });

  it.each([
    ["optional call", "Group?.({})"],
    ["constructor call", "new Group({})"],
    ["tagged-template call", "Group`fixture`"],
    ["TypeScript-wrapped optional call", "(Group as any)?.({})"],
  ])("rejects a descriptive component %s", (_name, invocation) => {
    expectInvalidNonJsxSource(`
      import { crc, createElement, Group, type CRCController } from "@crc/core";
      const invalid = ${invocation};
      export default function mount(canvas: HTMLCanvasElement): CRCController {
        return crc(canvas, createElement(Group, { key: String(invalid) }));
      }
    `);
  });

  it("keeps tagged-template use of other CRC values outside the learning contract", () => {
    expect(() =>
      validateLearningSourceText(
        `
          import { crc, createElement, Group, type CRCController } from "@crc/core";
          const invalid = crc\`fixture\`;
          export default function mount(canvas: HTMLCanvasElement): CRCController {
            void invalid;
            return crc(canvas, createElement(Group, null));
          }
        `,
        { authoring: "createElement", label: "fixture" },
      ),
    ).toThrow(/direct @crc\/core bindings/u);
  });

  it("allows direct calls to CRC runtime functions and hooks", () => {
    expectValidLearningSource(
      `
        import {
          crc,
          useComputed,
          useSignal,
          measureElement,
          resolveLength,
          Text,
          type CRCController,
        } from "@crc/core";
        function RuntimeFunctionStudy() {
          const count = useSignal(1);
          const doubled = useComputed(() => count.get() * 2);
          const length = resolveLength("50%", 200, "width") ?? 0;
          const measurement = measureElement(
            {} as never,
            {} as never,
            {} as never,
          );
          const y = measurement.status === "measured" ? measurement.size.height : 20;
          return <Text style={{ x: length, y }}>{doubled}</Text>;
        }
        export default function mount(canvas: HTMLCanvasElement): CRCController {
          return crc(canvas, <RuntimeFunctionStudy />);
        }
      `,
      "jsx",
    );
  });

  it.each([
    [
      "a Text style getter",
      `createElement(Text, { get style() { return { text: "legacy" }; } }, "Visible")`,
      "Text",
    ],
    [
      "a Layer render getter",
      `createElement(Layer, { get render() { return createElement(Group, null); } })`,
      "Layer, Group",
    ],
    [
      "a nested style method",
      `createElement(Rectangle, { style: { width() { return 10; }, height: 10 } })`,
      "Rectangle",
    ],
  ])("rejects %s as an uninspectable props object", (_name, scene, imports) => {
    expectUninspectableNonJsxSource(`
      import { crc, createElement, ${imports}, type CRCController } from "@crc/core";
      export default function mount(canvas: HTMLCanvasElement): CRCController {
        return crc(canvas, ${scene});
      }
    `);
  });

  it.each([
    [
      "TypeScript property and method signatures",
      `
        interface Vocabulary {
          readonly Text: string;
          Rectangle(): string;
          FocusManagement?: string;
        }
      `,
    ],
    [
      "class property, method, and accessor keys",
      `
        class Vocabulary {
          Text = "text";
          Rectangle(): string { return "rectangle"; }
          get FocusManagement(): string { return "focus"; }
        }
        void new Vocabulary().Text;
      `,
    ],
    [
      "enum member keys",
      `
        enum Vocabulary { Text, Rectangle, FocusManagement }
        void Vocabulary.Text;
      `,
    ],
    [
      "object and member keys",
      `
        const vocabulary = {
          Text: "text",
          Rectangle: "rectangle",
          FocusManagement: "focus",
        };
        void vocabulary.Text;
      `,
    ],
  ])(
    "allows imported component spellings in non-value %s",
    (_name, declarations) => {
      expectValidNonJsxSource(`
      import {
        crc,
        createElement,
        Group,
        Text,
        Rectangle,
        FocusManagement,
        type CRCController,
      } from "@crc/core";
      ${declarations}
      export default function mount(canvas: HTMLCanvasElement): CRCController {
        return crc(canvas, createElement(Group, null));
      }
    `);
    },
  );

  it("still treats a computed key as a component value reference", () => {
    expectInvalidNonJsxSource(`
      import { crc, createElement, Group, Text, type CRCController } from "@crc/core";
      const vocabulary = { [Text]: "text" };
      export default function mount(canvas: HTMLCanvasElement): CRCController {
        return crc(canvas, createElement(Group, { key: String(vocabulary) }));
      }
    `);
  });

  it.each([
    ["require call", `const helper = require("./helper");`],
    ["require.resolve call", `const path = require.resolve("./helper");`],
    ["module.exports assignment", `module.exports = {};`],
    ["computed module exports assignment", `module["exports"] = {};`],
    ["exports property assignment", `exports.helper = {};`],
    [
      "exports passed to a helper",
      `Object.defineProperty(exports, "helper", { value: true });`,
    ],
    [
      "shadowed require call",
      `function load(require: (id: string) => unknown) { return require("./helper"); }`,
    ],
  ])("rejects CommonJS %s", (_name, commonJsSyntax) => {
    expectInvalidNonJsxSource(`
      import { crc, createElement, Group, type CRCController } from "@crc/core";
      declare const require: {
        (id: string): unknown;
        resolve(id: string): string;
      };
      declare const module: { exports: unknown };
      declare const exports: Record<string, unknown>;
      ${commonJsSyntax}
      export default function mount(canvas: HTMLCanvasElement): CRCController {
        return crc(canvas, createElement(Group, null));
      }
    `);
  });

  it.each([
    [
      "globalThis require through a TypeScript assertion",
      `(globalThis as any).require("./helper");`,
    ],
    [
      "globalThis module.exports chain",
      `(globalThis as any).module.exports = {};`,
    ],
    [
      "computed globalThis module exports chain",
      `(globalThis as any)["module"]["exports"] = {};`,
    ],
    ["window computed require", `(window as any)["require"]("./helper");`],
    ["self exports property", `(self as any).exports.helper = {};`],
    ["global optional require", `(global as any)?.require?.("./helper");`],
    [
      "optional globalThis module exports chain",
      `void (globalThis as any)?.["module"]?.["exports"];`,
    ],
    [
      "nested known-global chain",
      `(globalThis as any).window.self["require"]("./helper");`,
    ],
  ])("rejects CommonJS access through %s", (_name, commonJsSyntax) => {
    expect(() =>
      validateLearningSourceText(
        `
          import { crc, createElement, Group, type CRCController } from "@crc/core";
          ${commonJsSyntax}
          export default function mount(canvas: HTMLCanvasElement): CRCController {
            return crc(canvas, createElement(Group, null));
          }
        `,
        { authoring: "createElement", label: "fixture" },
      ),
    ).toThrow(/CommonJS module loading or exports/u);
  });

  it.each([
    [
      "a globalThis no-substitution require template",
      '(globalThis as any)[`require`]("./helper");',
    ],
    [
      "a no-substitution module/exports template chain",
      "(globalThis as any)[`module`][`exports`] = {};",
    ],
    [
      "an optional no-substitution exports template",
      "void (globalThis as any)?.[`exports`]?.helper;",
    ],
    [
      "a TypeScript-wrapped optional template path",
      "void (((globalThis as any)[`module`] as any)?.[`exports`]);",
    ],
    [
      "a TypeScript-wrapped no-substitution template key",
      '(globalThis as any)[(`require` as const)]("./helper");',
    ],
    [
      "an escaped no-substitution require template",
      '(globalThis as any)[`requir\\u0065`]("./helper");',
    ],
    [
      "a nested known-global no-substitution template",
      '(globalThis as any).window.self[`require`]("./helper");',
    ],
    [
      "an expression template on a known global",
      'const suffix = "ire"; (globalThis as any)[`requ${suffix}`]("./helper");',
    ],
    [
      "a TypeScript-wrapped expression template on a known global",
      'const suffix = "ire"; (globalThis as any)[(`requ${suffix}` as string)]("./helper");',
    ],
    [
      "a tagged-template computed key on a known global",
      '(globalThis as any)[String.raw`require`]("./helper");',
    ],
    [
      "an identifier-computed key on a known global",
      'const key = "require"; (globalThis as any)[key]("./helper");',
    ],
    [
      "a TypeScript-wrapped string key on a known global",
      '(globalThis as any)[("require" as const)]("./helper");',
    ],
  ])("rejects CommonJS access through %s", (_name, commonJsSyntax) => {
    expect(() =>
      validateLearningSourceText(
        `
          import { crc, createElement, Group, type CRCController } from "@crc/core";
          ${commonJsSyntax}
          export default function mount(canvas: HTMLCanvasElement): CRCController {
            return crc(canvas, createElement(Group, null));
          }
        `,
        { authoring: "createElement", label: "fixture" },
      ),
    ).toThrow(/CommonJS module loading or exports/u);
  });

  it("allows CommonJS property names on unrelated objects", () => {
    expectValidNonJsxSource(`
      import { crc, createElement, Group, type CRCController } from "@crc/core";
      const loader = {
        require(id: string): string { return id; },
        module: { exports: {} },
        exports: { helper: false },
      };
      void loader.require("./helper");
      void loader?.["require"]?.("./helper");
      void loader?.[\`require\`]?.("./helper");
      const suffix = "ire";
      void loader[\`requ\${suffix}\`]("./helper");
      void loader[String.raw\`require\`]("./helper");
      loader.module.exports = {};
      loader["exports"].helper = true;
      loader[\`module\`][\`exports\`] = {};
      void (globalThis as any)[\`location\`];
      void (globalThis as any)[(\`location\` as const)];
      export default function mount(canvas: HTMLCanvasElement): CRCController {
        return crc(canvas, createElement(Group, null));
      }
    `);
  });

  it("allows CommonJS spellings that are only declarations or static keys", () => {
    expectValidNonJsxSource(`
      import { crc, createElement, Group, type CRCController } from "@crc/core";
      interface Vocabulary { require: string; module(): string; exports: string }
      class Labels { require = "require"; module(): string { return "module"; } }
      function label(require: string): string { return "static"; }
      const vocabulary = { require: "require", module: "module", exports: "exports" };
      void vocabulary.require;
      void new Labels().module();
      void label("require");
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

  it("contains 68 unique, ordered, source-backed routes including responsive layout, manipulation, Three, particles, physics, standard shapes, visualization, signals, and animation", async () => {
    expect(validateLearningExampleCatalog(learningExampleCatalog)).toBe(
      learningExampleCatalog,
    );
    expect(learningExampleCatalog).toHaveLength(68);
    expect(learningExampleCatalog.filter(entry =>
      entry.slug === "viz-band-bars" || entry.slug === "viz-grouped-bars"
    ).map(entry => getLearningExampleRoute(entry)).sort()).toEqual([
      "#/examples/composition/viz-band-bars",
      "#/examples/composition/viz-grouped-bars",
    ]);
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
    expect(
      learningExampleCatalog
        .filter((entry) =>
          [
            "circle",
            "ellipse",
            "arc",
            "wedge",
            "polygon",
            "regular-polygon",
            "star",
          ].includes(entry.slug),
        )
        .map((entry) => ({
          route: getLearningExampleRoute(entry),
          api: entry.api,
        })),
    ).toEqual([
      { route: "#/examples/drawing/circle", api: ["Circle"] },
      { route: "#/examples/drawing/ellipse", api: ["Ellipse"] },
      { route: "#/examples/drawing/arc", api: ["Arc"] },
      { route: "#/examples/drawing/wedge", api: ["Wedge"] },
      { route: "#/examples/drawing/polygon", api: ["Polygon"] },
      { route: "#/examples/drawing/regular-polygon", api: ["RegularPolygon"] },
      { route: "#/examples/drawing/star", api: ["Star"] },
    ]);
    const expectedBrowseGroups = {
      drawing: [
        "arc",
        "circle",
        "ellipse",
        "filters",
        "horizontal-line",
        "image",
        "line",
        "path",
        "path-geometry",
        "polygon",
        "rectangle",
        "regular-polygon",
        "star",
        "svg-path",
        "text",
        "vertical-line",
        "wedge",
      ],
      composition: [
        "clip",
        "group",
        "layer",
        "particle-effects",
        "physics-2d",
        "physics-panels",
        "signal-inputs",
        "signals-and-animation",
        "viz-stacked-bars",
        "viz-band-bars",
        "viz-grouped-bars",
        "viz-hover-comparison",
        "viz-pie-composition",
        "viz-points-and-inspection",
        "viz-responsive-line",
      ],
      three: ["three-instancing", "three-layer"],
      layout: [
        "absolute-and-overlay",
        "flex",
        "flow",
        "grid",
        "responsive-styles",
      ],
      "events-and-interaction": [
        "click",
        "context-menu",
        "custom-event-targets",
        "double-click",
        "drag-and-drop",
        "event-sequences",
        "hit-areas-and-cursors",
        "mouse-boundaries-and-auxiliary-click",
        "mouse-down",
        "mouse-move",
        "mouse-out",
        "mouse-over",
        "mouse-up",
        "manipulation",
        "overlap-and-paint-order",
        "pointer-capture",
        "pointer-events",
        "propagation-and-cancellation",
        "touch-events",
        "transformed-clipped-layered-targets",
        "wheel",
      ],
      "focus-and-keyboard": [
        "directional-navigation",
        "editing-composition-and-clipboard",
        "focus-management",
        "keyboard-events-and-activation",
        "nested-directional-navigation",
      ],
    } as const satisfies Readonly<
      Record<LearningBrowseGroup, readonly string[]>
    >;
    const expectedIntroductionRoutes = {
      "getting-started": "#/learn/guides/configure-jsx",
      "create-element-authoring": "#/learn/guides/author-without-jsx",
      signals: "#/examples/start/signals",
    } as const;

    for (const [group, expectedSlugs] of Object.entries(
      expectedBrowseGroups,
    ) as Array<[LearningBrowseGroup, readonly string[]]>) {
      const entries = getLearningExamplesByBrowseGroup(group);
      expect(entries.map((entry) => entry.slug).sort(), group).toEqual(
        [...expectedSlugs].sort(),
      );
      expect(
        entries.map(({ shortTitle }) => shortTitle),
        group,
      ).toEqual(
        [...entries.map(({ shortTitle }) => shortTitle)].sort((a, b) =>
          a.localeCompare(b, "en"),
        ),
      );
    }

    expect(
      learningExampleCatalog
        .filter((entry) => !entry.browseGroup)
        .map((entry) => entry.slug)
        .sort(),
    ).toEqual(Object.keys(expectedIntroductionRoutes).sort());

    expect(
      learningExampleCatalog
        .filter((entry) => entry.section === "composition")
        .map((entry) => entry.slug),
    ).toEqual([
      "group",
      "clip",
      "filters",
      "signal-inputs",
      "signals-and-animation",
      "particle-effects",
      "physics-2d",
      "layer",
      "physics-panels",
      "viz-stacked-bars",
      "viz-grouped-bars",
      "viz-band-bars",
      "viz-pie-composition",
      "viz-hover-comparison",
      "viz-points-and-inspection",
      "viz-responsive-line",
    ]);

    const startExamples = learningExampleCatalog.filter(
      (entry) => entry.section === "start",
    );
    expect(startExamples.map((entry) => entry.slug)).toContain("signals");

    const signals = startExamples.find((entry) => entry.slug === "signals");
    expect(signals).toMatchObject({
      api: ["signal", "computed", "useSignal"],
      source: {
        path: "packages/scenarios/src/learning/start/signals.example.tsx",
      },
    });
    expect(signals && getLearningExampleRoute(signals)).toBe(
      "#/examples/start/signals",
    );
    const signalsSource = await loadLearningSource(signals!);
    expect(signalsSource).toMatch(/from ["']@crc\/core["']/u);
    expect(signalsSource).not.toMatch(/@crc\/core\/(?:internal|lib|src)\b/u);
    expect(signalsSource).toContain("x,");
    expect(signalsSource).toContain("fill: color");
    expect(signalsSource).toContain("{signalSummary}");
    expect(signalsSource).toContain(".update(");
    expect(signalsSource).toContain("computed(");

    const expectedGroupBySlug = new Map<string, LearningBrowseGroup>(
      Object.entries(expectedBrowseGroups).flatMap(([group, slugs]) =>
        slugs.map((slug) => [slug, group as LearningBrowseGroup] as const),
      ),
    );
    for (const entry of learningExampleCatalog) {
      const expectedGroup = expectedGroupBySlug.get(entry.slug);
      const oldRoute = `#/examples/${entry.section}/${entry.slug}`;
      if (expectedGroup) {
        const expectedRoute = `#/examples/${expectedGroup}/${entry.slug}`;
        expect(entry.browseGroup, entry.slug).toBe(expectedGroup);
        expect(getLearningExampleRoute(entry), entry.slug).toBe(expectedRoute);
        expect(getLearningExampleLegacyRoutes(entry), entry.slug).toEqual(
          oldRoute === expectedRoute ? [] : [oldRoute],
        );
      } else {
        const expectedRoute =
          expectedIntroductionRoutes[
            entry.slug as keyof typeof expectedIntroductionRoutes
          ];
        expect(expectedRoute, entry.slug).toBeDefined();
        expect(entry.browseGroup, entry.slug).toBeUndefined();
        expect(getLearningExampleRoute(entry), entry.slug).toBe(expectedRoute);
        expect(getLearningExampleLegacyRoutes(entry), entry.slug).toEqual(
          oldRoute === expectedRoute ? [] : [oldRoute],
        );
      }
    }

    const clip = learningExampleCatalog.find((entry) => entry.slug === "clip");
    expect(clip).toBeDefined();
    expect(clip?.api).toEqual(["Clip", "createRegularPolygonPath"]);
    expect(clip?.objectives).toEqual([
      "Memoize a reusable hexagon Path2D with createRegularPolygonPath.",
      "Use an inradius-defined hexagon to clip children and their interaction geometry.",
    ]);
    expect(await loadLearningSource(clip!)).toContain(
      "createRegularPolygonPath",
    );
    expect(await loadLearningSource(clip!)).toContain("useConst");

    const regularPolygon = learningExampleCatalog.find(
      (entry) => entry.slug === "regular-polygon",
    );
    expect(regularPolygon?.summary).toContain("equal sides and angles");

    const star = learningExampleCatalog.find((entry) => entry.slug === "star");
    expect(star?.apiNotes).toContain(
      "A Star requires an integer point count of at least three and outerRadius at least as large as innerRadius.",
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
    expect(source).toMatch(/crc\(\s*canvas,\s*createElement\(/u);
  });

  it("mounts and drives fragments, keyed dynamic children, text zero, focus policies, and lifecycle without JSX", async () => {
    const { canvas, controller, textPaints } = await renderLearningExample(
      "create-element-authoring",
    );

    expect(textPaints.map((paint) => paint.text)).toEqual(
      expect.arrayContaining([
        "SELECTED NONE · COUNT 0",
        "LIFECYCLE 0",
        "CHOICE A",
        "CHOICE B",
      ]),
    );
    expect(textPaints.map((paint) => paint.text)).not.toContain("CHOICE C");

    await clickLogicalPoint(canvas, { x: 198, y: 238 });
    await nextPaint();
    expect(textPaints.slice(-12).map((paint) => paint.text)).toEqual(
      expect.arrayContaining([
        "SELECTED A · COUNT 1",
        "LIFECYCLE 1",
        "CHOICE C",
      ]),
    );

    await pressKey("ArrowRight");
    await pressKey("Enter");
    await nextPaint();
    expect(textPaints.slice(-12).map((paint) => paint.text)).toContain(
      "SELECTED B · COUNT 2",
    );

    controller.dispose();
    controller.dispose();
    mountedControllers.splice(mountedControllers.indexOf(controller), 1);
  });

  it("renders numeric zero and updates state interpolation in Text children", async () => {
    const { canvas, textPaints } = await renderLearningExample("text");

    expect(textPaints.map((paint) => paint.text)).toContain(
      "CLICK THE HEADLINE · ZERO 0 · #1f4bd8",
    );

    await clickLogicalPoint(canvas, { x: 360, y: 100 });
    await nextPaint();
    expect(textPaints.slice(-8).map((paint) => paint.text)).toContain(
      "CLICK THE HEADLINE · ZERO 0 · #ff6b57",
    );
  });

  it.each([
    {
      slug: "circle",
      target: [360, 210] as const,
      interior: [360, 210] as const,
      exterior: [80, 80] as const,
      initial: [255, 107, 87, 255],
      updated: [116, 211, 174, 255],
    },
    {
      slug: "ellipse",
      target: [360, 210] as const,
      interior: [360, 210] as const,
      exterior: [80, 80] as const,
      initial: [31, 75, 216, 255],
      updated: [247, 201, 72, 255],
    },
    {
      slug: "arc",
      target: [360, 90] as const,
      interior: [360, 90] as const,
      exterior: [360, 210] as const,
      initial: [31, 75, 216, 255],
      updated: [255, 107, 87, 255],
    },
    {
      slug: "wedge",
      target: [388, 182] as const,
      interior: [388, 182] as const,
      exterior: [220, 330] as const,
      initial: [168, 85, 247, 255],
      updated: [34, 197, 94, 255],
    },
    {
      slug: "polygon",
      target: [360, 210] as const,
      interior: [360, 210] as const,
      exterior: [100, 320] as const,
      initial: [245, 158, 11, 255],
      updated: [20, 184, 166, 255],
    },
  ])(
    "mounts, targets, and updates the $slug lesson without private imports",
    async ({ slug, target, interior, exterior, initial, updated }) => {
      const entry = learningExampleCatalog.find(
        (candidate) => candidate.slug === slug,
      );
      expect(entry).toBeDefined();
      const source = await loadLearningSource(entry!);
      expect(source.match(/from ["'][^"']+["']/g)).toEqual([
        expect.stringMatching(/from ["']@crc\/core["']/),
      ]);

      const { canvas } = await renderLearningExample(slug);
      expect(pixelAt(canvas, interior[0], interior[1])).toEqual(initial);
      expect(pixelAt(canvas, exterior[0], exterior[1])).toEqual([
        247, 240, 223, 255,
      ]);

      await clickLogicalPoint(canvas, { x: target[0], y: target[1] });
      await nextPaint();
      expect(pixelAt(canvas, interior[0], interior[1])).toEqual(updated);
    },
  );

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
          sourcePath: entry.source.path,
        }),
      ).not.toThrow();
    }
  });

  it("contains exactly the five canonical layout lessons", async () => {
    const layouts = learningExampleCatalog.filter(
      (entry) => entry.section === "layout",
    );
    expect(layouts.map((entry) => entry.slug)).toEqual([
      "absolute-and-overlay",
      "flow",
      "flex",
      "grid",
      "responsive-styles",
    ]);
    expect(layouts.map(getLearningExampleRoute)).toEqual([
      "#/examples/layout/absolute-and-overlay",
      "#/examples/layout/flow",
      "#/examples/layout/flex",
      "#/examples/layout/grid",
      "#/examples/layout/responsive-styles",
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

  it("covers every drawing, composition, and Three export plus each supported mouse event", () => {
    const drawingAndComposition = learningExampleCatalog
      .filter(
        (entry) =>
          entry.browseGroup === "drawing" ||
          entry.browseGroup === "composition" ||
          entry.browseGroup === "three",
      )
      .flatMap((entry) => entry.api);
    expect(new Set(drawingAndComposition)).toEqual(
      new Set([
        "Scale",
        "Axis",
        "LineSeries",
        "BarSeries",
        "PointSeries",
        "PlotSeries",
        "ScaleAdjust",
        "useScale",
        "HoverData",
        "HoverCard",
        "AnchoredLayout",
        "PieLayout",
        "PieSlice",
        "PieLabel",
        "pieSlices",
        "defineSeries",
        "closestPoint",
        "closestX",
        "interpolateX",
        "linearInterpolation",
        "nearestPoint",
        "Absolute",
        "Rectangle",
        "Circle",
        "Ellipse",
        "Arc",
        "Wedge",
        "Polygon",
        "RegularPolygon",
        "Star",
        "createRegularPolygonPath",
        "Path",
        "PathGeometry",
        "flattenPath",
        "simplifyPath",
        "subdividePath",
        "SvgPath",
        "Line",
        "HorizontalLine",
        "VerticalLine",
        "Text",
        "Image",
        "Group",
        "Clip",
        "Layer",
        "CRCFilter",
        "defineThreeLayer",
        "InstancedMesh",
        "Mesh",
        "OrbitControls",
        "Scene",
        "missBehavior",
        "Particles2D",
        "SignalValue",
        "batch",
        "useComputed",
        "useParticleSystem",
        "useSignal",
        "useTransition",
        "usePlayback",
        "useReaction",
        "parallel",
        "repeat",
        "resolveSignalValue",
        "sequence",
        "marker",
        "spring",
        "wait",
        "defineParticleEffect2D",
        "particleChoice",
        "particleCurve",
        "particleRange",
        "PhysicsWorld2D",
        "applyImpulse2D",
        "dynamicBody2D",
        "staticBody2D",
        "collider2D",
        "crcPhysicsBody2D",
        "useRef",
        "useSignal",
        "setPointerCapture",
        "disableBody2D",
        "teleportBody2D",
        "enableBody2D",
        "setLinearVelocity2D",
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

  it("makes the 2D physics lesson ball follow its captured pointer", async () => {
    const { canvas } = await renderLearningExample("physics-2d");
    const before = solidBlueBounds(canvas);
    const target = { x: 500, y: 120 };

    await pointerDownLogicalPoint(canvas, {
      x: before.centerX,
      y: before.centerY,
    });
    try {
      await pointerMoveLogicalPoint(canvas, target);
      await nextPaint();
      const dragged = solidBlueBounds(canvas);

      expect(dragged.centerX).toBeGreaterThanOrEqual(target.x - 1);
      expect(dragged.centerX).toBeLessThanOrEqual(target.x + 1);
      expect(dragged.centerY).toBeGreaterThanOrEqual(target.y - 1);
      expect(dragged.centerY).toBeLessThanOrEqual(target.y + 1);
    } finally {
      await pointerUpLogicalPoint(canvas, target);
    }
  });

  it("preserves the 2D physics lesson ball's final dragged pose when a release coalesces the disable-teleport-enable handoff", async () => {
    const { canvas } = await renderLearningExample("physics-2d");
    const before = solidBlueBounds(canvas);
    const target = { x: 500, y: 120 };

    await pointerDownLogicalPoint(canvas, {
      x: before.centerX,
      y: before.centerY,
    });
    await pointerMoveLogicalPoint(canvas, target);
    await pointerUpLogicalPoint(canvas, target);
    await nextPaint();
    const released = solidBlueBounds(canvas);

    expect(released.centerX).toBeGreaterThanOrEqual(499);
    expect(released.centerX).toBeLessThanOrEqual(521);
    expect(released.centerY).toBeGreaterThanOrEqual(119);
    expect(released.centerY).toBeLessThanOrEqual(145);
  });

  it("hands a measured rightward release velocity to the physics lesson ball", async () => {
    const { canvas } = await renderLearningExample("physics-2d");
    const before = solidBlueBounds(canvas);
    const start = { x: before.centerX, y: 120 };
    const release = { x: 440, y: 120 };

    await pointerDownLogicalPoint(canvas, start);
    await pointerMoveLogicalPoint(canvas, release);
    await pointerUpLogicalPoint(canvas, release);
    await nextPaint();
    const released = solidBlueBounds(canvas);
    for (let frame = 0; frame < 8; frame += 1) await nextPaint();
    const rolling = solidBlueBounds(canvas);

    expect(rolling.centerX).toBeGreaterThan(released.centerX + 8);
  });

  it("uses captured pointer motion to throw the physics lesson ball while its presentation remains clamped", async () => {
    const { canvas } = await renderLearningExample("physics-2d");
    const before = solidBlueBounds(canvas);
    const clamped = { x: 560, y: 40 };
    const continuedPointerMotion = { x: 560, y: 80 };

    await pointerDownLogicalPoint(canvas, {
      x: before.centerX,
      y: before.centerY,
    });
    await pointerMoveLogicalPoint(canvas, clamped);
    await new Promise<void>((resolve) => setTimeout(resolve, 140));
    await pointerMoveLogicalPoint(canvas, clamped);
    await pointerUpLogicalPoint(canvas, continuedPointerMotion);
    await nextPaint();
    for (let frame = 0; frame < 2; frame += 1) await nextPaint();
    const thrown = solidBlueBounds(canvas);

    expect(thrown.centerY).toBeGreaterThan(130);
  });

  it("preserves an older useful release sample after more than eight rapid captured pointer samples", async () => {
    const { canvas } = await renderLearningExample("physics-2d");
    const before = solidBlueBounds(canvas);
    const target = { x: 360, y: 120 };

    await pointerDownLogicalPoint(canvas, {
      x: before.centerX,
      y: before.centerY,
    });
    for (let sample = 0; sample < 8; sample += 1) {
      await pointerMoveLogicalPoint(canvas, target);
    }
    await pointerUpLogicalPoint(canvas, target);
    await nextPaint();
    const released = solidBlueBounds(canvas);
    for (let frame = 0; frame < 4; frame += 1) await nextPaint();
    const rolling = solidBlueBounds(canvas);

    expect(rolling.centerX).toBeGreaterThan(released.centerX + 30);
  });

  it("preserves the off-center grab offset while dragging the physics lesson ball", async () => {
    const { canvas } = await renderLearningExample("physics-2d");
    const before = solidBlueBounds(canvas);
    const start = { x: before.centerX - 12, y: before.centerY + 8 };
    const target = { x: 420, y: 160 };

    await pointerDownLogicalPoint(canvas, start);
    try {
      await nextPaint();
      const grabbed = solidBlueBounds(canvas);
      expect(grabbed.centerX).toBeGreaterThanOrEqual(before.centerX - 1);
      expect(grabbed.centerX).toBeLessThanOrEqual(before.centerX + 1);
      expect(grabbed.centerY).toBeGreaterThanOrEqual(before.centerY - 1);
      expect(grabbed.centerY).toBeLessThanOrEqual(before.centerY + 1);

      await pointerMoveLogicalPoint(canvas, target);
      await nextPaint();
      const dragged = solidBlueBounds(canvas);

      expect(dragged.centerX).toBeGreaterThanOrEqual(431);
      expect(dragged.centerX).toBeLessThanOrEqual(433);
      expect(dragged.centerY).toBeGreaterThanOrEqual(151);
      expect(dragged.centerY).toBeLessThanOrEqual(153);
    } finally {
      await pointerUpLogicalPoint(canvas, target);
    }
  });

  it("uses a settled ball's displayed pose for an off-center grab on a scaled lesson canvas", async () => {
    const { canvas } = await renderLearningExample("physics-2d");
    canvas.style.width = "568px";
    canvas.style.height = "331px";
    for (let frame = 0; frame < 75; frame += 1) await nextPaint();

    const before = solidBlueBounds(canvas);
    const beforeLogical = {
      x: (before.centerX * 720) / canvas.width,
      y: (before.centerY * 420) / canvas.height,
    };
    const start = { x: beforeLogical.x - 12, y: beforeLogical.y + 8 };
    const target = { x: 420, y: 160 };

    await pointerDownLogicalPoint(canvas, start);
    try {
      await nextPaint();
      const grabbed = solidBlueBounds(canvas);
      expect(grabbed.centerX).toBeGreaterThanOrEqual(before.centerX - 1);
      expect(grabbed.centerX).toBeLessThanOrEqual(before.centerX + 1);
      expect(grabbed.centerY).toBeGreaterThanOrEqual(before.centerY - 1);
      expect(grabbed.centerY).toBeLessThanOrEqual(before.centerY + 1);

      await pointerMoveLogicalPoint(canvas, target);
      await nextPaint();
      const dragged = solidBlueBounds(canvas);
      const expected = backingPointForLogical(canvas, { x: 432, y: 152 });

      expect(dragged.centerX).toBeGreaterThanOrEqual(expected.x - 1);
      expect(dragged.centerX).toBeLessThanOrEqual(expected.x + 1);
      expect(dragged.centerY).toBeGreaterThanOrEqual(expected.y - 1);
      expect(dragged.centerY).toBeLessThanOrEqual(expected.y + 1);
    } finally {
      await pointerUpLogicalPoint(canvas, target);
    }
  });

  it("clamps an out-of-range captured drag to the physics lesson ball-center bounds", async () => {
    const { canvas } = await renderLearningExample("physics-2d");
    const before = solidBlueBounds(canvas);
    const target = { x: 900, y: 40 };

    await pointerDownLogicalPoint(canvas, {
      x: before.centerX,
      y: before.centerY,
    });
    try {
      await pointerMoveLogicalPoint(canvas, target);
      await nextPaint();
      const dragged = solidBlueBounds(canvas);

      expect(dragged.centerX).toBeGreaterThanOrEqual(637);
      expect(dragged.centerX).toBeLessThanOrEqual(639);
      expect(dragged.centerY).toBeGreaterThanOrEqual(107);
      expect(dragged.centerY).toBeLessThanOrEqual(109);
    } finally {
      await pointerUpLogicalPoint(canvas, target);
    }
  });

  it("does not teleport the physics lesson ball after its captured pointer releases", async () => {
    const { canvas } = await renderLearningExample("physics-2d");
    const before = solidBlueBounds(canvas);
    const release = { x: 420, y: 120 };
    const laterPointer = { x: 610, y: 108 };

    await pointerDownLogicalPoint(canvas, {
      x: before.centerX,
      y: before.centerY,
    });
    await pointerMoveLogicalPoint(canvas, release);
    await pointerUpLogicalPoint(canvas, release);
    await nextPaint();
    await pointerMoveLogicalPoint(canvas, laterPointer);
    await nextPaint();
    const afterLaterPointerMove = solidBlueBounds(canvas);

    expect(afterLaterPointerMove.centerX).toBeLessThan(500);
  });

  it.each(learningExampleCatalog)(
    "loads, mounts, paints, and disposes $slug from its canonical source",
    async (entry) => {
      const source = await loadLearningSource(entry);
      expect(() =>
        validateLearningSourceText(source, {
          authoring: entry.authoring,
          label: entry.slug,
          sourcePath: entry.source.path,
        }),
      ).not.toThrow();

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

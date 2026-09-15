import { describe, expect, it } from "vitest";
import {
  encodeCodeRoute,
  MAX_SHARED_URL_LENGTH,
  readSharedCode,
  replaceCodeRoute,
} from "../../../playground/src/share-code";
import { toRunnableScript } from "../../../playground/src/sandbox-module";

const route = "#/examples/drawing/rectangle";
const canonical = "export default function mount() {}\n";

describe("learning example share URLs", () => {
  it("round-trips Unicode source and cleans canonical routes", () => {
    const edited = `${canonical}// こんにちは — 🟨\n`;
    const encoded = encodeCodeRoute(route, edited, canonical);

    expect(encoded.tooLong).toBe(false);
    const encodedHash = new URL(encoded.url).hash;
    expect(readSharedCode(encodedHash, canonical)).toEqual({ code: edited });
    expect(encodeCodeRoute(encodedHash, canonical, canonical).url).toBe(
      `${window.location.href.split("#", 1)[0]}${route}`,
    );
  });

  it("recovers from unsupported and malformed payloads", () => {
    expect(readSharedCode(`${route}?code=v2.future`, canonical)).toEqual({
      code: canonical,
      issue:
        "This shared edit uses an unsupported version, so the original lesson was restored.",
    });
    expect(readSharedCode(`${route}?code=v1.%`, canonical)).toEqual({
      code: canonical,
      issue:
        "The shared edit could not be decoded, so the original lesson was restored.",
    });
  });

  it("does not write an oversized payload into browser history", () => {
    const originalHash = window.location.hash;
    let seed = 0x6d2b79f5;
    const randomishSource = Array.from(
      { length: MAX_SHARED_URL_LENGTH * 4 },
      () => {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        return String.fromCharCode(33 + ((seed >>> 0) % 90));
      },
    ).join("");
    const result = replaceCodeRoute(route, randomishSource, canonical);

    expect(result.tooLong).toBe(true);
    expect(window.location.hash).toBe(originalHash);
  });
});

describe("learning example sandbox modules", () => {
  function executeSandbox(
    emittedCode: string,
    runtime: Readonly<Record<string, unknown>>,
    canvasElement: unknown,
  ): unknown {
    const sandboxGlobal = { CRC_CORE: runtime } as {
      CRC_CORE: Readonly<Record<string, unknown>>;
      __CRC_EXAMPLE_MOUNT__?: (canvas: unknown) => unknown;
    };
    const execute = new Function(
      "globalThis",
      "canvasElement",
      `let controller;
       try {
         ${toRunnableScript(emittedCode)}
         const canvas = canvasElement;
         controller = globalThis.__CRC_EXAMPLE_MOUNT__(canvas);
       } finally {}
       return controller;`,
    ) as (globalValue: typeof sandboxGlobal, canvas: unknown) => unknown;
    return execute(sandboxGlobal, canvasElement);
  }

  it("executes multiline root and runtime imports with aliases and comments", () => {
    const canvasElement = { id: "preview" };
    const runtime = {
      crc: (canvas: unknown, node: unknown) => ({ canvas, node }),
      jsx: (type: unknown, props: unknown) => ({ type, props }),
      Text: "text-component",
    };

    const emittedCode = `
import {
  crc /* root alias */ as CRC_CORE,
  Text as controller,
} from "@crc/core";
import {
  jsx as /* compiler alias */ __crcStudioRuntime,
} from "@crc/core/jsx-runtime";
import { Fragment as canvas } from "@crc/core/jsx-dev-runtime";
const literal = "import this and preserve export {}";
const template = \`export \${"import"} text\`;
export default function mount(/* before */ canvas /* after */) {
  return CRC_CORE(canvas, __crcStudioRuntime(controller, { children: [literal, template] }));
}
export /* empty module sentinel */ {};
`;
    const runnable = toRunnableScript(emittedCode);
    expect(runnable).toContain("/* root alias */");
    expect(runnable).toContain("/* compiler alias */");
    expect(runnable).toContain("/* empty module sentinel */");

    const result = executeSandbox(emittedCode, runtime, canvasElement);

    expect(result).toEqual({
      canvas: canvasElement,
      node: {
        type: "text-component",
        props: {
          children: [
            "import this and preserve export {}",
            "export import text",
          ],
        },
      },
    });
  });

  it("executes combined automatic and development runtime aliases", () => {
    const result = executeSandbox(
      `
import { jsx as _jsx, jsxs as _jsxs } from "@crc/core/jsx-runtime";
import { jsxDEV as _jsxDEV } from "@crc/core/jsx-dev-runtime";
import { crc, Rectangle, Text } from "@crc/core";
export default function mount(canvas) {
  return crc(canvas, [
    _jsx(Rectangle, { style: { width: 2, height: 2 } }),
    _jsxs(Text, { children: ["CRC ", 1] }),
    _jsxDEV(Rectangle, { style: { width: 4, height: 4 } }, undefined, false, undefined, undefined),
  ]);
}
`,
      {
        crc: (_canvas: unknown, node: unknown) => node,
        jsx: (type: unknown, props: unknown) => ({ kind: "jsx", type, props }),
        jsxs: (type: unknown, props: unknown) => ({
          kind: "jsxs",
          type,
          props,
        }),
        jsxDEV: (type: unknown, props: unknown) => ({
          kind: "jsxDEV",
          type,
          props,
        }),
        Rectangle: "rectangle-component",
        Text: "text-component",
      },
      {},
    );

    expect(result).toMatchObject([
      { kind: "jsx", type: "rectangle-component" },
      { kind: "jsxs", type: "text-component" },
      { kind: "jsxDEV", type: "rectangle-component" },
    ]);
  });

  it("executes core and WebGL imports through one Studio runtime", () => {
    const result = executeSandbox(
      `
import { crc } from "@crc/core";
import { jsx as _jsx } from "@crc/core/jsx-runtime";
import { Cube, WebGLLayer } from "@crc/webgl";
export default function mount(canvas) {
  return crc(canvas, _jsx(WebGLLayer, {
    style: { width: 320, height: 180 },
    children: _jsx(Cube, { style: { size: 1 } }),
  }));
}
`,
      {
        crc: (_canvas: unknown, node: unknown) => node,
        jsx: (type: unknown, props: unknown) => ({ type, props }),
        Cube: "cube-component",
        WebGLLayer: "webgl-layer-component",
      },
      {},
    );

    expect(result).toEqual({
      type: "webgl-layer-component",
      props: {
        style: { width: 320, height: 180 },
        children: {
          type: "cube-component",
          props: { style: { size: 1 } },
        },
      },
    });
  });

  it("executes core and particle imports through one Studio runtime", () => {
    const result = executeSandbox(
      `
import { crc } from "@crc/core";
import { jsx as _jsx } from "@crc/core/jsx-runtime";
import { Particles2D, defineParticleEffect2D, particleRange } from "@crc/particles";
const effect = defineParticleEffect2D({
  emitters: [{
    name: "spark",
    capacity: 1,
    emission: [{ type: "manual" }],
    shape: { type: "point" },
    initial: { lifetimeMilliseconds: particleRange(100, 200) },
    renderer: { type: "circle" },
  }],
});
export default function mount(canvas) {
  return crc(canvas, _jsx(Particles2D, { effect, style: { width: 320, height: 180 } }));
}
`,
      {
        crc: (_canvas: unknown, node: unknown) => node,
        jsx: (type: unknown, props: unknown) => ({ type, props }),
        Particles2D: "particles-component",
        defineParticleEffect2D: (effect: unknown) => effect,
        particleRange: (min: number, max: number) => ({ min, max }),
      },
      {},
    );

    expect(result).toMatchObject({
      type: "particles-component",
      props: { style: { width: 320, height: 180 } },
    });
  });

  it.each([
    'import external from "external";',
    'import * as CRC from "@crc/core";',
    'import CRC from "@crc/core";',
    'import { jsx } from "@crc/core/private-runtime";',
    'import { jsx } from "@crc/webgl/jsx-runtime";',
    'import "@crc/core";',
    'import type { CRCNode } from "@crc/core";',
  ])("rejects unsupported emitted module syntax: %s", (statement) => {
    expect(() =>
      toRunnableScript(
        `${statement}\nexport default function mount(canvas) { return canvas; }`,
      ),
    ).toThrow();
  });

  it.each([
    'const runtime = import("@crc/core/jsx-runtime");',
    'async function load() { return import("@crc/core"); }',
  ])("rejects dynamic imports in any lexical context: %s", (statement) => {
    expect(() =>
      toRunnableScript(
        `import { crc } from "@crc/core";\n${statement}\nexport default function mount(canvas) { return canvas; }`,
      ),
    ).toThrow();
  });

  it.each([
    "export { crc };",
    'export * from "@crc/core";',
    "export const extra = 1;",
    "export default canvas => canvas;",
    "export default function mount(canvas) { return canvas; }\nexport {};\nexport {};",
  ])("rejects malformed or extra exports: %s", (exportSource) => {
    expect(() =>
      toRunnableScript(`import { crc } from "@crc/core";\n${exportSource}`),
    ).toThrow(/default mount\(canvas\)/u);
  });

  it.each([
    'import { crc } from "@crc/core";\nimport { jsx as crc } from "@crc/core/jsx-runtime";',
    'import { crc, crc } from "@crc/core";',
  ])("rejects duplicate local import bindings: %s", (imports) => {
    expect(() =>
      toRunnableScript(
        `${imports}\nexport default function mount(canvas) { return canvas; }`,
      ),
    ).toThrow();
  });

  it.each([
    "function mount(canvas) { return canvas; }",
    "export default function mount(target) { return target; }",
    "export default function other(canvas) { return canvas; }",
    "export default async function mount(canvas) { return canvas; }",
    "export default function* mount(canvas) { yield canvas; }",
    "export default function mount(canvas) { return canvas; }\nexport default function mount(canvas) { return canvas; }",
  ])("requires exactly one default mount(canvas) export", (mountSource) => {
    expect(() =>
      toRunnableScript(`import { crc } from "@crc/core";\n${mountSource}`),
    ).toThrow(/default mount\(canvas\)/u);
  });

  it("does not reinterpret module-looking text in strings, templates, or comments", () => {
    const emittedCode = `
import { crc } from "@crc/core";
// import external from "external"; export const nope = true;
const stringValue = "import this; export {};";
const templateValue = \`dynamic import("external") and export default\`;
export default function mount(canvas /* retained comment */) {
  return crc(canvas, { stringValue, templateValue });
}
`;
    const runnable = toRunnableScript(emittedCode);

    expect(runnable).toContain(
      '// import external from "external"; export const nope = true;',
    );
    expect(runnable).toContain('"import this; export {};"');
    expect(runnable).toContain(
      '`dynamic import("external") and export default`',
    );
    expect(runnable).toContain("canvas /* retained comment */");
  });
});

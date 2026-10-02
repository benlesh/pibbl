import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { build } from "esbuild";
import { build as viteBuild } from "vite";
const root = resolve(import.meta.dirname, "..");
const temp = mkdtempSync(join(tmpdir(), "crc-wasm-bundles-"));
const kernels = Object.fromEntries(
  [
    "marble",
    "paper",
    "cellular",
    "ink",
    "tendrils",
    "lightning",
    "water-waves",
    "water-surface",
  ].map((name) => {
    const text = readFileSync(
      join(root, `packages/core/src/features/textures/lib/wasm/${name}-bytes.ts`),
      "utf8",
    );
    const match = text.match(/bytes = "([^"]+)"/);
    assert.ok(match, `Missing ${name} kernel`);
    return [name, match[1]];
  }),
);
try {
  let checks = 0;
  for (const mode of ["source", "built"]) {
    const alias = Object.fromEntries(
      ["core", "textures"].map((name) => [
        `@crc/${name}`,
        join(
          root,
          `packages/${name}/${mode === "source" ? "src/index.ts" : "dist/index.mjs"}`,
        ),
      ]),
    );
    for (const name of ["plain", ...Object.keys(kernels)]) {
      const factory =
        name === "ink"
          ? "reactionDiffusion"
          : name === "water-waves"
            ? "waterWaves"
            : name === "water-surface"
              ? "waterSurface"
              : name;
      const contents =
        name === "plain"
          ? "import {crc,createElement,Rectangle} from '@crc/core'; export function mount(c){return crc(c,createElement(Rectangle,{style:{width:40,height:40,fill:'red'}}));}"
          : `import {crc,createElement,Rectangle,useTexture} from '@crc/core'; import {${factory}} from '@crc/core/textures'; function Scene(){const texture=useTexture(${factory}());return createElement(Rectangle,{style:{width:40,height:40,fill:texture}});} export function mount(c){return crc(c,createElement(Scene,{}));}`;
      const input = join(temp, `${mode}-${name}.mjs`);
      writeFileSync(input, contents);
      for (const minify of [false, true]) {
        const esbuild = await build({
          entryPoints: [input],
          bundle: true,
          format: "esm",
          write: false,
          minify,
          alias,
          logLevel: "silent",
        });
        const vite = await viteBuild({
          root,
          configFile: false,
          logLevel: "silent",
          resolve: { alias },
          build: {
            write: false,
            minify,
            lib: { entry: input, formats: ["es"] },
          },
        });
        const viteOutputs = (Array.isArray(vite) ? vite : [vite])
          .flatMap((result) => result.output)
          .filter((output) => output.type === "chunk")
          .map((output) => output.code)
          .join("\n");
        for (const output of [esbuild.outputFiles[0].text, viteOutputs]) {
          for (const [kernel, bytes] of Object.entries(kernels)) {
            assert.equal(
              output.includes(bytes),
              name === kernel,
              `${mode}/${name}/${minify}: ${kernel}`,
            );
          }
          checks++;
        }
      }
    }
  }
  console.warn(
    `Texture WASM bundle selection: ${checks} source/built esbuild/Vite checks passed.`,
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}

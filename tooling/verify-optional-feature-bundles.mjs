import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";
import { build as esbuild, version as esbuildVersion } from "esbuild";
import { build as vite } from "vite";

const root = resolve(import.meta.dirname, "..");
// A selected WASM recipe must not retain another recipe's embedded kernel.
const wasmKernels = Object.fromEntries(
  ["marble", "paper", "cellular", "ink"].flatMap((name) => {
    const path = join(root, `packages/core/src/features/textures/lib/wasm/${name}-bytes.ts`);
    if (!existsSync(path)) return [];
    const match = readFileSync(path, "utf8").match(/bytes = "([^"]+)"/);
    assert.ok(match, `Cannot inspect ${name} WASM kernel`);
    return [[name, match[1]]];
  }),
);
const temp = mkdtempSync(join(tmpdir(), "pibbl-optional-bundles-"));
const store = dirname(
  parse(readFileSync(join(root, "node_modules/.modules.yaml"), "utf8"))
    .storeDir,
);
const pnpm = (args, cwd = root) =>
  execFileSync("corepack", ["pnpm@11.21.0", ...args], {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
  });

// Observable public mounts keep the entire selected feature path live.
const fixtures = {
  plain: `import { pibbl, createElement, Group, Rectangle, Text } from '@pibbl/core'; export function mount(canvas) { return pibbl(canvas, createElement(Group, { children: [createElement(Rectangle, { style: { width: 40, height: 40, fill: 'red' } }), createElement(Text, { children: 'Plain' })] })); }`,
  layer: `import { pibbl, createElement, Layer, Rectangle } from '@pibbl/core'; export function mount(canvas) { return pibbl(canvas, createElement(Layer, { children: createElement(Rectangle, { style: { width: 40, height: 40, fill: 'red' } }) })); }`,
  blur: `import { pibbl, createElement, Rectangle } from '@pibbl/core'; import { blur } from '@pibbl/core/filters'; export function mount(canvas) { return pibbl(canvas, createElement(Rectangle, { style: { width: 40, height: 40, fill: 'red', filter: blur({ radius: 2 }) } })); }`,
  marble: `import { pibbl, createElement, Rectangle, useTexture } from '@pibbl/core'; import { marble } from '@pibbl/core/textures'; function Scene() { const map = useTexture(marble({ seed: 1 })); return createElement(Rectangle, { style: { width: 40, height: 40, fill: map } }); } export function mount(canvas) { return pibbl(canvas, createElement(Scene, {})); }`,
  water: `import { pibbl, createElement, Rectangle, useTexture } from '@pibbl/core'; import { waterWaves } from '@pibbl/core/textures'; function Scene() { const map = useTexture(waterWaves({ seed: 1 })); return createElement(Rectangle, { style: { width: 40, height: 40, fill: map } }); } export function mount(canvas) { return pibbl(canvas, createElement(Scene, {})); }`,
  displacement: `import { pibbl, createElement, Rectangle, defineTexture, useTexture } from '@pibbl/core'; import { displacement } from '@pibbl/core/filters'; const recipe=defineTexture({create(){return {}},rasterize(_, { canvas }){const c=canvas.getContext('2d'); c.fillStyle='rgb(128 128 128)'; c.fillRect(0,0,canvas.width,canvas.height);}}); function Scene() { const map=useTexture(recipe({})); return createElement(Rectangle, { style: { width: 40, height: 40, fill: 'red', filter: displacement({ map, strength: 2, region: { x: 0, y: 0, width: 40, height: 40 } }) } }); } export function mount(canvas) { return pibbl(canvas, createElement(Scene, {})); }`,
  animation: `import { usePlayback } from '@pibbl/core'; globalThis.keep=usePlayback;`,
  coreImportOnly: `import '@pibbl/core';`,
  filtersImportOnly: `import '@pibbl/core/filters';`,
  texturesImportOnly: `import '@pibbl/core/textures';`,

  waterSurface: `import { pibbl, createElement, Rectangle, useTexture } from '@pibbl/core'; import { waterSurface } from '@pibbl/core/textures'; function Scene() { const map = useTexture(waterSurface({ seed: 1 })); return createElement(Rectangle, { style: { width: 40, height: 40, fill: map } }); } export function mount(canvas) { return pibbl(canvas, createElement(Scene, {})); }`,
  reflection: `import { pibbl, createElement, Rectangle, defineTexture, useTexture } from '@pibbl/core'; import { reflectedLight } from '@pibbl/core/filters'; const recipe=defineTexture({create(){return {}},rasterize(_, { canvas }){const c=canvas.getContext('2d'); c.fillStyle='rgb(255 128 128)'; c.fillRect(0,0,canvas.width,canvas.height);}}); function Scene() { const map=useTexture(recipe({})); return createElement(Rectangle, { style: { width: 40, height: 40, fill: 'red', filter: reflectedLight({ map, region: { x: 0, y: 0, width: 40, height: 40 } }) } }); } export function mount(canvas) { return pibbl(canvas, createElement(Scene, {})); }`,
};

for (const [name, factory] of [["paper", "paper"], ["cellular", "cellular"], ["ink", "reactionDiffusion"]]) {
  fixtures[name] = fixtures.marble.replaceAll("marble", factory);
}

const normalized = (path) => path.replaceAll("\\", "/");
const sourceAliases = [
  {
    find: "@pibbl/core/filters",
    replacement: join(root, "packages/core/src/filters.ts"),
  },
  { find: "@pibbl/core", replacement: join(root, "packages/core/src/index.ts") },
  {
    find: "@pibbl/core/textures",
    replacement: join(root, "packages/core/src/features/textures/index.ts"),
  },
];
sourceAliases.sort((a, b) => b.find.length - a.find.length);
const sourceAliasByName = Object.fromEntries(
  sourceAliases.map(({ find, replacement }) => [find, replacement]),
);
const sourceResolver = {
  name: "pibbl-source",
  setup(build) {
    build.onResolve(
      { filter: /^@pibbl\/core(?:\/(?:filters|textures))?$/ },
      ({ path }) => ({ path: sourceAliasByName[path] }),
    );
  },
};
const isFilter = (path) =>
  path.includes("packages/core/src/filters/") ||
  path.includes("/core/dist/filters/") ||
  path.includes("/core/dist/lib/filter/") ||
  path.includes("packages/core/src/lib/filter/") ||
  path.endsWith("/core/dist/filters.mjs");
const isDisplacement = (path) =>
  path.includes("filters/displacement") ||
  path.includes("filters/render-displacement");
const isTexture = (path) =>
  path.includes("packages/core/src/lib/textures/texture.ts") ||
  path.includes("packages/core/src/features/textures/") ||
  path.includes("/core/dist/features/textures/");
const isAnimation = (path) => path.includes("packages/core/src/lib/animation/");
const attributedInputs = (metafile) =>
  Object.entries(metafile.outputs)
    .flatMap(([output, entry]) =>
      Object.entries(entry.inputs ?? {}).map(([path, value]) => ({
        output: normalized(output),
        path: normalized(path),
        bytes: value.bytesInOutput ?? 0,
      })),
    )
    .filter((entry) => entry.bytes > 0);
const attributedBytes = (entries, detector) =>
  entries
    .filter((entry) => detector(entry.path))
    .reduce((sum, entry) => sum + entry.bytes, 0);
const outputText = (result) =>
  result.outputFiles.map((file) => file.text).join("\n");
const viteOutput = (result) =>
  (Array.isArray(result) ? result : [result])
    .flatMap(({ output }) => output)
    .flatMap((item) =>
      item.type === "chunk"
        ? [
            {
              file: item.fileName,
              bytes: Buffer.byteLength(item.code),
              gzipBytes: gzipSync(item.code).byteLength,
              code: item.code,
            },
          ]
        : [{ file: item.fileName, bytes: Buffer.byteLength(item.source), gzipBytes: gzipSync(item.source).byteLength, code: "" }],
    );

async function bundleEsbuild(source, directory, minify, plugins = []) {
  const result = await esbuild({
    absWorkingDir: directory,
    stdin: { contents: source, loader: "js", resolveDir: directory },
    bundle: true,
    format: "esm",
    platform: "browser",
    minify,
    metafile: true,
    write: false,
    plugins,
    logLevel: "silent",
  });
  return {
    bytes: result.outputFiles.reduce(
      (sum, file) => sum + file.contents.byteLength,
      0,
    ),
    gzipBytes: result.outputFiles.reduce((sum, file) => sum + gzipSync(file.contents).byteLength, 0),
    inputs: attributedInputs(result.metafile),
    code: outputText(result),
  };
}

async function bundleVite(source, directory, name, minify, aliases) {
  const entryDirectory =
    directory === root ? join(temp, "source-fixtures") : directory;
  mkdirSync(entryDirectory, { recursive: true });
  const entry = join(entryDirectory, `${name}-${minify ? "min" : "full"}.js`);
  writeFileSync(entry, source);
  const result = await vite({
    root: directory,
    configFile: false,
    logLevel: "silent",
    resolve: aliases ? { alias: sourceAliases } : undefined,
    build: { write: false, lib: { entry, formats: ["es"] }, minify },
  });
  const output = viteOutput(result);
  return {
    bytes: output.reduce((sum, file) => sum + file.bytes, 0),
    gzipBytes: output.reduce((sum, file) => sum + file.gzipBytes, 0),
    output,
    code: output.map((file) => file.code).join("\n"),
  };
}

function assertExcluded(label, evidence, detector, name) {
  assert.equal(
    attributedBytes(evidence.inputs, detector),
    0,
    `${label} retained ${name} source bytes`,
  );
  assert.equal(
    evidence.code.includes("Filter surface pairs must be released"),
    false,
    `${label} emitted ${name} marker`,
  );
}

function summary(es, vi) {
  const markers = {
    animation: "Pibbl animation playback run is already ending",
    displacement: "displacement filter value",
    nativeDropShadow: "drop-shadow(",
    textureProducer: "Texture message queue is full",
    water: "waterWaves is a numeric displacement map",
  };
  return {
    esbuild: {
      bytes: es.bytes,
      gzipBytes: es.gzipBytes,
      attributed: {
        filters: attributedBytes(es.inputs, isFilter),
        displacement: attributedBytes(es.inputs, isDisplacement),
        textures: attributedBytes(es.inputs, isTexture),
      },
      markers: Object.fromEntries(
        Object.entries(markers).map(([name, marker]) => [
          name,
          es.code.includes(marker),
        ]),
      ),
    },
    vite: {
      bytes: vi.bytes,
      gzipBytes: vi.gzipBytes,
      files: vi.output.map(({ file, bytes }) => ({ file, bytes })),
      markers: Object.fromEntries(
        Object.entries(markers).map(([name, marker]) => [
          name,
          vi.code.includes(marker),
        ]),
      ),
    },
  };
}

try {
  const tarballs = {};
  for (const name of ["core"]) {
    const file = join(temp, `${name}.tgz`);
    pnpm(["pack", "--out", file], join(root, "packages", name));
    tarballs[`@pibbl/${name}`] = `file:${file}`;
  }
  const consumer = join(temp, "consumer");
  mkdirSync(consumer);
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module", dependencies: tarballs }),
  );
  writeFileSync(
    join(consumer, "pnpm-workspace.yaml"),
    `packages:\n  - .\n`,
  );
  pnpm(
    [
      "install",
      "--offline",
      "--ignore-scripts",
      "--strict-peer-dependencies",
      "--store-dir",
      store,
    ],
    consumer,
  );
  writeFileSync(
    join(consumer, "import-only-inert.mjs"),
    `globalThis.OffscreenCanvas = class { constructor() { throw new Error("import allocated a canvas"); } };\nglobalThis.requestAnimationFrame = () => { throw new Error("import scheduled a frame"); };\nawait import("@pibbl/core");\nawait import("@pibbl/core/filters");\nawait import("@pibbl/core/textures");\n`,
  );
  execFileSync(process.execPath, ["import-only-inert.mjs"], {
    cwd: consumer,
    encoding: "utf8",
    stdio: "pipe",
  });

  const evidence = {};
  for (const [name, source] of Object.entries(fixtures)) {
    for (const [mode, directory, plugins, aliases] of [
      ["source", root, [sourceResolver], true],
      ["packed", consumer, [], false],
    ]) {
      for (const minify of [false, true]) {
        const key = `${mode}:${minify ? "min" : "full"}`;
        const es = await bundleEsbuild(source, directory, minify, plugins);
        const vi = await bundleVite(
          source,
          directory,
          `${name}-${mode}`,
          minify,
          aliases,
        );
        evidence[name] ??= {};
        evidence[name][key] = summary(es, vi);
        if (["plain", "layer", "blur", "marble", "paper", "cellular", "ink", "water", "displacement"].includes(name)) {
          for (const [bundler, code] of [["esbuild", es.code], ["Vite", vi.code]]) {
            for (const [kernel, bytes] of Object.entries(wasmKernels)) {
              assert.equal(code.includes(bytes), name === kernel,
                `${name} ${key} ${bundler} has incorrect ${kernel} WASM retention`);
            }
          }
        }
        if (name === "plain" || name === "layer") {
          for (const [bundler, code] of [["esbuild", es.code], ["Vite", vi.code]]) {
            assert.equal(code.includes("unresolved-stepper"), false, `${name} ${key} ${bundler} retained animation evaluation state`);
            assert.equal(code.includes("Texture message queue is full."), false, `${name} ${key} ${bundler} retained texture producer`);
          }

          assertExcluded(
            `${name} ${key} esbuild`,
            es,
            isFilter,
            "filter machinery",
          );
          assert.equal(
            vi.code.includes("Filter surface pairs must be released"),
            false,
            `${name} ${key} Vite retained filter machinery`,
          );
          for (const [feature, marker] of Object.entries({
            animation: "Pibbl animation playback run is already ending",
            displacement: "displacement filter value",
            textureProducer: "Texture message queue is full",
            water: "waterWaves is a numeric displacement map",
          })) {
            assert.equal(
              es.code.includes(marker),
              false,
              `${name} ${key} esbuild retained ${feature}`,
            );
            assert.equal(
              vi.code.includes(marker),
              false,
              `${name} ${key} Vite retained ${feature}`,
            );
          }
          assert.equal(
            attributedBytes(es.inputs, isAnimation),
            0,
            `${name} ${key} retained animation source bytes`,
          );
        }
        for (const [bundler, code] of [["esbuild", es.code], ["Vite", vi.code]]) {
          assert.equal(code.includes("Water surface WASM aborted."), name === "waterSurface", `${name} ${key} ${bundler} water simulation tree shaking`);
          assert.equal(code.includes("reflected-light filter value"), name === "reflection", `${name} ${key} ${bundler} reflection tree shaking`);
        }
        if (name === "animation") {
          assert.ok(es.code.includes("unresolved-stepper"), `animation ${key} esbuild positive detector failed`);
          assert.ok(vi.code.includes("unresolved-stepper"), `animation ${key} Vite positive detector failed`);
        }
        if (name === "blur") {
          assert.ok(
            attributedBytes(es.inputs, isFilter) > 0,
            `blur ${key} esbuild positive detector retained no filter bytes`,
          );
          assert.equal(
            attributedBytes(es.inputs, isDisplacement),
            0,
            `blur ${key} retained displacement bytes`,
          );
          assert.equal(
            es.code.includes("displacement filter value"),
            false,
            `blur ${key} esbuild retained displacement program`,
          );
          assert.equal(
            vi.code.includes("displacement filter value"),
            false,
            `blur ${key} Vite retained displacement program`,
          );
          assert.equal(
            es.code.includes("drop-shadow("),
            false,
            `blur ${key} esbuild retained drop-shadow implementation`,
          );
          assert.equal(
            vi.code.includes("drop-shadow("),
            false,
            `blur ${key} Vite retained drop-shadow implementation`,
          );
        }
        if (name === "displacement") {
          assert.ok(
            attributedBytes(es.inputs, isDisplacement) > 0 ||
              es.code.includes("displacement filter value"),
            `displacement ${key} esbuild positive detector retained no displacement program`,
          );
          assert.equal(
            es.code.includes("displacement filter value"),
            true,
            `displacement ${key} esbuild positive marker missing`,
          );
          assert.equal(
            vi.code.includes("displacement filter value"),
            true,
            `displacement ${key} Vite positive marker missing`,
          );
        }
        if (name === "marble" || name === "water")
          assert.ok(
            attributedBytes(es.inputs, isTexture) > 0,
            `${name} ${key} esbuild positive detector retained no texture bytes`,
          );
        if (["marble", "water", "displacement"].includes(name)) {
          for (const [bundler, code] of [["esbuild", es.code], ["Vite", vi.code]]) {
            assert.ok(code.includes("Texture message queue is full"), `${name} ${key} ${bundler} texture producer positive detector failed`);
          }
        }
        if (name === "marble" || name === "water") {
          assert.equal(attributedBytes(es.inputs, isFilter), 0, `${name} ${key} retained filter implementation`);
          for (const [bundler, code] of [["esbuild", es.code], ["Vite", vi.code]]) {
            assert.equal(code.includes("displacement filter value"), false, `${name} ${key} ${bundler} retained displacement`);
            assert.equal(code.includes("Filter surface pairs must be released"), false, `${name} ${key} ${bundler} retained capture pool`);
          }
        }
        if (name === "displacement") {
          for (const [bundler, code] of [["esbuild", es.code], ["Vite", vi.code]]) {
            assert.equal(code.includes("waterWaves is a numeric displacement map"), false, `${name} ${key} ${bundler} retained water recipe`);
            assert.equal(code.includes("drop-shadow("), false, `${name} ${key} ${bundler} retained native shadow implementation`);
          }
        }
        if (name === "marble") {
          assert.equal(
            es.code.includes("waterWaves is a numeric displacement map"),
            false,
            `marble ${key} esbuild retained water recipe code`,
          );
          assert.equal(
            vi.code.includes("waterWaves is a numeric displacement map"),
            false,
            `marble ${key} Vite retained water recipe code`,
          );
        }
        if (name === "water") {
          assert.equal(
            es.code.includes("waterWaves is a numeric displacement map"),
            true,
            `water ${key} esbuild positive marker missing`,
          );
          assert.equal(
            vi.code.includes("waterWaves is a numeric displacement map"),
            true,
            `water ${key} Vite positive marker missing`,
          );
        }
        if (name.endsWith("ImportOnly")) {
          assert.equal(
            es.bytes,
            0,
            `${name} ${key} esbuild import must be inert`,
          );
          assert.equal(vi.bytes, 0, `${name} ${key} Vite import must be inert`);
        }
      }
    }
  }
  const viteVersion = JSON.parse(
    readFileSync(join(root, "node_modules/vite/package.json"), "utf8"),
  ).version;
  process.stdout.write(
    `Optional feature source and packed bundle evidence: ${JSON.stringify({ versions: { node: process.version, pnpm: pnpm(["--version"]).trim(), esbuild: esbuildVersion, vite: viteVersion }, fixtures: evidence })}\n`,
  );
} catch (error) {
  if (error.stdout) process.stderr.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  throw error;
} finally {
  rmSync(temp, { recursive: true, force: true });
}

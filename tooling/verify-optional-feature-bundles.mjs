import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
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
const temp = mkdtempSync(join(tmpdir(), "crc-optional-bundles-"));
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

// Keep selected exports live so retained-byte checks exercise actual consumer code.
const fixtures = {
  plain: `import { crc, Rectangle, Text } from '@crc/core'; globalThis.keep=[crc,Rectangle,Text];`,
  layer: `import { Layer } from '@crc/core'; globalThis.keep=Layer;`,
  blur: `import { blur } from '@crc/core/filters'; globalThis.keep=blur;`,
  marble: `import { marble } from '@crc/textures'; globalThis.keep=marble;`,
  water: `import { waterWaves } from '@crc/textures'; globalThis.keep=waterWaves;`,
  displacement: `import { defineTexture } from '@crc/core'; import { displacement } from '@crc/core/filters'; const map=defineTexture({create(){return {}},rasterize(){}})({}); globalThis.keep=[map,displacement];`,
  coreImportOnly: `import '@crc/core';`,
  filtersImportOnly: `import '@crc/core/filters';`,
  texturesImportOnly: `import '@crc/textures';`,
};

const normalized = (path) => path.replaceAll("\\", "/");
const sourceAliases = [
  {
    find: "@crc/core/filters",
    replacement: join(root, "packages/core/src/filters.ts"),
  },
  { find: "@crc/core", replacement: join(root, "packages/core/src/index.ts") },
  {
    find: "@crc/textures",
    replacement: join(root, "packages/textures/src/index.ts"),
  },
  {
    find: "@crc/types",
    replacement: join(root, "packages/types/src/index.ts"),
  },
];
const sourceAliasByName = Object.fromEntries(
  sourceAliases.map(({ find, replacement }) => [find, replacement]),
);
const sourceResolver = {
  name: "crc-source",
  setup(build) {
    build.onResolve(
      { filter: /^@crc\/(?:core|textures|types)(?:\/filters)?$/ },
      ({ path }) => ({ path: sourceAliasByName[path] }),
    );
  },
};
const isFilter = (path) =>
  path.includes("packages/core/src/filters/") ||
  path.includes("packages/core/src/lib/filter/") ||
  path.endsWith("/core/dist/filters.mjs");
const isDisplacement = (path) =>
  path.includes("filters/displacement") ||
  path.includes("filters/render-displacement");
const isTexture = (path) =>
  path.includes("packages/textures/src/") ||
  path.endsWith("/textures/dist/index.mjs");
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
              code: item.code,
            },
          ]
        : [{ file: item.fileName, bytes: item.source.length, code: "" }],
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
    displacement: "displacement filter value",
    water: "waterWaves is a numeric displacement map",
  };
  return {
    esbuild: {
      bytes: es.bytes,
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
  for (const name of ["types", "core", "textures"]) {
    const file = join(temp, `${name}.tgz`);
    pnpm(["pack", "--out", file], join(root, "packages", name));
    tarballs[`@crc/${name}`] = `file:${file}`;
  }
  const consumer = join(temp, "consumer");
  mkdirSync(consumer);
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module", dependencies: tarballs }),
  );
  writeFileSync(
    join(consumer, "pnpm-workspace.yaml"),
    `packages:\n  - .\noverrides:\n  '@crc/types': ${tarballs["@crc/types"]}\n`,
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
        if (name === "plain" || name === "layer") {
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

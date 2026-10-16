import assert from "node:assert/strict";
import { parse } from "yaml";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const root = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const store = dirname(
  parse(readFileSync(join(root, "node_modules/.modules.yaml"), "utf8"))
    .storeDir,
);
const temp = mkdtempSync(join(tmpdir(), "pibbl-packed-textures-"));
const pnpm = (args, cwd = root) =>
  execFileSync("corepack", ["pnpm@11.21.0", ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
try {
  const tarballs = {};
  for (const name of ["core"]) {
    pnpm(
      ["pack", "--out", join(temp, `${name}.tgz`)],
      join(root, "packages", name),
    );
    tarballs[`@pibbl/${name}`] = `file:${join(temp, `${name}.tgz`)}`;
  }
  const consumer = join(temp, "consumer");
  mkdirSync(consumer);
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module", dependencies: tarballs }),
  );
  writeFileSync(join(consumer, "pnpm-workspace.yaml"), `packages:\n  - .\n`);
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
  const installed = createRequire(join(consumer, "probe.mjs"));
  const entry = installed.resolve("@pibbl/core/textures");
  const fromTextures = createRequire(entry);
  assert.equal(
    realpathSync(fromTextures.resolve("@pibbl/core")),
    realpathSync(installed.resolve("@pibbl/core")),
  );
  const textures = await import(pathToFileURL(entry).href);
  const filters = await import(
    pathToFileURL(installed.resolve("@pibbl/core/filters")).href
  );
  assert.equal(typeof filters.emboss, "function");
  assert.equal(typeof filters.backdropContrast, "function");
  const names = [
    "ProceduralTexture",
    "ReactionDiffusion",
    "cellular",
    "polkaDots",
    "halftone",
    "plaid",
    "truchet",
    "plaidPresets",
    "stripes",
    "checkers",
    "woodGrain",
    "schnakenberg",
    "barkley",
    "brusselator",
    "schnakenbergPresets",
    "barkleyPresets",
    "brusselatorPresets",
    "softNoise",
    "ridgedNoise",
    "plainWeave",
    "twill",
    "herringbone",
    "grayScottPresets",
    "marble",
    "paper",
    "reactionDiffusion",
    "waterWaves",
    "waterSurface",
    "rainDrops",
    "tendrils",
    "texturePalettes",
    "useTexture",
    "lightning",
  ].sort();
  assert.deepEqual(Object.keys(textures).sort(), names);
  if (process.argv.includes("--self-test-missing-export"))
    assert.equal(typeof textures.MissingTexture, "function");
  for (const path of [
    "@pibbl/core/textures/internal",
    "@pibbl/core/textures/src/index.ts",
    "@pibbl/core/textures/lib/simulation",
  ])
    assert.throws(() => installed.resolve(path), {
      code: "ERR_PACKAGE_PATH_NOT_EXPORTED",
    });
  const manifest = JSON.parse(
    readFileSync(installed.resolve("@pibbl/core/package.json"), "utf8"),
  );
  assert.equal(Object.keys(manifest.dependencies ?? {}).length, 0);
  writeFileSync(
    join(consumer, "public.tsx"),
    readFileSync(
      join(root, "packages/core/type-tests/textures/public.tsx"),
      "utf8",
    ),
  );
  const tsc = join(dirname(require.resolve("typescript")), "tsc.js");
  for (const mode of ["Bundler", "NodeNext"]) {
    writeFileSync(
      join(consumer, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ESNext",
          lib: ["ESNext", "DOM"],
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          types: [],
          jsx: "react-jsx",
          jsxImportSource: "@pibbl/core",
          module: mode === "Bundler" ? "ESNext" : "NodeNext",
          moduleResolution: mode,
        },
        files: ["public.tsx"],
      }),
    );
    execFileSync(
      process.execPath,
      [tsc, "-p", join(consumer, "tsconfig.json")],
      { encoding: "utf8", stdio: "pipe" },
    );
  }
  process.stdout.write(
    "Packed textures: Bundler, NodeNext, runtime exports, shared core identity, and private boundaries passed.\n",
  );
} catch (error) {
  if (error.stdout) process.stderr.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  throw error;
} finally {
  rmSync(temp, { recursive: true, force: true });
}

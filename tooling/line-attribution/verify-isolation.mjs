import assert from "node:assert/strict";
import { build as esbuild } from "esbuild";
import { build as vite } from "vite";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lineAttributionEsbuildPlugin,
  lineAttributionPlugin,
  instrumentLineAttribution,
} from "./plugin.mjs";
const root = resolve(import.meta.dirname, "../..");
const scratch = await mkdtemp(
  resolve(tmpdir(), "pibbl-attribution-isolation-"),
);
const report = {
  node: process.version,
  scope:
    "Attribution-only delta against the same current source/packed snapshot. Does not approve concurrent core inspection changes.",
  results: [],
};
const fixture = `import { pibbl, createElement, Group } from '@pibbl/core'; import { LineSeries, LinearScale } from '@pibbl/core/viz'; export function mount(canvas) { return pibbl(canvas, createElement(Group, {children: createElement(LinearScale,{id:'x',domain:[0,10],range:[0,200],children:createElement(LinearScale,{id:'y',domain:[0,10],range:[100,0],children:createElement(LineSeries,{data:[{x:0,y:0},{x:10,y:10}],x:'x',y:'y',xScale:'x',yScale:'y',pointerEvents:'none'})})})})); }`;
const entry = resolve(scratch, "consumer.ts");
await writeFile(entry, fixture);
const sha = (text) => createHash("sha256").update(text).digest("hex");
try {
  const tarball = resolve(scratch, "core.tgz");
  execFileSync("corepack", ["pnpm@11.21.0", "pack", "--out", tarball], {
    cwd: resolve(root, "packages/core"),
    stdio: "pipe",
  });
  const listing = execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" });
  assert.ok(
    !listing.includes("line-attribution/"),
    "Development tooling entered the packed package",
  );
  execFileSync("tar", ["-xzf", tarball, "-C", scratch]);
  report.tarballSha256 = sha(await readFile(tarball));
  report.packedProvenance =
    "Actual tarball of the current dist; this check does not rebuild or approve concurrent package changes.";
  for (const flavor of ["source", "packed"]) {
    const directory = flavor === "source" ? "src" : "dist",
      ext = flavor === "source" ? "ts" : "mjs";
    const entries = new Map(
      [
        ["@pibbl/core", `index.${ext}`],
        ["@pibbl/core/internal", `internal.${ext}`],
        ["@pibbl/core/viz", `features/viz/index.${ext}`],
        ["@pibbl/core/jsx-runtime", `jsx-runtime.${ext}`],
        ["@pibbl/core/jsx-dev-runtime", `jsx-dev-runtime.${ext}`],
      ].map(([key, path]) => [
        key,
        flavor === "source"
          ? resolve(root, "packages/core", directory, path)
          : resolve(scratch, "package", directory, path),
      ]),
    );
    const aliases = {
      name: "current-public-entries",
      setup(builder) {
        builder.onResolve({ filter: /^@pibbl\/core(?:\/.*)?$/ }, (args) => {
          const path = entries.get(args.path);
          return path ? { path } : undefined;
        });
      },
    };
    const build = (plugins) =>
      esbuild({
        entryPoints: [entry],
        bundle: true,
        format: "esm",
        platform: "browser",
        minify: true,
        write: false,
        metafile: true,
        jsx: "automatic",
        jsxImportSource: "@pibbl/core",
        plugins: [aliases, ...plugins],
        logLevel: "silent",
      });
    const baseline = await build([]),
      inactive = await build([lineAttributionEsbuildPlugin(root)]);
    assert.equal(
      inactive.outputFiles[0].text,
      baseline.outputFiles[0].text,
      `${flavor} esbuild ordinary bytes changed`,
    );
    assert.ok(
      !Object.keys(inactive.metafile.inputs).some((path) =>
        path.includes("line-attribution/"),
      ),
    );
    report.results.push({
      flavor,
      bundler: "esbuild",
      bytes: baseline.outputFiles[0].contents.length,
      sha256: sha(baseline.outputFiles[0].text),
      inactiveByteDelta: 0,
      retainedAttributionInputs: 0,
    });
    const vbuild = (plugins) =>
      vite({
        configFile: false,
        root: scratch,
        logLevel: "silent",
        plugins,
        resolve: {
          alias: [...entries].map(([find, replacement]) => ({
            find: new RegExp(`^${find}$`),
            replacement,
          })),
        },
        build: {
          write: false,
          minify: true,
          lib: { entry, formats: ["es"], fileName: () => "consumer.js" },
        },
      });
    const vb = await vbuild([]),
      vi = await vbuild([lineAttributionPlugin(root)]);
    const code = (result) =>
      (Array.isArray(result) ? result : [result])
        .flatMap((r) => r.output)
        .filter((o) => o.type === "chunk")
        .map((o) => o.code)
        .join("\n");
    assert.equal(code(vi), code(vb), `${flavor} Vite ordinary bytes changed`);
    assert.ok(!code(vi).includes("Only straight lines with linear scales"));
    report.results.push({
      flavor,
      bundler: "vite",
      bytes: Buffer.byteLength(code(vb)),
      sha256: sha(code(vb)),
      inactiveByteDelta: 0,
    });
    if (flavor === "source") {
      const active = await build([
        lineAttributionEsbuildPlugin(root, { enabled: true }),
      ]);
      assert.ok(
        Object.keys(active.metafile.inputs).some((path) =>
          path.endsWith("line-attribution/capture.ts"),
        ),
        "Positive detector failed to retain instrumentation",
      );
      assert.ok(
        active.outputFiles[0].text.includes(
          "Only straight lines with linear scales",
        ),
      );
      report.instrumentedSource = {
        bytes: active.outputFiles[0].contents.length,
        addedBytes:
          active.outputFiles[0].contents.length -
          baseline.outputFiles[0].contents.length,
      };
    }
  }
  const ordinary = lineAttributionPlugin(root);
  assert.equal(
    ordinary.apply({}, { command: "serve", mode: "development" }),
    false,
  );
  assert.equal(
    ordinary.apply({}, { command: "build", mode: "inspection" }),
    false,
  );
  for (const path of [
    "packages/core/src/features/viz/lib/line-series.tsx",
    "packages/core/src/lib/components/path.ts",
    "packages/core/src/lib/execute-render.ts",
  ]) {
    const text = await readFile(resolve(root, path), "utf8");
    assert.ok(!text.includes("line-attribution/"));
    assert.ok(instrumentLineAttribution(text, resolve(root, path), root));
  }
  assert.throws(
    () =>
      instrumentLineAttribution(
        "",
        resolve(root, "packages/core/src/lib/execute-render.ts"),
        root,
      ),
    /anchor changed/,
  );
  report.status = "pass";
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} finally {
  await rm(scratch, { recursive: true, force: true });
}

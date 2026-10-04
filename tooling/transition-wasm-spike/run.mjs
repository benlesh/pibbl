import { build } from "esbuild";
import { chromium } from "playwright";
import { readFile, writeFile, mkdtemp, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
const dir = await mkdtemp(join(tmpdir(), "crc-transition-wasm-"));
const require = createRequire(resolve("packages/core/package.json"));
await copyFile(
  "tooling/transition-wasm-spike/kernel.asc",
  join(dir, "kernel.ts"),
);
const compiled = spawnSync(
  process.execPath,
  [
    require.resolve("assemblyscript/bin/asc.js"),
    join(dir, "kernel.ts"),
    "--outFile",
    join(dir, "kernel.wasm"),
    "--optimizeLevel",
    "3",
    "--runtime",
    "stub",
    "--importMemory",
    "--initialMemory",
    "1",
    "--noAssert",
  ],
  { stdio: "inherit" },
);
if (compiled.status) process.exit(compiled.status);
await build({
  entryPoints: ["tooling/transition-wasm-spike/browser.ts"],
  outfile: join(dir, "bundle.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  define: { "import.meta.env.DEV": "false" },
  logOverride: { "empty-import-meta": "silent" },
  plugins: [
    {
      name: "sampler-variants",
      setup(b) {
        b.onResolve({ filter: /^spike:/ }, (args) => ({
          path: args.path,
          namespace: "spike",
        }));
        b.onLoad({ filter: /.*/, namespace: "spike" }, async (args) => {
          let source = await readFile(
            "tooling/transition-wasm-spike/reference-bifrost.txt",
            "utf8",
          );
          if (args.path === "spike:original")
            return {
              contents: source,
              loader: "ts",
              resolveDir: resolve("packages/core/src/lib/transitions"),
            };
          source = source.replace(
            "      for (let i = 0; i < 56; i++) {",
            `      const data = (globalThis as any).__spike${args.path.endsWith("cached") ? "Cached" : "Wasm"}(seconds, flow, power, r.width, distance, ex, ey, dx, dy);\n      for (let i = 0; i < 56; i++) {`,
          );
          const start = source.indexOf("        const speed ="),
            end = source.indexOf(
              "        c.rotate(angle); c.scale(length, width);",
              start,
            );
          source =
            source.slice(0, start) +
            `        const length=data[i*6+2], width=data[i*6+3], h=data[i*6+4], alpha=data[i*6+5];\n        c.save(); c.translate(data[i*6], data[i*6+1]);\n` +
            source.slice(end);
          return {
            contents: source,
            loader: "ts",
            resolveDir: resolve("packages/core/src/lib/transitions"),
          };
        });
      },
    },
  ],
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 800 },
    deviceScaleFactor: 1,
  });
  await page.goto("about:blank");
  await page.addScriptTag({ path: join(dir, "bundle.js") });
  const result = await page.evaluate(
    (bytes) => globalThis.run(bytes),
    [...(await readFile(join(dir, "kernel.wasm")))],
  );
  const output = {
    date: new Date().toISOString(),
    browser: browser.version(),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    ...result,
  };
  await writeFile(
    "tooling/transition-wasm-spike/results.json",
    JSON.stringify(output, null, 2) + "\n",
  );
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
} finally {
  await browser.close();
}

import { build } from "esbuild";
import { chromium } from "playwright";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const dir = await mkdtemp(join(tmpdir(), "pibbl-fancy-wasm-"));
await build({
  entryPoints: ["tooling/fancy-transition-wasm/browser.ts"],
  outfile: join(dir, "bundle.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  logOverride: { "empty-import-meta": "silent" },
  plugins: [
    {
      name: "reference",
      setup(b) {
        b.onResolve({ filter: /^reference:/ }, (args) => ({
          path: args.path,
          namespace: "reference",
        }));
        b.onLoad({ filter: /.*/, namespace: "reference" }, async (args) => ({
          contents: await readFile(
            `tooling/fancy-transition-wasm/reference-${args.path.split(":")[1]}.txt`,
            "utf8",
          ),
          loader: "ts",
          resolveDir: resolve("packages/core/src/lib/transitions"),
        }));
      },
    },
  ],
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 900, height: 700 },
    deviceScaleFactor: 1,
  });
  await page.goto("about:blank");
  await page.addScriptTag({ path: join(dir, "bundle.js") });
  const results = await page.evaluate(() => globalThis.run());
  const output = {
    date: new Date().toISOString(),
    browser: browser.version(),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    ...results,
  };
  await writeFile(
    "tooling/fancy-transition-wasm/results.json",
    JSON.stringify(output, null, 2) + "\n",
  );
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
} finally {
  await browser.close();
}

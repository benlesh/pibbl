import { build } from "esbuild";
import { chromium } from "playwright";
// Diagnostic comparison, not a timing gate. Use the same Chromium and hardware
// for comparisons. Canvas submission time is not GPU/raster completion time.
const bundle = await build({
  entryPoints: ["tooling/benchmarks/particle-sampling.ts"],
  bundle: true,
  write: false,
  format: "iife",
  globalName: "particleBenchmark",
  platform: "browser",
  define: { "import.meta.env.DEV": "false", "import.meta": "{}" },
});
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  process.stdout.write(
    JSON.stringify({
      browser: browser.version(),
      node: process.version,
      timestamp: new Date().toISOString(),
    }) + "\n",
  );
  for (const count of [100, 1000, 10000]) {
    const result = await page.evaluate(
      (count) => globalThis.particleBenchmark.benchmark(count),
      count,
    );
    process.stdout.write(JSON.stringify(result) + "\n");
  }
} finally {
  await browser.close();
}

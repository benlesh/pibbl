// Run with: node tooling/benchmark-path-algorithms-browser.mjs
// Browser characterization, not a performance gate. It bundles source code
// into an in-memory Chromium page and reports warmed medians and p95s.
import { build } from 'esbuild';
import { chromium } from 'playwright';

const bundle = await build({
  entryPoints: ['tooling/path-algorithm-browser-entry.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'CRCPathAlgorithmBenchmark',
  platform: 'browser',
  target: 'esnext',
  write: false,
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><title>Path algorithm benchmark</title>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  console.log(JSON.stringify(await page.evaluate(() => CRCPathAlgorithmBenchmark.runPathAlgorithmBrowserBenchmark())));
} finally {
  await browser.close();
}

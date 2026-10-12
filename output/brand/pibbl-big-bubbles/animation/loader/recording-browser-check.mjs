import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
const results = [];
const fresh = process.argv.includes("--fresh");
try {
  for (const isolated of [false, true]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      "http://127.0.0.1:8766/canvas-comparison.html" +
        (isolated ? "?isolation=1" : ""),
    );
    await page.waitForFunction(
      () => window.recording && window.comparison.loader.time > 0,
    );
    for (let repeat = 0; repeat < 3; repeat++)
      for (const mode of repeat % 2
        ? ["wasm", "transfer", "readback", "baseline"]
        : ["baseline", "readback", "transfer", "wasm"]) {
        if (fresh) {
          await page.goto(
            "http://127.0.0.1:8766/canvas-comparison.html" +
              (isolated ? "?isolation=1" : ""),
          );
          await page.waitForFunction(
            () => window.recording && window.comparison.loader.time > 0,
          );
        }
        const count = fresh
          ? 0
          : results.filter(
              (r) => r.workload === (isolated ? "isolated" : "comparison"),
            ).length;
        await page.evaluate((mode) => window.recording.ui.start(mode), mode);
        await page.waitForFunction(
          (count) => window.recording.ui.results.length > count,
          count,
        );
        const value = await page.evaluate(() =>
          window.recording.ui.results.at(-1),
        );
        assert.equal(value.storageFull, 0);
        assert.equal(value.dropped, 0);
        assert.ok(value.intervalMs.count > 50);
        if (mode === "wasm") {
          assert.equal(value.storedFrames, value.sentFrames);
          assert.equal(
            value.storedBytes,
            value.storedFrames * value.frameBytes,
          );
          assert.ok(value.storedFrames > 50);
        }
        value.canvasHistory = fresh
          ? "fresh per condition"
          : "shared across conditions";
        results.push(value);
        process.stdout.write(
          `${value.workload} ${mode}: read p95 ${value.readbackMs.p95.toFixed(2)}ms, interval p95 ${value.intervalMs.p95.toFixed(2)}ms, stored ${(value.storedBytes / 1048576).toFixed(1)}MiB\n`,
        );
      }
    await page.screenshot({
      path: `/tmp/pibbl-recording-${isolated ? "isolated" : "comparison"}.png`,
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    await context.close();
  }
  await writeFile(
    fresh
      ? "/tmp/pibbl-recording-results-fresh.json"
      : "/tmp/pibbl-recording-results.json",
    JSON.stringify(results, null, 2),
  );
} finally {
  await browser.close();
}

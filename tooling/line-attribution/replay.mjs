import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
const url = process.argv[2] ?? "http://127.0.0.1:5201/__pibbl/line-attribution";
const output = resolve(process.argv[3] ?? "/tmp/pibbl-line-attribution");
await mkdir(output, { recursive: false });
const report = {
  schema: "pibbl-viz-replay/1",
  status: "incomplete",
  scope:
    "Explicit instrumented development build; straight root lines only; geometric coverage, not pixel visibility or event targeting.",
  url,
  node: process.version,
  steps: [],
  checks: [],
  errors: [],
  sourceHashes: {},
};
const root = resolve(import.meta.dirname, "../..");
const files = [
  "tooling/line-attribution/capture.ts",
  "tooling/line-attribution/plugin.mjs",
  "tooling/line-attribution/demo.tsx",
  "packages/core/src/features/viz/lib/line-series.tsx",
  "packages/core/src/lib/components/path.ts",
  "packages/core/src/lib/execute-render.ts",
];
for (const file of files)
  report.sourceHashes[file] = createHash("sha256")
    .update(await readFile(resolve(root, file)))
    .digest("hex");
let browser;
try {
  browser = await chromium.launch();
  report.browser = browser.version();
  const page = await browser.newPage({
    viewport: { width: 1200, height: 1100 },
    deviceScaleFactor: 1,
  });
  page.on("pageerror", (error) => report.errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(() => window.lineAttributionDemo);
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  const state = async (actionId) => {
    await page.evaluate(() => window.lineAttributionDemo.settle());
    const value = await page.evaluate(() => {
      const c = document.querySelector("canvas");
      const ctx = c.getContext("2d");
      const blue = (x, y) => {
        const b = ctx.getImageData(x - 2, y - 2, 5, 5).data;
        let n = 0;
        for (let i = 0; i < b.length; i += 4)
          if (
            b[i] === 37 &&
            b[i + 1] === 99 &&
            b[i + 2] === 235 &&
            b[i + 3] === 255
          )
            n++;
        return n;
      };
      return {
        ...window.lineAttributionDemo.state(),
        pixels: {
          original: blue(205, 240),
          replacement: blue(205, 210),
          clipped: blue(505, 180),
        },
      };
    });
    report.steps.push({ actionId, status: "pass", state: value });
    return value;
  };
  const check = (id, actionId, test) => {
    try {
      test();
      report.checks.push({
        checkId: id,
        actionId,
        status: "pass",
        required: true,
      });
    } catch (error) {
      report.steps.find((s) => s.actionId === actionId).status = "fail";
      report.checks.push({
        checkId: id,
        actionId,
        status: "fail",
        required: true,
        reason: error.message,
      });
      throw error;
    }
  };
  await page.mouse.move(box.x + 205, box.y + 240);
  const initial = await state("initial");
  check("initial.sources", "initial", () =>
    assert.deepEqual(initial.query.sourceIndices, [0, 1]),
  );
  check("initial.values", "initial", () =>
    assert.deepEqual(
      [
        initial.query.from.x,
        initial.query.from.y,
        initial.query.to.x,
        initial.query.to.y,
      ],
      [0, 10, 5, 20],
    ),
  );
  check("initial.reference-semantics", "initial", () =>
    assert.equal(
      initial.query.sourceReferenceSemantics,
      "live-application-references-not-captured-values",
    ),
  );
  check("initial.identity", "initial", () =>
    assert.equal(initial.query.toSourceReference.id, "b"),
  );
  check("initial.scales", "initial", () =>
    assert.deepEqual(initial.attribution.lines[0].xScale, {
      id: "time",
      type: "linear",
      domain: [0, 10],
      range: [0, 600],
    }),
  );
  check("initial.transform", "initial", () =>
    assert.deepEqual(
      initial.attribution.lines[0].transform,
      [1, 0, 0, 1, 55, 90],
    ),
  );
  check("initial.pixels", "initial", () =>
    assert.ok(initial.pixels.original > 0 && initial.pixels.replacement === 0),
  );
  await page.mouse.move(box.x + 505, box.y + 180);
  const clipped = await state("clip-excluded");
  check("clip.query", "clip-excluded", () =>
    assert.equal(clipped.query.status, "clip-excluded"),
  );
  check("clip.pixels", "clip-excluded", () =>
    assert.equal(clipped.pixels.clipped, 0),
  );
  await page.locator('[data-action="clip"]').click();
  await page.mouse.move(box.x + 505, box.y + 180);
  const reveal = await state("clip-revealed");
  check("clip.reveal-sources", "clip-revealed", () =>
    assert.deepEqual(reveal.query.sourceIndices, [1, 2]),
  );
  check("clip.reveal-pixels", "clip-revealed", () =>
    assert.ok(reveal.pixels.clipped > 0),
  );
  await page.locator('[data-action="update"]').click();
  await page.mouse.move(box.x + 205, box.y + 210);
  const updated = await state("data-replaced");
  check("update.value", "data-replaced", () =>
    assert.equal(updated.query.to.y, 30),
  );
  check("update.generation", "data-replaced", () =>
    assert.ok(updated.attribution.generation > initial.attribution.generation),
  );
  check("update.pixels", "data-replaced", () =>
    assert.ok(updated.pixels.replacement > 0 && updated.pixels.original === 0),
  );
  await page.locator('[data-action="fail"]').click();
  const failed = await state("failed-render");
  check("failure.status", "failed-render", () =>
    assert.equal(failed.attribution.status, "render-failed"),
  );
  check("failure.publication", "failed-render", () =>
    assert.equal(failed.attribution.generation, updated.attribution.generation),
  );
  check("failure.query", "failed-render", () =>
    assert.equal(failed.query.status, "unavailable"),
  );
  await page.locator('[data-action="retry"]').click();
  await page.mouse.move(box.x + 205, box.y + 210);
  const retry = await state("retry");
  check("retry.status", "retry", () =>
    assert.equal(retry.attribution.status, "ready"),
  );
  check("retry.value", "retry", () => assert.equal(retry.query.to.y, 30));
  await page.locator('[data-action="zoom"]').click();
  await page.mouse.move(box.x + 55, box.y + 210);
  const zoom = await state("zoom");
  check("zoom.domain", "zoom", () =>
    assert.deepEqual(zoom.attribution.lines[0].xScale.domain, [2.5, 7.5]),
  );
  check("zoom.anchor", "zoom", () =>
    assert.deepEqual(zoom.query.sourceIndices, [0, 1]),
  );
  await page.locator('[data-action="reset"]').click();
  const reset = await state("reset");
  check("reset.domain", "reset", () => assert.deepEqual(reset.domain, [0, 10]));
  check("page.errors", "reset", () => assert.deepEqual(report.errors, []));
  await page.evaluate(() => window.lineAttributionDemo.dispose());
  const disposed = await page.evaluate(() =>
    window.lineAttributionDemo.state(),
  );
  report.steps.push({ actionId: "disposed", status: "pass", state: disposed });
  check("dispose.release", "disposed", () =>
    assert.deepEqual(disposed.attribution.lines, []),
  );
  report.status = "pass";
} catch (error) {
  report.status = "fail";
  report.errors.push(error.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  for (const file of files)
    assert.equal(
      createHash("sha256")
        .update(await readFile(resolve(root, file)))
        .digest("hex"),
      report.sourceHashes[file],
      `Source changed during replay: ${file}`,
    );
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify(report, null, 2),
  );
  process.stdout.write(
    JSON.stringify({
      status: report.status,
      checks: report.checks.length,
      next: [
        "node",
        "tooling/agent-verification/evidence-reader.mjs",
        resolve(output, "report.json"),
        "--action",
        "failed-render",
      ],
    }) + "\n",
  );
}

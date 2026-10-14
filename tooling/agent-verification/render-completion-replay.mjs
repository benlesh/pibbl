import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const origin = process.argv[2] ?? "http://127.0.0.1:5202";
const output = resolve(process.argv[3] ?? "/tmp/pibbl-render-completion");
await mkdir(output, { recursive: false });
const report = {
  schema: "pibbl-viz-replay/1",
  status: "incomplete",
  origin,
  steps: [],
  checks: [],
  errors: [],
};
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  page.on("pageerror", (error) => report.errors.push(error.message));
  await page.goto(`${origin}/__pibbl/render-completion`);
  await page.locator("[data-testid=evidence]").waitFor();
  const click = (action) => page.locator(`[data-action="${action}"]`).click();
  const state = () => page.evaluate(() => window.renderCompletionDemo.state());
  const waitForCommit = async (after) =>
    page.evaluate((generation) =>
      window.renderCompletionDemo.waitForCompletion(generation), after);
  const waitForPixels = async (generation) =>
    page.evaluate((value) =>
      window.renderCompletionDemo.waitForCapturedFrame(value), generation);
  const check = (checkId, actionId, callback) => {
    try {
      callback();
      report.checks.push({ checkId, actionId, status: "pass", required: true });
    } catch (error) {
      report.checks.push({ checkId, actionId, status: "fail", required: true, reason: error.message });
      throw error;
    }
  };
  const checkAsync = async (checkId, actionId, callback) => {
    try {
      await callback();
      report.checks.push({ checkId, actionId, status: "pass", required: true });
    } catch (error) {
      report.checks.push({ checkId, actionId, status: "fail", required: true, reason: error.message });
      throw error;
    }
  };
  const runAction = async (actionId) => {
    const before = (await state()).completions.at(-1)?.generation ?? 0;
    await click(actionId);
    const completion = await waitForCommit(before);
    await waitForPixels(completion.generation);
    const current = await state();
    report.steps.push({ actionId, action: actionId, status: "pass", completion, state: current });
    return current;
  };

  await checkAsync("recording.start-ready", "start", async () => {
    await click("start");
    await page.waitForFunction(
      () => window.renderCompletionDemo.state().recordingStatus === "recording",
    );
    const started = await state();
    assert.ok(started.completions.some((event) => event.status === "committed"));
    const initial = started.completions.at(-1);
    await waitForPixels(initial.generation);
    report.steps.push({ actionId: "start", action: "start", status: "pass", completion: initial, state: started });
  });

  const updated = await runAction("update");
  check("update.source", "update", () =>
    assert.equal(updated.application.rows[1].y, 30));
  check("update.semantic", "update", () =>
    assert.deepEqual(updated.semanticByGeneration[updated.completions.at(-1).generation], {
      id: "middle",
      domainY: 30,
      anchorRoot: { x: 310, y: 112.5 },
      anchorInsideClips: true,
      domain: [0, 10],
      clipEnd: 500,
    }));

  const zoomed = await runAction("zoom");
  check("zoom.mapping", "zoom", () => {
    assert.deepEqual(zoomed.application.domain, [2.5, 7.5]);
    assert.deepEqual(
      zoomed.semanticByGeneration[zoomed.completions.at(-1).generation].anchorRoot,
      { x: 310, y: 112.5 },
    );
  });

  const panned = await runAction("pan");
  check("pan.mapping", "pan", () => {
    assert.deepEqual(panned.application.domain, [3.5, 8.5]);
    assert.deepEqual(
      panned.semanticByGeneration[panned.completions.at(-1).generation].anchorRoot,
      { x: 210, y: 112.5 },
    );
  });

  const clipped = await runAction("clip");
  check("clip.semantic", "clip", () =>
    assert.equal(
      clipped.semanticByGeneration[clipped.completions.at(-1).generation]
        .anchorInsideClips,
      false,
    ));

  await click("stop");
  await page.waitForFunction(
    () => window.renderCompletionDemo.state().recordingStatus === "complete",
  );
  const evidence = await page.evaluate(() =>
    JSON.parse(document.querySelector("[data-testid=evidence]").textContent),
  );
  report.recording = {
    frames: evidence.frames,
    completionEvents: evidence.completionEvents,
    capturedFrames: evidence.capturedFrames,
  };
  check("generation-join", "stop", () => {
    assert.ok(evidence.frames.length >= 5);
    for (const frame of evidence.frames) {
      assert.ok(frame.semantic, `missing semantics for generation ${frame.renderGeneration}`);
      assert.ok(
        evidence.completionEvents.some(
          (event) => event.status === "committed" && event.generation === frame.renderGeneration,
        ),
      );
      assert.ok(
        evidence.capturedFrames.some(
          (captured) => captured.renderGeneration === frame.renderGeneration,
        ),
      );
    }
  });
  check("raw-pixel-update", "stop", () => {
    const before = evidence.frames.find(
      (frame) => frame.semantic.domainY === 20 && frame.semantic.domain[0] === 0,
    );
    const after = evidence.frames.find(
      (frame) =>
        frame.semantic.domainY === 30 &&
        frame.semantic.domain[0] === 0 &&
        frame.semantic.clipEnd === 500,
    );
    assert.ok(before && after);
    assert.ok(before.blueAtIndependentInitialAnchor > 0);
    assert.ok(after.blueAtIndependentAnchor > 0);
    assert.equal(after.blueAtIndependentInitialAnchor, 0);
  });
  check("raw-pixel-clip", "stop", () => {
    const frame = evidence.frames.find((item) => !item.semantic.anchorInsideClips);
    assert.ok(frame);
    assert.equal(frame.blueAtIndependentAnchor, 0);
  });
  check("wall-clock-timestamps", "stop", () => {
    for (let index = 0; index < evidence.frames.length; index++) {
      const frame = evidence.frames[index];
      assert.ok(Number.isFinite(frame.timestamp));
      assert.ok(Number.isSafeInteger(frame.renderGeneration));
      if (index > 0) {
        assert.ok(frame.timestamp >= evidence.frames[index - 1].timestamp);
        assert.ok(frame.renderGeneration > evidence.frames[index - 1].renderGeneration);
      }
    }
  });
  report.steps.push({ actionId: "stop", action: "stop", status: "pass", recording: report.recording });
  report.status = "pass";
} catch (error) {
  report.status = "fail";
  report.errors.push(error.stack ?? error.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
  process.stdout.write(
    JSON.stringify({
      status: report.status,
      checks: report.checks.length,
      next: `node tooling/agent-verification/evidence-reader.mjs ${resolve(output, "report.json")} --action stop`,
    }) + "\n",
  );
}

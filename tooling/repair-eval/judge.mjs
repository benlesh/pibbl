// Coordinator-only executable oracle. Run after the agent turn; never expose this file to that trial.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function scoreTrial(directory) {
  directory = resolve(directory);
  const trial = JSON.parse(
    await readFile(resolve(directory, "trial.json"), "utf8"),
  );
  const source = await readFile(resolve(directory, "app.tsx"), "utf8");
  const report = {
    schema: "pibbl-blind-repair-score/1",
    caseId: trial.caseId,
    arm: trial.arm,
    status: "incomplete",
    scope:
      "Post-repair functional observations; API usefulness requires paired human/agent traces and review.",
    runtimeUnchanged:
      hash(await readFile(resolve(directory, "runtime.mjs"))) ===
      trial.runtimeHash,
    sourceChanged: hash(source) !== trial.initialSourceHash,
    checks: [],
    observations: [],
    errors: [],
    measurements: null,
  };
  const server = spawn(
    process.execPath,
    [resolve(directory, "serve.mjs"), "0"],
    { cwd: directory, stdio: ["ignore", "pipe", "pipe"] },
  );
  let browser;
  const serverErrors = [];
  server.stderr.on("data", (b) =>
    serverErrors.push(b.toString().slice(0, 2000)),
  );
  const check = (id, body) => {
    try {
      body();
      report.checks.push({ id, status: "pass" });
    } catch (e) {
      report.checks.push({ id, status: "fail", reason: e.message });
    }
  };
  try {
    const port = await new Promise((ok, no) => {
      let text = "";
      const timer = setTimeout(
        () => no(new Error("Trial server startup timed out")),
        10000,
      );
      server.once("exit", (code) => {
        clearTimeout(timer);
        no(new Error(`Trial server exited: ${code}`));
      });
      server.stdout.on("data", (b) => {
        text += b;
        const newline = text.indexOf("\n");
        if (newline >= 0) {
          try {
            const value = JSON.parse(text.slice(0, newline));
            clearTimeout(timer);
            ok(value.port);
          } catch (e) {
            clearTimeout(timer);
            no(e);
          }
        }
      });
    });
    browser = await chromium.launch();
    report.browser = browser.version();
    const page = await browser.newPage({
      viewport: { width: 1100, height: 900 },
      deviceScaleFactor: 1,
    });
    page.setDefaultTimeout(10000);
    page.on("pageerror", (e) => report.errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}`);
    await page.waitForFunction(
      () => typeof window.applicationState === "function",
    );
    const settle = () =>
      page.evaluate(async () => {
        for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame);
      });
    const capture = async (stage) => {
      await settle();
      const state = await page.evaluate(() => {
        const canvas = document.querySelector("canvas"),
          ctx = canvas.getContext("2d");
        const blue = (x, y) => {
          const bytes = ctx.getImageData(x - 2, y - 2, 5, 5).data;
          let n = 0;
          for (let i = 0; i < bytes.length; i += 4)
            if (
              bytes[i] === 37 &&
              bytes[i + 1] === 99 &&
              bytes[i + 2] === 235 &&
              bytes[i + 3] === 255
            )
              n++;
          return n;
        };
        return {
          application: window.applicationState(),
          pixels: {
            left: blue(70, 267),
            initial: blue(205, 240),
            updated: blue(205, 210),
            zoomed: blue(205, 180),
            outsideFocus: blue(505, 180),
          },
          canvas: { width: canvas.width, height: canvas.height },
          inspectionAvailable: typeof window.inspectPlot === "function",
        };
      });
      report.observations.push({ stage, state });
      return state;
    };
    const initial = await capture("initial");
    check("harness.runtime-unchanged", () =>
      assert.equal(report.runtimeUnchanged, true),
    );
    check("initial.canvas", () =>
      assert.deepEqual(initial.canvas, { width: 710, height: 420 }),
    );
    check("initial.source", () =>
      assert.deepEqual(initial.application.source, [
        { id: "a", x: 0, y: 10 },
        { id: "b", x: 5, y: 20 },
        { id: "c", x: 10, y: 30 },
      ]),
    );
    check("initial.left-visible", () =>
      assert.ok(
        initial.pixels.left > 0,
        "Expected line at root (70,267) within plot clip",
      ),
    );
    check("initial.segment", () =>
      assert.ok(
        initial.pixels.initial > 0 && initial.pixels.updated === 0,
        "Expected y=15 at data x=2.5, not y=20",
      ),
    );
    const box = await page.locator("canvas").boundingBox();
    const hoverSamples = [];
    // Independent nearest-x midpoints: root 55 + 600*(2.5/10)=205 and 505.
    for (const [x, expected] of [
      [70, "a"],
      [204, "a"],
      [206, "b"],
      [355, "b"],
      [504, "b"],
      [506, "c"],
      [640, "c"],
    ]) {
      await page.mouse.move(box.x + x, box.y + 210);
      const state = await capture(`hover-root-${x}`);
      hoverSamples.push({ x, expected, actual: state.application.hover });
    }
    check("hover.identity", () =>
      assert.deepEqual(
        hoverSamples.map((s) => s.actual),
        hoverSamples.map((s) => s.expected),
        JSON.stringify(hoverSamples),
      ),
    );
    // Do not add pointer input between publication and sampling: it could mask a stale signal bug.
    await page.keyboard.press("u");
    const updated = await capture("updated-before-more-input");
    check("update.source", () =>
      assert.equal(updated.application.source[1].y, 30),
    );
    check("update.evaluated", () =>
      assert.equal(updated.application.evaluated[1].y, 30),
    );
    check("update.segment", () =>
      assert.ok(
        updated.pixels.updated > 0 && updated.pixels.initial === 0,
        "Expected new segment at (205,210) without another interaction",
      ),
    );
    await page.keyboard.press("z");
    await settle();
    const zoomHover = [];
    // Zoom domain [2.5,7.5] puts both nearest-ID transitions at plot edges;
    // every strictly interior probe must choose b.
    for (const x of [60, 205, 355, 650]) {
      await page.mouse.move(box.x + x, box.y + 180);
      const state = await capture(`zoom-hover-root-${x}`);
      zoomHover.push(state.application.hover);
    }
    const zoomed = await capture("zoomed");
    check("zoom.domain", () =>
      assert.deepEqual(zoomed.application.domain, [2.5, 7.5]),
    );
    check("zoom.segment", () =>
      assert.ok(
        zoomed.pixels.zoomed > 0,
        "Root x=205 maps to data x=3.75 and y=25 after update",
      ),
    );
    check("zoom.hover", () =>
      assert.deepEqual(zoomHover, ["b", "b", "b", "b"]),
    );
    await page.keyboard.press("r");
    const reset = await capture("reset");
    check("reset.values", () =>
      assert.deepEqual(reset.application.source, initial.application.source),
    );
    let focusCorrect = true;
    if (trial.caseId.startsWith("decision-")) {
      await page.keyboard.press("f");
      await settle();
      await page.mouse.move(box.x + 340, box.y + 210);
      const focused = await capture("focused-visible-selection");
      await page.keyboard.press("g");
      await settle();
      await page.mouse.move(box.x + 340, box.y + 210);
      const unfocused = await capture("unfocused-selection");
      focusCorrect =
        focused.application.focused === true &&
        focused.application.hover === "a" &&
        focused.pixels.initial > 0 &&
        focused.pixels.outsideFocus === 0 &&
        unfocused.application.focused === false &&
        unfocused.application.hover === "b" &&
        unfocused.pixels.outsideFocus > 0;
      await page.keyboard.press("r");
      await page.keyboard.press("z");
      await settle();
      await page.keyboard.press("f");
      await settle();
      await page.mouse.move(box.x + 340, box.y + 210);
      const zoomFocused = await capture("zoom-focused-no-visible-anchor");
      check("zoom.focus.selection", () =>
        assert.equal(
          zoomFocused.application.hover,
          null,
          "No record anchor is visible after zoom then focus",
        ),
      );
      focusCorrect = focusCorrect && zoomFocused.application.hover === null;
    }
    check("reset.geometry", () =>
      assert.ok(
        reset.pixels.initial > 0 && reset.pixels.updated === 0 && focusCorrect,
        "Reset and focused clip/selection contract",
      ),
    );
    check("page.errors", () => assert.deepEqual(report.errors, []));
    report.status = report.checks.every((c) => c.status === "pass")
      ? "pass"
      : "fail";
    try {
      report.measurements = JSON.parse(
        await readFile(resolve(directory, "observations.json"), "utf8"),
      );
    } catch {
      report.measurements = null;
    }
  } catch (e) {
    report.status = "blocked";
    report.errors.push(e.message);
  } finally {
    await browser?.close();
    server.kill("SIGTERM");
    await new Promise((done) => {
      if (server.exitCode !== null) {
        done();
        return;
      }
      const timer = setTimeout(() => {
        server.kill("SIGKILL");
        done();
      }, 3000);
      server.once("exit", () => {
        clearTimeout(timer);
        done();
      });
    });
    report.serverErrors = serverErrors;
  }
  return report;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (process.argv.length !== 4)
    throw new Error(
      "Usage: node judge.mjs TRIAL_DIRECTORY PRIVATE_OUTPUT_JSON",
    );
  const directory = resolve(process.argv[2]),
    output = resolve(process.argv[3]);
  if (!relative(directory, output).startsWith(".."))
    throw new Error("Keep hidden scores outside the agent trial directory");
  const report = await scoreTrial(directory);
  await writeFile(output, JSON.stringify(report, null, 2));
  process.stdout.write(
    JSON.stringify({ status: report.status, output }) + "\n",
  );
}

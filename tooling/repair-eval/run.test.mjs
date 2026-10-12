import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { runExperiment } from "./run.mjs";
import { applyReferenceRepair } from "./private-cases.mjs";
test("automates two repair/review turns and persists weighted scores", async () => {
  const parent = await mkdtemp(resolve(tmpdir(), "pibbl-run-test-"));
  let repairs = 0,
    reviews = 0;
  try {
    const result = await runExperiment({
      directory: resolve(parent, "run"),
      cases: ["case-01"],
      turn: async (o) => {
        if (o.schema) {
          reviews++;
          const packet = JSON.parse(
            await readFile(resolve(o.directory, "evidence.json"), "utf8"),
          );
          assert.equal(packet.arm, undefined);
          await writeFile(
            o.output,
            JSON.stringify({
              diagnosis: 4,
              repairQuality: 5,
              evidenceQuality: 3,
              uncertainty: 4,
              reasons: {
                diagnosis: "Trace",
                repairQuality: "Diff",
                evidenceQuality: "Checks",
                uncertainty: "Limits",
              },
            }),
          );
        } else {
          repairs++;
          await applyReferenceRepair(o.directory, "case-01");
          await writeFile(o.output, "Repaired with fresh data identity");
        }
        await writeFile(o.trace, "{}\n");
      },
      score: async () => ({
        status: "pass",
        checks: Array.from({ length: 15 }, () => ({ status: "pass" })),
        observations: [],
      }),
    });
    assert.equal(repairs, 2);
    assert.equal(reviews, 2);
    assert.equal(result.summary.ordinary.meanScore, 96);
    assert.equal(result.summary.attribution.meanScore, 96);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
test("failed agent turns stay blocked and never invoke review", async () => {
  const parent = await mkdtemp(resolve(tmpdir(), "pibbl-block-test-"));
  try {
    const result = await runExperiment({
      directory: resolve(parent, "run"),
      cases: ["case-04"],
      turn: async () => {
        throw new Error("unavailable");
      },
    });
    assert.equal(result.summary.ordinary.meanScore, null);
    assert.equal(result.summary.ordinary.blocked, 1);
    assert.ok(result.trials.every((t) => t.total === null));
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("both arms require independent painted-result evidence without a defect hint", async () => {
  const parent = await mkdtemp(resolve(tmpdir(), "pibbl-evidence-task-"));
  try {
    const { preparePair } = await import("./prepare-pair.mjs");
    const pair = resolve(parent, "pair");
    await preparePair({ caseId: "case-04", directory: pair });
    for (const arm of ["ordinary", "attribution"]) {
      const task = await readFile(resolve(pair, arm, "TASK.md"), "utf8");
      assert.match(task, /Independent rendering evidence/);
      assert.match(task, /native pointer input/);
      assert.match(task, /Pointer event x\/y is root-logical/);
      assert.match(task, /Inspect the supplied scale range/);
    }
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { preparePair } from "./prepare-pair.mjs";
import { scoreTrial } from "./judge.mjs";
import { applyReferenceRepair, caseIds } from "./private-cases.mjs";
const root = await mkdtemp(resolve(tmpdir(), "pibbl-repair-eval-smoke-"));
const results = [];
try {
  for (const caseId of caseIds) {
    const pair = resolve(root, caseId);
    await preparePair({ caseId, directory: pair });
    for (const arm of ["ordinary", "attribution"]) {
      const directory = resolve(pair, arm);
      const before = await scoreTrial(directory);
      assert.equal(
        before.status,
        caseId === "case-04" ? "pass" : "fail",
        `${arm}/${caseId} must distinguish seeded bugs from the clean control`,
      );
      await applyReferenceRepair(directory, caseId);
      const after = await scoreTrial(directory);
      assert.equal(
        after.status,
        "pass",
        `${arm}/${caseId} must accept a correct repair`,
      );
      results.push({
        arm,
        caseId,
        before: before.status,
        after: after.status,
        checks: after.checks.length,
      });
    }
  }
  process.stdout.write(
    JSON.stringify(
      {
        status: "pass",
        scope:
          "Eval plumbing and independent oracles only; no agent usefulness comparison performed.",
        results,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await rm(root, { recursive: true, force: true });
}

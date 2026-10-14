import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  decisionCases,
  prepareDecisionPair,
  repairDecisionReference,
} from "./decision-cases.mjs";
import { scoreTrial } from "./judge.mjs";
const root = await mkdtemp(resolve(tmpdir(), "pibbl-public-decision-check-"));
const results = [];
try {
  for (const caseId of decisionCases) {
    const pair = resolve(root, caseId);
    await prepareDecisionPair({ caseId, directory: pair });
    for (const arm of ["ordinary", "inspection"]) {
      const dir = resolve(pair, arm);
      const before = await scoreTrial(dir);
      assert.equal(
        before.status,
        caseId === "decision-03" ? "pass" : "fail",
        `${caseId}/${arm} must distinguish faults`,
      );
      assert.equal(
        before.observations[0].state.inspectionAvailable,
        arm === "inspection",
      );
      await repairDecisionReference(dir, caseId);
      const after = await scoreTrial(dir);
      assert.equal(after.status, "pass", `${caseId}/${arm} reference repair`);
      results.push({
        caseId,
        arm,
        before: before.status,
        after: after.status,
        checks: after.checks.length,
      });
    }
  }
  process.stdout.write(JSON.stringify({ status: "pass", results }, null, 2));
} finally {
  await rm(root, { recursive: true, force: true });
}

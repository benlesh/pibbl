import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { prepareDecisionPair } from "./decision-cases.mjs";
test("actual public inspection, identical applications, no prototype transform", async () => {
  const parent = await mkdtemp(resolve(tmpdir(), "pibbl-decision-"));
  try {
    const pair = resolve(parent, "pair");
    await prepareDecisionPair({ caseId: "decision-01", directory: pair });
    const a = await readFile(resolve(pair, "ordinary/app.tsx"), "utf8"),
      b = await readFile(resolve(pair, "inspection/app.tsx"), "utf8");
    assert.equal(a, b);
    const bridge = await readFile(
      resolve(pair, "inspection/inspection-bridge.mjs"),
      "utf8",
    );
    assert.match(bridge, /@pibbl\/core\/viz\/inspection/);
    assert.match(bridge, /domainXAtRoot/);
    assert.doesNotMatch(bridge, /createLineAttributionInspector/);
    const ra = await readFile(resolve(pair, "ordinary/runtime.mjs")),
      rb = await readFile(resolve(pair, "inspection/runtime.mjs"));
    assert.deepEqual(ra, rb);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

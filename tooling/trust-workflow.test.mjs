import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "yaml";

const root = new URL("../", import.meta.url);
const { scripts } = JSON.parse(
  readFileSync(new URL("package.json", root), "utf8"),
);
const workflow = parse(
  readFileSync(new URL(".github/workflows/trust.yml", root), "utf8"),
);

test("CI runs every canonical local trust stage without a second check list", () => {
  const stages = scripts.trust.split(" && ").map((command) => {
    const match = / trust:([a-z]+)$/.exec(command);
    assert.ok(match, `Unexpected aggregate command: ${command}`);
    return match[1];
  });
  assert.deepEqual(workflow.jobs.contracts.strategy.matrix.stage, stages);
  assert.equal(new Set(stages).size, stages.length);
  for (const stage of stages) assert.ok(scripts[`trust:${stage}`]);
  assert.ok(
    workflow.jobs.contracts.steps.some(
      (step) => step.run === "pnpm run trust:${{ matrix.stage }}",
    ),
  );
  assert.equal(workflow.jobs.contracts.strategy["fail-fast"], false);
  assert.deepEqual(workflow.jobs["trust-gate"].needs, ["contracts"]);
});

test("browser trust includes the unified website against a fresh build", () => {
  assert.ok(scripts["trust:browser"].includes(" test:website"));
  assert.equal(
    scripts["test:website"],
    "corepack pnpm@11.21.0 website:build && node tooling/test-website.mjs",
  );
});

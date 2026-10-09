// Focused opt-in browser regression: a clean-control coordinate edit must be rejected.
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { preparePair } from "./prepare-pair.mjs";
import { scoreTrial } from "./judge.mjs";
const parent = await mkdtemp(resolve(tmpdir(), "pibbl-hover-oracle-"));
try {
  const pair = resolve(parent, "pair");
  await preparePair({ caseId: "case-04", directory: pair });
  const dir = resolve(pair, "ordinary");
  const code = await readFile(resolve(dir, "app.tsx"), "utf8");
  await writeFile(
    resolve(dir, "app.tsx"),
    code.replace("x.invert(event.x-55)", "x.invert(event.x)"),
  );
  const bad = await scoreTrial(dir);
  assert.equal(
    bad.status,
    "fail",
    "Coordinate regression must fail, even though center hover remains b",
  );
  await writeFile(resolve(dir, "app.tsx"), code);
  const good = await scoreTrial(dir);
  assert.equal(good.status, "pass");
  console.log(
    JSON.stringify({
      status: "pass",
      regression: bad.checks.filter((c) => c.status === "fail"),
      restored: good.status,
    }),
  );
} finally {
  await rm(parent, { recursive: true, force: true });
}

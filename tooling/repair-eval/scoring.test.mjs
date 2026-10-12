import test from "node:test";
import assert from "node:assert/strict";
import { combineScore, reviewerTask } from "./scoring.mjs";
const review = {
  diagnosis: 5,
  repairQuality: 5,
  evidenceQuality: 5,
  uncertainty: 5,
  reasons: {
    diagnosis: "Supported",
    repairQuality: "Minimal",
    evidenceQuality: "Verified",
    uncertainty: "Bounded",
  },
};
test("80 deterministic points and 20 judged points", () => {
  const s = combineScore(
    {
      status: "fail",
      checks: Array.from({ length: 15 }, (_, i) => ({
        status: i < 12 ? "pass" : "fail",
      })),
    },
    review,
  );
  assert.equal(s.deterministic, 64);
  assert.equal(s.agentic, 20);
  assert.equal(s.total, 84);
});
test("blocked or missing checks do not become passing scores", () => {
  assert.equal(
    combineScore({ status: "blocked", checks: [] }, review).status,
    "blocked",
  );
  assert.throws(() =>
    combineScore({ status: "pass", checks: [{ status: "pass" }] }, review),
  );
});
test("reject invalid judge values and unsupported blank reasons", () => {
  assert.throws(() =>
    combineScore(
      { status: "pass", checks: Array(15).fill({ status: "pass" }) },
      { ...review, diagnosis: 6 },
    ),
  );
  assert.throws(() =>
    combineScore(
      { status: "pass", checks: Array(15).fill({ status: "pass" }) },
      { ...review, reasons: { ...review.reasons, diagnosis: "" } },
    ),
  );
});

test("reviewer explicitly permits reading its evidence", () => {
  assert.match(reviewerTask, /Read the supplied evidence files/);
  assert.doesNotMatch(
    reviewerTask,
    /Do not execute code or use other files\/tools/,
  );
});

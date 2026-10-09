import { test } from "node:test";
import assert from "node:assert/strict";
import { loopFrame, finishRun } from "./canvas-score.mjs";
import { Playback } from "./playback.mjs";
test("Canvas score shares the approved loop and safe Ready transition", () => {
  const reference = new Playback();
  reference.advance(2400);
  assert.deepEqual(loopFrame(2400), reference.frame());
  const run = finishRun(2400);
  reference.complete();
  for (const t of [0, 100, 600, 1600, 2290, run.duration]) {
    const p = new Playback();
    p.advance(2400);
    p.complete();
    p.advance(t);
    assert.deepEqual(run.sample(t), p.frame());
  }
  assert.equal(run.sample(run.duration).phase, "complete");
});

import { checkpoints, finalPoses } from "./motion.mjs";
import { identity } from "./identity.mjs";
test("each safe encounter uses exact 1600ms formation and 690ms release", () => {
  for (const checkpoint of checkpoints) {
    const start = checkpoint * 11000 - 10,
      run = finishRun(start);
    const forming = run.sample(10);
    assert.equal(forming.phase, "forming");
    assert.ok(Math.abs(run.duration - 2300) < 1e-8);
    assert.deepEqual(run.sample(1610 + 1e-7).poses, finalPoses());
    assert.equal(run.sample(1610 + 1e-7).phase, "bloom");
    const final = run.sample(run.duration);
    assert.equal(final.phase, "complete");
    final.bubbles.forEach((b, i) =>
      assert.deepEqual(
        [b.x, b.y, b.r],
        [
          identity.bubbles[i].destination.x,
          identity.bubbles[i].destination.y,
          identity.bubbles[i].destination.r,
        ],
      ),
    );
  }
});

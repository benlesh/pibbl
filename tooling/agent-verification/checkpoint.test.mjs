import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCheckpointWriter } from "./checkpoint.mjs";
import { runWithWatchdog } from "./watchdog.mjs";

test("checkpoints remain partial and an invalid replacement preserves the last complete file", async () => {
  const output = await mkdtemp(join(tmpdir(), "crc-checkpoint-"));
  try {
    const checkpoint = createCheckpointWriter(output);
    const report = { status: "pass", steps: [{ status: "pass", value: 20 }] };
    await checkpoint(report, "before-next-action");
    const read = async () =>
      JSON.parse(await readFile(join(output, "checkpoint.json"), "utf8"));
    const first = await read();
    assert.equal(first.status, "partial");
    assert.equal(first.report.status, "incomplete");
    assert.equal(first.report.steps[0].value, 20);
    assert.equal(report.status, "pass");
    assert.equal(first.sequence, 1);
    const cycle = {};
    cycle.self = cycle;
    await assert.rejects(checkpoint(cycle, "invalid"), /circular/i);
    assert.deepEqual(await read(), first);
    await assert.rejects(
      checkpoint({ payload: "x".repeat(4 * 1024 * 1024) }, "oversize"),
      /budget/,
    );
    assert.deepEqual(await read(), first);
    await checkpoint(
      {
        status: "incomplete",
        steps: [...report.steps, { status: "incomplete" }],
      },
      "next-action",
    );
    const second = await read();
    assert.equal(second.sequence, 2);
    assert.equal(second.runId, first.runId);
    assert.equal(second.stage, "next-action");
    assert.equal(second.report.steps.length, 2);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test(
  "forced replay termination retains completed checks and the last incomplete action",
  { timeout: 10000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "crc-checkpoint-kill-"));
    try {
      const script = join(directory, "hang.mjs");
      const output = join(directory, "result");
      await writeFile(
        script,
        `
      import { createCheckpointWriter } from ${JSON.stringify(new URL("./checkpoint.mjs", import.meta.url).href)};
      const checkpoint = createCheckpointWriter(process.argv[2]);
      await checkpoint({ status: 'incomplete', steps: [{ name: 'verified', status: 'pass', actual: 20 }] }, 'verified');
      await checkpoint({ status: 'incomplete', steps: [{ name: 'verified', status: 'pass', actual: 20 }, { name: 'hanging', status: 'incomplete' }] }, 'hanging');
      process.on('SIGTERM', () => {});
      while (true) {}
    `,
      );
      const watchdog = await runWithWatchdog({
        script,
        args: [output],
        output,
        deadlineMs: 700,
        graceMs: 100,
      });
      assert.equal(watchdog.status, "timeout");
      assert.equal(watchdog.childExited, true);
      const checkpoint = JSON.parse(
        await readFile(join(output, "checkpoint.json"), "utf8"),
      );
      assert.equal(checkpoint.status, "partial");
      assert.equal(checkpoint.stage, "hanging");
      assert.deepEqual(checkpoint.report.steps, [
        { name: "verified", status: "pass", actual: 20 },
        { name: "hanging", status: "incomplete" },
      ]);
      await assert.rejects(readFile(join(output, "report.json")), {
        code: "ENOENT",
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test('checkpoint elapsed time stays monotonic when wall time moves backward', async () => {
  const output = await mkdtemp(join(tmpdir(), 'crc-checkpoint-clock-'));
  let monotonic = 100;
  let wall = '2026-09-30T12:00:00.000Z';
  try {
    const checkpoint = createCheckpointWriter(output, { monotonicNow: () => monotonic, wallNow: () => wall });
    monotonic = 125;
    await checkpoint({ schema: 'crc-viz-replay/1', status: 'pass', steps: [] }, 'first');
    const first = JSON.parse(await readFile(join(output, 'checkpoint.json'), 'utf8'));
    monotonic = 150; wall = '2026-09-29T12:00:00.000Z';
    await checkpoint({ schema: 'crc-viz-replay/1', status: 'pass', steps: [] }, 'second');
    const second = JSON.parse(await readFile(join(output, 'checkpoint.json'), 'utf8'));
    assert.equal(first.timing.elapsedMs, 25);
    assert.equal(second.timing.elapsedMs, 50);
    assert.equal(second.timing.clock, 'node-monotonic');
    assert.equal(second.timing.clockId, checkpoint.runId);
    assert.ok(second.timestamp < first.timestamp);
    assert.deepEqual(first.timing.anchor, second.timing.anchor);
    monotonic = 140;
    await assert.rejects(checkpoint({ steps: [] }, 'invalid-clock'), /monotonic/);
    assert.equal(JSON.parse(await readFile(join(output, 'checkpoint.json'), 'utf8')).sequence, 2);
  } finally { await rm(output, { recursive: true, force: true }); }
});

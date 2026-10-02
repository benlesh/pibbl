import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWithWatchdog } from "./watchdog.mjs";

async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), "crc-watchdog-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test(
  "external deadline survives an infinite child loop and preserves partial evidence",
  { timeout: 10000 },
  async () => {
    await fixture(async (directory) => {
      const script = join(directory, "hang.mjs");
      await writeFile(
        script,
        `import { writeFileSync } from 'node:fs';
      writeFileSync(process.argv[2] + '/report.json', '{"status":"incomplete"}');
      process.on('SIGTERM', () => {});
      console.log('started');
      while (true) {}`,
      );
      const output = join(directory, "result");
      const report = await runWithWatchdog({
        script,
        args: [output],
        output,
        deadlineMs: 700,
        graceMs: 100,
      });
      assert.equal(report.status, "timeout");
      assert.equal(report.exitSignal, "SIGKILL");
      assert.equal(report.childExited, true);
      assert.ok(report.elapsedMs < 5000);
      assert.match(report.stdout.text, /started/);
      assert.deepEqual(
        JSON.parse(await readFile(join(output, "report.json"), "utf8")),
        { status: "incomplete" },
      );
      assert.deepEqual(
        JSON.parse(await readFile(join(output, "watchdog.json"), "utf8")),
        report,
      );
      assert.throws(() => process.kill(report.pid, 0), { code: "ESRCH" });
    });
  },
);

test("exit status is separate from semantic success and diagnostics are bounded", async () => {
  await fixture(async (directory) => {
    const script = join(directory, "exit.mjs");
    await writeFile(
      script,
      `process.stdout.write('x'.repeat(100000)); process.stderr.write('failure'); process.exitCode = 3;`,
    );
    const report = await runWithWatchdog({
      script,
      output: join(directory, "failure"),
      deadlineMs: 5000,
    });
    assert.equal(report.status, "exited");
    assert.equal(report.exitCode, 3);
    assert.equal(report.stdout.text.length, 16384);
    assert.equal(report.stdout.truncated, true);
    assert.equal(report.stderr.text, "failure");
    await writeFile(script, "");
    const success = await runWithWatchdog({
      script,
      output: join(directory, "success"),
      deadlineMs: 5000,
    });
    assert.equal(success.status, "exited");
    assert.equal(success.exitCode, 0);
  });
});

test("rejects reused evidence directories and invalid deadlines before spawning", async () => {
  await fixture(async (directory) => {
    await assert.rejects(
      runWithWatchdog({
        script: "unused",
        output: directory,
        deadlineMs: 5000,
      }),
      { code: "EEXIST" },
    );
    await assert.rejects(
      runWithWatchdog({
        script: "unused",
        output: join(directory, "invalid"),
        deadlineMs: NaN,
      }),
      /deadline/,
    );
  });
});

test("a cooperative zero exit after the deadline is still a timeout", async () => {
  await fixture(async (directory) => {
    const script = join(directory, "cooperative.mjs");
    await writeFile(
      script,
      `process.on('SIGTERM', () => process.exit(0)); setInterval(() => {}, 1000);`,
    );
    const report = await runWithWatchdog({
      script,
      output: join(directory, "result"),
      deadlineMs: 700,
      graceMs: 200,
    });
    assert.equal(report.status, "timeout");
    assert.equal(report.childExited, true);
    assert.equal(report.exitCode, 0);
  });
});

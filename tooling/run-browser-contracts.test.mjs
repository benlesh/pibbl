import assert from "node:assert/strict";
import { test } from "node:test";
import { runBrowserContracts } from "./run-browser-contracts.mjs";

const inventory = (count) =>
  JSON.stringify(
    Array.from({ length: count }, (_, i) => ({
      file: `/tests/${i}.test.ts`,
      projectName: "chromium",
    })),
  );

test("discovers all tests and bounds each fresh-browser shard as the suite grows", () => {
  for (const count of [1, 16, 17, 383, 1000]) {
    const calls = [];
    assert.equal(
      runBrowserContracts(
        (command, args, options) => {
          calls.push({ command, args, options });
          return { status: 0, stdout: inventory(count) };
        },
        () => {},
      ),
      0,
    );
    assert.deepEqual(calls[0].args.slice(1), ["list", "--filesOnly", "--json"]);
    const shards = Math.ceil(count / 16);
    assert.equal(calls.length, shards + 1);
    assert.deepEqual(
      calls.slice(1).map(({ args }) => args.at(-1)),
      Array.from({ length: shards }, (_, i) => `--shard=${i + 1}/${shards}`),
    );
    for (const { command, args, options } of calls.slice(1)) {
      assert.equal(command, process.execPath);
      assert.ok(args.includes("--maxWorkers=1"));
      assert.equal(options.stdio, "inherit");
      assert.ok(
        options.timeout > 0,
        "stalled Chromium must not hang indefinitely",
      );
    }
  }
});

test("discovery failure, empty discovery, or malformed discovery cannot pass", () => {
  assert.equal(
    runBrowserContracts(
      () => ({ status: 7 }),
      () => {},
    ),
    7,
  );
  for (const stdout of ["[]", "not JSON", "{}", "[{}]"]) {
    assert.throws(() =>
      runBrowserContracts(
        () => ({ status: 0, stdout }),
        () => {},
      ),
    );
  }
});

test("a failed or crashed shard fails without retrying or running later shards", () => {
  for (const failure of [{ status: 7 }, { status: null, signal: "SIGKILL" }]) {
    let calls = 0;
    const status = runBrowserContracts(
      () => (++calls === 3 ? failure : { status: 0, stdout: inventory(100) }),
      () => {},
    );
    assert.equal(status, failure.status ?? 1);
    assert.equal(calls, 3);
  }
});

test('browser discovery includes runtime tests and excludes Node-runner tooling', async () => {
  const { execFileSync } = await import('node:child_process');
  const { createRequire } = await import('node:module');
  const { dirname, join } = await import('node:path');
  const require = createRequire(import.meta.url);
  const cli = join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs');
  const files = JSON.parse(execFileSync(process.execPath, [cli, 'list', '--filesOnly', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  assert.ok(files.some(({ file }) => file.endsWith('/packages/core/test/smoke-scenario.test.ts')));
  assert.deepEqual(files.filter(({ file }) => file.includes('/tooling/') && file.endsWith('.test.mjs')), []);
});

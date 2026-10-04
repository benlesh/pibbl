import assert from "node:assert/strict";
import { test } from "node:test";
import { runBrowserContracts } from "./run-browser-contracts.mjs";

test("runs every shard once in separate bounded browser invocations", () => {
  const calls = [];
  assert.equal(
    runBrowserContracts((command, args, options) => {
      calls.push({ command, args, options });
      return { status: 0 };
    }),
    0,
  );
  assert.equal(calls.length, 8);
  assert.deepEqual(
    calls.map(({ args }) => args.at(-1)),
    Array.from({ length: 8 }, (_, index) => `--shard=${index + 1}/8`),
  );
  for (const { command, args, options } of calls) {
    assert.equal(command, process.execPath);
    assert.ok(args.includes("--maxWorkers=1"));
    assert.equal(options.stdio, "inherit");
  }
});

test("a failed or crashed shard fails the gate without retrying or running later shards", () => {
  for (const failure of [{ status: 7 }, { status: null, signal: "SIGKILL" }]) {
    let calls = 0;
    const status = runBrowserContracts(() =>
      ++calls === 3 ? failure : { status: 0 },
    );
    assert.equal(status, failure.status ?? 1);
    assert.equal(calls, 3);
  }
});

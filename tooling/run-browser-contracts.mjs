import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const cli = join(dirname(require.resolve("vitest/package.json")), "vitest.mjs");
const shardCount = 8;

// A fresh Vitest/Chromium lifetime per shard bounds retained browser state.
// Vitest partitions the complete discovered suite; no file list is copied here.
export function runBrowserContracts(run = spawnSync) {
  for (let shard = 1; shard <= shardCount; shard++) {
    const result = run(
      process.execPath,
      [
        cli,
        "run",
        "--browser.headless",
        "--maxWorkers=1",
        `--shard=${shard}/${shardCount}`,
      ],
      { stdio: "inherit" },
    );
    if (result.status !== 0) return result.status ?? 1;
  }
  return 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = runBrowserContracts();
}

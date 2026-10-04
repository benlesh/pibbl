import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const cli = join(dirname(require.resolve("vitest/package.json")), "vitest.mjs");
const maxFilesPerBrowser = 16;
const watchdogMilliseconds = 5 * 60 * 1000;

// A fresh Vitest/Chromium lifetime per shard bounds retained browser state.
// Vitest partitions the complete discovered suite; no file list is copied here.
export function runBrowserContracts(
  run = spawnSync,
  report = (message) => process.stdout.write(`${message}\n`),
) {
  const discovery = run(
    process.execPath,
    [cli, "list", "--filesOnly", "--json"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
      timeout: watchdogMilliseconds,
    },
  );
  if (discovery.status !== 0) return discovery.status ?? 1;
  const files = JSON.parse(discovery.stdout);
  if (
    !Array.isArray(files) ||
    !files.length ||
    files.some((file) => typeof file.file !== "string")
  ) {
    throw new Error(
      "Vitest must discover a nonempty test-file inventory before browser verification.",
    );
  }
  const shardCount = Math.ceil(files.length / maxFilesPerBrowser);
  for (let shard = 1; shard <= shardCount; shard++) {
    report(
      `Browser contracts: shard ${shard}/${shardCount} (${files.length} discovered files, at most ${maxFilesPerBrowser} per browser).`,
    );
    const result = run(
      process.execPath,
      [
        cli,
        "run",
        "--browser.headless",
        "--maxWorkers=1",
        `--shard=${shard}/${shardCount}`,
      ],
      { stdio: "inherit", timeout: watchdogMilliseconds },
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

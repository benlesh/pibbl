import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { root } from "./common.mjs";

// Node options must precede test paths. Package-manager arguments otherwise land
// after the shell-expanded file list and can silently fail to filter the suite.
const files = (await readdir(new URL("../test/", import.meta.url)))
  .filter((name) => name.endsWith(".test.mjs"))
  .sort()
  .map((name) => `test/${name}`);
const result = spawnSync(
  process.execPath,
  ["--test", ...process.argv.slice(2), ...files],
  {
    cwd: root,
    stdio: "inherit",
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

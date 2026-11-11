import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

test("dependency directories and symlinks are never tracked", () => {
  const trackedPaths = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  }).split("\0");
  const dependencies = trackedPaths.filter((path) =>
    path.split("/").includes("node_modules"),
  );
  assert.deepEqual(
    dependencies,
    [],
    "Remove machine-local dependencies from Git",
  );
});

test("Git ignores dependency directories and machine-local symlink paths", () => {
  const paths = [
    "node_modules",
    "packages/core/node_modules",
    "__ignore_probe__/node_modules",
    "__ignore_probe__/node_modules/example/package.json",
  ];
  const ignoredPaths = execFileSync(
    "git",
    ["check-ignore", "--no-index", "--stdin"],
    { cwd: root, encoding: "utf8", input: `${paths.join("\n")}\n` },
  )
    .trim()
    .split(/\r?\n/);
  assert.deepEqual(ignoredPaths, paths);
});

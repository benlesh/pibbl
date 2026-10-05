import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { spawnSync } from "node:child_process";

test("complete minimal shape programs typecheck against public packages", async () => {
  const root = resolve(import.meta.dirname, "..");
  const dir = resolve(root, "website/public/generated/minimal");
  const paths = (await readdir(dir))
    .filter((path) => path.endsWith(".tsx"))
    .map((path) => resolve(dir, path));
  assert.equal(paths.length, 13);
  const result = spawnSync(
    resolve(root, "node_modules/.bin/tsc"),
    [
      "--ignoreConfig",
      "--noEmit",
      "--strict",
      "--skipLibCheck",
      "--target",
      "ES2022",
      "--module",
      "ESNext",
      "--moduleResolution",
      "Bundler",
      "--jsx",
      "react-jsx",
      "--jsxImportSource",
      "@crc/core",
      ...paths,
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const path of paths)
    assert.match(await readFile(path, "utf8"), /controller.dispose\(\)/);
});

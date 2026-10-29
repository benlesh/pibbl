import assert from "node:assert/strict";
import {
  readdir,
  readFile,
  writeFile,
  mkdtemp,
  rm,
  mkdir,
} from "node:fs/promises";
import { resolve, relative, dirname } from "node:path";
import { test } from "node:test";
import { spawnSync } from "node:child_process";

test("complete minimal programs typecheck against public packages", async () => {
  const root = resolve(import.meta.dirname, "..");
  const dir = resolve(root, "website/public/generated/minimal");
  const paths = (await readdir(dir, { recursive: true }))
    .filter((path) => /\.tsx?$/.test(path))
    .map((path) => resolve(dir, path));
  assert.ok(paths.length >= 13);
  const examples = await Promise.all(
    paths.map(async (path) => ({
      path: relative(dir, path),
      source: await readFile(path, "utf8"),
    })),
  );
  const directory = await mkdtemp(resolve(root, ".pibbl-minimal-examples-"));
  const sources = resolve(directory, "sources");
  const copied = await Promise.all(
    examples.map(async ({ path, source }) => {
      const destination = resolve(sources, path);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, source);
      return destination;
    }),
  );
  const config = resolve(directory, "tsconfig.json");
  await writeFile(
    config,
    JSON.stringify({
      extends: `./${relative(directory, resolve(root, "tsconfig.json"))}`,
      files: copied,
    }),
  );
  const result = spawnSync(
    resolve(root, "node_modules/.bin/tsc"),
    ["--project", config],
    {
      cwd: root,
      encoding: "utf8",
    },
  );
  await rm(directory, { recursive: true, force: true });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const { source } of examples) {
    if (/const controller\s*=\s*pibbl\(/.test(source))
      assert.match(source, /controller.dispose\(\)/);
  }
});

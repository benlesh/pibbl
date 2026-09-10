import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

const workspaceRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputDirectory = resolve(workspaceRoot, "playground/dist");
const bundlePaths = (await readdir(outputDirectory, { recursive: true }))
  .filter((path) => /\.(?:css|html|js|map)$/u.test(path))
  .sort((left, right) => left.localeCompare(right, "en"));

assert.ok(
  bundlePaths.length > 0,
  "Normal Studio production output must contain inspectable browser bundles.",
);
const output = await Promise.all(
  bundlePaths.map(async (path) => [
    path,
    await readFile(join(outputDirectory, path), "utf8"),
  ]),
);
for (const marker of [
  "crcStudioSearchRetry",
  "Intentional verifier search loader failure.",
  "createAcceptanceSearchLoaderOptions",
]) {
  for (const [path, source] of output) {
    assert.doesNotMatch(
      source,
      new RegExp(marker.replaceAll(/[.]/gu, "\\."), "u"),
      `Normal Studio bundle ${path} must not contain acceptance-only ${marker}.`,
    );
  }
}

process.stdout.write(
  `Validated ${bundlePaths.length} normal Studio browser bundles exclude acceptance-only retry behavior.\n`,
);

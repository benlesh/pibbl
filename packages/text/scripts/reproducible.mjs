import assert from "node:assert/strict";
import { resolve } from "node:path";
import { root, run } from "./common.mjs";
import { artifactHashes, directoryFiles } from "./lib/files.mjs";
const output = resolve(root, "dist");
const build = () =>
  run(process.execPath, [
    resolve(root, "scripts/build.mjs"),
    "--offline",
    "--rebuild-native",
  ]);
build();
const first = await artifactHashes(output, await directoryFiles(output));
build();
const second = await artifactHashes(output, await directoryFiles(output));
assert.deepEqual(
  second,
  first,
  "Clean native rebuilds must produce identical distributed files on the same host.",
);
process.stdout.write(
  `Reproducibility verified for ${Object.keys(first).length} distributed files on ${process.platform}/${process.arch}.\n`,
);

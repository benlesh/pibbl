import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { prepareTrial } from "./prepare.mjs";
export async function preparePair({ caseId, directory }) {
  directory = resolve(directory);
  await mkdir(directory, { recursive: false });
  for (const arm of ["ordinary", "attribution"])
    await prepareTrial({ caseId, arm, directory: resolve(directory, arm) });
  const ordinary = JSON.parse(
    await readFile(resolve(directory, "ordinary/trial.json"), "utf8"),
  );
  const attribution = JSON.parse(
    await readFile(resolve(directory, "attribution/trial.json"), "utf8"),
  );
  assert.equal(
    ordinary.initialSourceHash,
    attribution.initialSourceHash,
    "Application source differs between arms",
  );
  const core = (receipt) =>
    Object.fromEntries(
      Object.entries(receipt)
        .filter(([path]) => path.startsWith("packages/core/"))
        .sort(([a], [b]) => a.localeCompare(b)),
    );
  assert.deepEqual(
    core(ordinary.runtimeSources),
    core(attribution.runtimeSources),
    "Core source changed between arms; discard this pair and prepare again from a stable checkout",
  );
  await writeFile(
    resolve(directory, "initial-app.tsx"),
    await readFile(resolve(directory, "ordinary/app.tsx")),
  );
  const receipt = {
    caseId,
    applicationSourceMatched: true,
    coreSourcesMatched: true,
    arms: ["ordinary", "attribution"],
    note: "Keep this parent directory and the opposite arm outside each agent workspace. Blinding is procedural.",
  };
  await writeFile(
    resolve(directory, "pair.json"),
    JSON.stringify(receipt, null, 2),
  );
  return receipt;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (process.argv.length !== 4)
    throw new Error(
      "Usage: node prepare-pair.mjs CASE_ID NEW_PARENT_DIRECTORY",
    );
  process.stdout.write(
    JSON.stringify(
      await preparePair({
        caseId: process.argv[2],
        directory: process.argv[3],
      }),
    ) + "\n",
  );
}

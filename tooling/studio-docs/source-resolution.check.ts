import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectPublicExports, pibblPublicCompilerOptions } from "./api-exports";

// No node_modules or dist exists beside this consumer. Public source discovery
// must resolve self-imports through the same source mappings as the repository.
const directory = await mkdtemp(join(tmpdir(), "pibbl-source-discovery-"));
try {
  const entry = join(directory, "index.ts");
  await writeFile(entry, 'export { pibbl } from "@pibbl/core";\n');
  const inventory = await collectPublicExports(
    { root: entry },
    pibblPublicCompilerOptions,
  );
  assert.deepEqual(inventory.root.values, ["pibbl"]);
} finally {
  await rm(directory, { recursive: true, force: true });
}

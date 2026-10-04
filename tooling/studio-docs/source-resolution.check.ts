import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectPublicExports, crcPublicCompilerOptions } from "./api-exports";

// No node_modules or dist exists beside this consumer. Public source discovery
// must resolve self-imports through the same source mappings as the repository.
const directory = await mkdtemp(join(tmpdir(), "crc-source-discovery-"));
try {
  const entry = join(directory, "index.ts");
  await writeFile(entry, 'export { crc } from "@crc/core";\n');
  const inventory = await collectPublicExports(
    { root: entry },
    crcPublicCompilerOptions,
  );
  assert.deepEqual(inventory.root.values, ["crc"]);
} finally {
  await rm(directory, { recursive: true, force: true });
}

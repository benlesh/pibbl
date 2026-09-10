import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { StudioDocumentationExampleInput } from "./build";

/**
 * Reads the learning catalog in a short-lived TypeScript-aware Node process.
 * Vite's config loader otherwise follows the catalog's TSX example imports
 * while loading this plugin, before the application's automatic JSX runtime is
 * configured. The serialized data is the manifest's supported catalog shape.
 */
export function loadStudioLearningExamples(
  repositoryRoot: string,
): readonly StudioDocumentationExampleInput[] {
  const catalogUrl = pathToFileURL(
    join(repositoryRoot, "packages/scenarios/src/learning-catalog.ts"),
  ).href;
  const program = [
    `import { learningExampleCatalog } from ${JSON.stringify(catalogUrl)};`,
    "const examples = learningExampleCatalog.map(({ slug, title, shortTitle, section, browseGroup, summary, api, objectives, apiNotes, source }) => ({ slug, title, shortTitle, section, browseGroup, summary, api, objectives, apiNotes, source: { path: source.path } }));",
    "process.stdout.write(JSON.stringify(examples));",
  ].join("\n");
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "--eval", program],
    { cwd: repositoryRoot, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(
      `Could not load the learning example catalog for Studio documentation:\n${result.stderr}`,
    );
  }
  return JSON.parse(result.stdout) as StudioDocumentationExampleInput[];
}

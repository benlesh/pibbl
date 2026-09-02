import type { LearningExampleCatalogEntry } from "@crc/scenarios";

const rawSourceModules = import.meta.glob(
  "../../packages/scenarios/src/learning/**/*.example.tsx",
  { import: "default", query: "?raw" },
) as Readonly<Record<string, () => Promise<string>>>;

const SOURCE_PREFIX = "../../";
const sourceLoaderByPath = new Map(
  Object.entries(rawSourceModules).map(([path, load]) => [
    path.startsWith(SOURCE_PREFIX) ? path.slice(SOURCE_PREFIX.length) : path,
    load,
  ]),
);

export const learningSourcePaths = Object.freeze(
  [...sourceLoaderByPath.keys()].sort(),
);

export async function loadLearningSource(
  entry: LearningExampleCatalogEntry,
): Promise<string> {
  const load = sourceLoaderByPath.get(entry.source.path);
  if (!load)
    throw new Error(
      `No learning source adapter matches "${entry.source.path}".`,
    );
  const source = await load();
  if (
    !source.includes(
      "export default function mount(canvas: HTMLCanvasElement): CRCController",
    )
  ) {
    throw new Error(
      `Learning source "${entry.source.path}" does not expose the canonical mount contract.`,
    );
  }
  return source;
}

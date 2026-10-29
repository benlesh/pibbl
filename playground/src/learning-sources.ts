import type { WorkbenchSourceMetadata } from "@pibbl/scenarios";
import { parse } from "@babel/parser";

const learningModules = import.meta.glob(
  "../../packages/scenarios/src/learning/**/*.example.tsx",
  { import: "default", query: "?raw" },
) as Readonly<Record<string, () => Promise<string>>>;
const tutorialModules = import.meta.glob(
  "../../packages/scenarios/src/tutorials/**/*.example.tsx",
  { import: "default", query: "?raw" },
) as Readonly<Record<string, () => Promise<string>>>;

const SOURCE_PREFIX = "../../";
function sourceLoaders(
  modules: Readonly<Record<string, () => Promise<string>>>,
): ReadonlyMap<string, () => Promise<string>> {
  return new Map(
    Object.entries(modules).map(([path, load]) => [
      path.startsWith(SOURCE_PREFIX) ? path.slice(SOURCE_PREFIX.length) : path,
      load,
    ]),
  );
}

function sourcePaths(
  modules: Readonly<Record<string, () => Promise<string>>>,
): readonly string[] {
  return Object.freeze([...sourceLoaders(modules).keys()].sort());
}

const sourceLoaderByPath = new Map([
  ...sourceLoaders(learningModules),
  ...sourceLoaders(tutorialModules),
]);

export const learningSourcePaths = sourcePaths(learningModules);
export const tutorialSourcePaths = sourcePaths(tutorialModules);
export const workbenchSourcePaths = Object.freeze(
  [...learningSourcePaths, ...tutorialSourcePaths].sort(),
);

export async function loadWorkbenchSource(
  entry: WorkbenchSourceMetadata,
): Promise<string> {
  const load = sourceLoaderByPath.get(entry.source.path);
  if (!load)
    throw new Error(
      `No workbench source adapter matches "${entry.source.path}".`,
    );
  const source = await load();
  const exportName = entry.source.exportName;
  const hasEntry = parse(source, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  }).program.body.some(
    (statement) =>
      statement.type === "ExportNamedDeclaration" &&
      statement.declaration?.type === "FunctionDeclaration" &&
      statement.declaration.id?.name === exportName &&
      !statement.declaration.async &&
      !statement.declaration.generator,
  );
  if (!hasEntry) {
    throw new Error(
      `Workbench source "${entry.source.path}" must export the named component "${exportName}".`,
    );
  }
  return source;
}

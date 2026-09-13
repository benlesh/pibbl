import { readdir } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

function displayList(values: readonly string[]): string {
  return values.length ? values.join(', ') : '(none)';
}

function assertPathSetMatches(
  label: string,
  discoveredPaths: readonly string[],
  catalogPaths: readonly string[],
): void {
  const discovered = [...discoveredPaths].sort();
  const catalog = [...catalogPaths].sort();
  if (discovered.join('\n') === catalog.join('\n')) return;

  const catalogSet = new Set(catalog);
  const discoveredSet = new Set(discovered);
  const omitted = discovered.filter(path => !catalogSet.has(path));
  const missing = catalog.filter(path => !discoveredSet.has(path));
  throw new Error(
    `${label} source discovery disagrees with the catalog. ` +
    `Omitted: ${displayList(omitted)}. Missing: ${displayList(missing)}.`,
  );
}

export async function discoverExampleSourcePaths(
  scenarioDirectory: string,
  workspaceRoot: string,
): Promise<string[]> {
  return (await readdir(scenarioDirectory, { recursive: true }))
    .filter(name => name.endsWith('.example.tsx'))
    .map(name => relative(
      workspaceRoot,
      resolve(scenarioDirectory, name),
    ).replaceAll('\\', '/'))
    .sort();
}

export function assertExampleSourceDiscovery(
  discoveredPaths: readonly string[],
  scenarioCatalogPaths: readonly string[],
  learningCatalogPaths: readonly string[],
  tutorialCatalogPaths: readonly string[],
): void {
  const learningPaths = discoveredPaths.filter(path => path.includes('/learning/'));
  const tutorialPaths = discoveredPaths.filter(path => path.includes('/tutorials/'));
  const testPaths = discoveredPaths.filter(
    path => !path.includes('/learning/') && !path.includes('/tutorials/'),
  );
  assertPathSetMatches('Scenario', testPaths, scenarioCatalogPaths);
  assertPathSetMatches('Learning', learningPaths, learningCatalogPaths);
  assertPathSetMatches('Tutorial', tutorialPaths, tutorialCatalogPaths);
}

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
    .filter(name => /\.example\.tsx?$/u.test(name))
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
): void {
  const legacyPaths = discoveredPaths.filter(path => path.endsWith('.example.ts'));
  if (legacyPaths.length > 0) {
    throw new Error(
      `Legacy .example.ts sources are forbidden: ${displayList(legacyPaths)}.`,
    );
  }

  const learningPaths = discoveredPaths.filter(path => path.includes('/learning/'));
  const testPaths = discoveredPaths.filter(path => !path.includes('/learning/'));
  assertPathSetMatches('Scenario', testPaths, scenarioCatalogPaths);
  assertPathSetMatches('Learning', learningPaths, learningCatalogPaths);
}

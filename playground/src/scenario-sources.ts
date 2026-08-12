import type { ScenarioCatalogRecord } from '@crc/scenarios';

const rawSourceModules = import.meta.glob(
  [
    '../../packages/scenarios/src/**/*.example.ts',
    '!../../packages/scenarios/src/learning/**/*.example.ts',
  ],
  {
    eager: true,
    import: 'default',
    query: '?raw',
  },
) as Readonly<Record<string, string>>;

const SOURCE_PREFIX = '../../';
const sourceTextByPath = new Map(
  Object.entries(rawSourceModules)
    .filter(([path]) => !path.includes('/learning/'))
    .map(([path, sourceText]) => [
      path.startsWith(SOURCE_PREFIX) ? path.slice(SOURCE_PREFIX.length) : path,
      sourceText,
    ]),
);

export const scenarioSourcePaths = Object.freeze(
  [...sourceTextByPath.keys()].sort(),
);

export async function loadScenarioSource(
  entry: ScenarioCatalogRecord,
): Promise<string> {
  const sourceText = sourceTextByPath.get(entry.source.path);
  if (!sourceText) {
    throw new Error(`No source adapter matches scenario source "${entry.source.path}".`);
  }
  if (!sourceText.includes(entry.source.marker)) {
    throw new Error(`Displayed source does not contain marker "${entry.source.id}".`);
  }
  return sourceText;
}

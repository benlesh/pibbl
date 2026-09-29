import hoverSource from "../../packages/scenarios/src/learning/composition/viz-hover-comparison.example.tsx?raw";
import pointsSource from '../../packages/scenarios/src/learning/composition/viz-points-and-inspection.example.tsx?raw';
import type { ScenarioCatalogRecord } from '@crc/scenarios';
import vizSource from '../../packages/scenarios/src/learning/composition/viz-responsive-line.example.tsx?raw';

const rawSourceModules = import.meta.glob(
  [
    '../../packages/scenarios/src/**/*.example.tsx',
    '!../../packages/scenarios/src/learning/**/*.example.tsx',
    '!../../packages/scenarios/src/tutorials/**/*.example.tsx',
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

// The visualization lab intentionally drives this exact public lesson.
sourceTextByPath.set('packages/scenarios/src/learning/composition/viz-responsive-line.example.tsx', vizSource);

sourceTextByPath.set('packages/scenarios/src/learning/composition/viz-points-and-inspection.example.tsx', pointsSource);

sourceTextByPath.set("packages/scenarios/src/learning/composition/viz-hover-comparison.example.tsx", hoverSource);

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

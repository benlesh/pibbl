import type { ScenarioCatalogRecord } from '@crc/scenarios';
import smokeSource from '../../packages/scenarios/src/smoke.example.ts?raw';

interface ScenarioSourceAdapter {
  path: string;
  sourceText: string;
}

const sourceAdapters: Readonly<Record<string, ScenarioSourceAdapter>> = {
  'baseline-smoke-example': {
    path: 'packages/scenarios/src/smoke.example.ts',
    sourceText: smokeSource,
  },
};

export async function loadScenarioSource(
  entry: ScenarioCatalogRecord,
): Promise<string> {
  const adapter = sourceAdapters[entry.source.id];
  if (!adapter || adapter.path !== entry.source.path) {
    throw new Error(`No source adapter matches scenario source "${entry.source.id}".`);
  }
  const sourceMarker = `SMOKE_SOURCE_ID = '${entry.source.id}'`;
  if (!adapter.sourceText.includes(sourceMarker)) {
    throw new Error(`Displayed source does not contain marker "${entry.source.id}".`);
  }
  return adapter.sourceText;
}

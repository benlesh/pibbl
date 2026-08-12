import type { ScenarioCatalogRecord } from '@crc/scenarios';
import geometryMatrixSource from '../../packages/scenarios/src/geometry-matrix.example.ts?raw';
import smokeSource from '../../packages/scenarios/src/smoke.example.ts?raw';
import interactionLabSource from '../../packages/scenarios/src/interaction-lab.example.ts?raw';
import lifecycleLabSource from '../../packages/scenarios/src/lifecycle-lab.example.ts?raw';
import mouseContractSource from '../../packages/scenarios/src/mouse-contract.example.ts?raw';

interface ScenarioSourceAdapter {
  path: string;
  sourceText: string;
}

const sourceAdapters: Readonly<Record<string, ScenarioSourceAdapter>> = {
  'baseline-smoke-example': {
    path: 'packages/scenarios/src/smoke.example.ts',
    sourceText: smokeSource,
  },
  'interaction-trace-lab-example': {
    path: 'packages/scenarios/src/interaction-lab.example.ts',
    sourceText: interactionLabSource,
  },
  'event-lifecycle-lab-example': {
    path: 'packages/scenarios/src/lifecycle-lab.example.ts',
    sourceText: lifecycleLabSource,
  },
  'mouse-interaction-contract-example': {
    path: 'packages/scenarios/src/mouse-contract.example.ts',
    sourceText: mouseContractSource,
  },
  'geometry-composition-matrix-example': {
    path: 'packages/scenarios/src/geometry-matrix.example.ts',
    sourceText: geometryMatrixSource,
  },
};

export async function loadScenarioSource(
  entry: ScenarioCatalogRecord,
): Promise<string> {
  const adapter = sourceAdapters[entry.source.id];
  if (!adapter || adapter.path !== entry.source.path) {
    throw new Error(`No source adapter matches scenario source "${entry.source.id}".`);
  }
  if (!adapter.sourceText.includes(entry.source.marker)) {
    throw new Error(`Displayed source does not contain marker "${entry.source.id}".`);
  }
  return adapter.sourceText;
}

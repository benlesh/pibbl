import type { SmokeScenarioState } from './smoke.example';
import type {
  ScenarioCatalogEntry,
  ScenarioCatalogRecord,
  ScenarioDefinition,
  ScenarioMetadata,
} from './types';

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VISIBILITIES = new Set(['documentation-candidate', 'test-laboratory']);
const MATURITIES = new Set(['baseline', 'characterization', 'contract', 'trusted']);

function assertNonEmpty(value: string, field: string, scenarioId: string): void {
  if (!value.trim()) {
    throw new Error(`Scenario "${scenarioId}" has an empty ${field}.`);
  }
}

function validateMetadata(metadata: ScenarioMetadata): void {
  assertNonEmpty(metadata.id, 'id', metadata.id || '<unknown>');
  assertNonEmpty(metadata.slug, 'slug', metadata.id);
  assertNonEmpty(metadata.title, 'title', metadata.id);
  assertNonEmpty(metadata.summary, 'summary', metadata.id);
  assertNonEmpty(metadata.category, 'category', metadata.id);
  assertNonEmpty(metadata.visibilityReason, 'visibilityReason', metadata.id);

  if (!ID_PATTERN.test(metadata.id) || !ID_PATTERN.test(metadata.slug)) {
    throw new Error(`Scenario "${metadata.id}" must use kebab-case id and slug values.`);
  }
  if (!VISIBILITIES.has(metadata.visibility)) {
    throw new Error(`Scenario "${metadata.id}" has an unsupported visibility.`);
  }
  if (!MATURITIES.has(metadata.maturity)) {
    throw new Error(`Scenario "${metadata.id}" has an unsupported maturity.`);
  }
  if (!metadata.apiTags.length || !metadata.conceptTags.length) {
    throw new Error(`Scenario "${metadata.id}" must provide API and concept tags.`);
  }
  if (!metadata.manualSteps.length) {
    throw new Error(`Scenario "${metadata.id}" must provide manual steps.`);
  }

  for (const [index, step] of metadata.manualSteps.entries()) {
    assertNonEmpty(step.action, `manualSteps[${index}].action`, metadata.id);
    assertNonEmpty(step.expected, `manualSteps[${index}].expected`, metadata.id);
  }
  for (const [index, tag] of metadata.apiTags.entries()) {
    assertNonEmpty(tag, `apiTags[${index}]`, metadata.id);
  }
  for (const [index, tag] of metadata.conceptTags.entries()) {
    assertNonEmpty(tag, `conceptTags[${index}]`, metadata.id);
  }
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function validateScenarioCatalog<
  TCatalog extends readonly ScenarioCatalogRecord[],
>(catalog: TCatalog): TCatalog {
  const ids = new Set<string>();
  const slugs = new Set<string>();

  for (const scenario of catalog) {
    validateMetadata(scenario.metadata);
    assertNonEmpty(scenario.source.id, 'source.id', scenario.metadata.id);
    assertNonEmpty(scenario.source.path, 'source.path', scenario.metadata.id);
    if (scenario.source.language !== 'ts' || !scenario.source.path.endsWith('.ts')) {
      throw new Error(`Scenario "${scenario.metadata.id}" must reference TypeScript source.`);
    }
    if (!Number.isInteger(scenario.canvas.width) || scenario.canvas.width <= 0 ||
      !Number.isInteger(scenario.canvas.height) || scenario.canvas.height <= 0) {
      throw new Error(`Scenario "${scenario.metadata.id}" must use positive integral canvas dimensions.`);
    }

    const actionIds = new Set<string>();
    for (const action of scenario.actions) {
      assertNonEmpty(action.id, 'action.id', scenario.metadata.id);
      assertNonEmpty(action.label, 'action.label', scenario.metadata.id);
      if (!ID_PATTERN.test(action.id) || actionIds.has(action.id)) {
        throw new Error(`Scenario "${scenario.metadata.id}" has an invalid or duplicate action id.`);
      }
      actionIds.add(action.id);
    }

    if (ids.has(scenario.metadata.id)) {
      throw new Error(`Duplicate scenario id "${scenario.metadata.id}".`);
    }
    if (slugs.has(scenario.metadata.slug)) {
      throw new Error(`Duplicate scenario slug "${scenario.metadata.slug}".`);
    }
    ids.add(scenario.metadata.id);
    slugs.add(scenario.metadata.slug);
  }

  return catalog;
}

export async function loadScenario<TState>(
  entry: ScenarioCatalogEntry<TState>,
): Promise<ScenarioDefinition<TState>> {
  const definition = await entry.load();
  const actionIds = entry.actions.map(action => action.id);
  if (definition.id !== entry.metadata.id) {
    throw new Error(`Loaded scenario id "${definition.id}" does not match catalog id "${entry.metadata.id}".`);
  }
  if (definition.sourceId !== entry.source.id) {
    throw new Error(`Loaded scenario "${definition.id}" does not match source "${entry.source.id}".`);
  }
  if (!sameValues(definition.actionIds, actionIds)) {
    throw new Error(`Loaded scenario "${definition.id}" actions do not match its catalog entry.`);
  }
  return definition;
}

const smokeMetadata: ScenarioMetadata = {
  id: 'baseline-smoke',
  slug: 'baseline-smoke',
  title: 'Baseline smoke',
  summary: 'Mount, render, update, click, and reset one public-API CRC scene.',
  category: 'Getting started',
  apiTags: ['crc', 'defineComp', 'rect', 'text'],
  conceptTags: ['mount', 'render', 'state update', 'mouse click'],
  manualSteps: [
    {
      action: 'Open the scenario or choose Reset.',
      expected: 'A blue rectangle reports revision 0, clicks 0, and reset/mount as the last action.',
    },
    {
      action: 'Choose Update scene.',
      expected: 'The rectangle turns purple and the revision increases by one.',
    },
    {
      action: 'Click inside the colored rectangle.',
      expected: 'The rectangle turns orange and the click count increases by one.',
    },
    {
      action: 'Choose Reset.',
      expected: 'The blue initial scene returns with revision 0 and clicks 0.',
    },
  ],
  knownLimitations: [
    'This baseline covers Chromium mouse input only; broader browser and input coverage belongs to later plan steps.',
    'The Canvas click target has no keyboard equivalent in the current public API.',
  ],
  visibility: 'documentation-candidate',
  visibilityReason: 'It is a minimal, readable public-API introduction without test-only diagnostics.',
  maturity: 'baseline',
};

export const smokeScenarioEntry: ScenarioCatalogEntry<SmokeScenarioState> = {
  metadata: smokeMetadata,
  canvas: {
    width: 480,
    height: 240,
  },
  actions: [
    { id: 'update', label: 'Update scene' },
  ],
  source: {
    id: 'baseline-smoke-example',
    language: 'ts',
    path: 'packages/scenarios/src/smoke.example.ts',
  },
  load: async () => (await import('./smoke')).smokeScenario,
};

export const scenarioCatalog = validateScenarioCatalog([
  smokeScenarioEntry,
] as const);

export function getScenarioBySlug(slug: string): typeof smokeScenarioEntry | undefined {
  return scenarioCatalog.find(scenario => scenario.metadata.slug === slug);
}

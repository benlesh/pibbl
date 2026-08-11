import type { ScenarioCatalogEntry, ScenarioMetadata } from './types';
import { smokeScenario } from './smoke';

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
  assertNonEmpty(metadata.sourcePath, 'sourcePath', metadata.id);

  if (!ID_PATTERN.test(metadata.id) || !ID_PATTERN.test(metadata.slug)) {
    throw new Error(`Scenario "${metadata.id}" must use kebab-case id and slug values.`);
  }
  if (!metadata.sourcePath.endsWith('.ts')) {
    throw new Error(`Scenario "${metadata.id}" must reference its executable TypeScript source.`);
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
}

export function validateScenarioCatalog<
  TCatalog extends readonly ScenarioCatalogEntry[],
>(catalog: TCatalog): TCatalog {
  const ids = new Set<string>();
  const slugs = new Set<string>();

  for (const scenario of catalog) {
    validateMetadata(scenario.metadata);

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

export const scenarioCatalog = validateScenarioCatalog([
  smokeScenario,
] as const);

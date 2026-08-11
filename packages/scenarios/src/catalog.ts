import type { SmokeScenarioState } from './smoke.example';
import type { GeometryMatrixState } from './geometry-matrix.example';
import type { InteractionLabState } from './interaction-lab.example';
import type { LifecycleLabState } from './lifecycle-lab.example';
import type { MouseContractScenarioState } from './mouse-contract.example';
import { GEOMETRY_MATRIX_CASES } from './geometry-matrix.example';
import { MOUSE_CONTRACT_CASES } from './mouse-contract';
import type {
  ScenarioCatalogEntry,
  ScenarioCatalogRecord,
  ScenarioDefinition,
  ScenarioMetadata,
} from './types';
import type { AnyScenarioCatalogEntry } from './types';

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
    assertNonEmpty(scenario.source.marker, 'source.marker', scenario.metadata.id);
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
    marker: "SMOKE_SOURCE_ID = 'baseline-smoke-example'",
    path: 'packages/scenarios/src/smoke.example.ts',
  },
  load: async () => (await import('./smoke')).smokeScenario,
};

const interactionLabMetadata: ScenarioMetadata = {
  id: 'interaction-trace-lab',
  slug: 'interaction-trace-lab',
  title: 'Ordering and overlap laboratory',
  summary: 'Drive the approved CRC order, target, cursor, geometry, mutation, and activation rules against shared public-API fixtures.',
  category: 'Interaction contracts',
  apiTags: ['crc', 'crcEvent', 'path', 'line', 'rect', 'mouse events'],
  conceptTags: ['event order', 'topmost target', 'cursor parity', 'activation identity'],
  manualSteps: [
    {
      action: 'In Regions, move from background into Left, within Left, directly to Right, to Canvas background, outside the Canvas, and back to Left.',
      expected: 'Every route reports exit before entry and entry before movement; root exit reports one logical mouseout.',
    },
    {
      action: 'Open Overlap, move through lower-only and overlap points, choose Reorder overlap, move again, then Remove top and move again.',
      expected: 'Only the later-painted live region records input, and its crosshair/pointer cursor agrees with the trace after every change.',
    },
    {
      action: 'Open Nested and each fill, stroke, fill + stroke, transparent, interaction-width, and no-hit fixture; move through the visible positive and negative areas.',
      expected: 'Untransformed nested/topmost rules and configured interaction geometry match the visible fixture; every successful entry precedes movement.',
    },
    {
      action: 'Back in Regions, replace/remove the Left handler and exercise same-target click, cross-target press/release, leave/re-entry click, double click, and context menu.',
      expected: 'Only the current generation runs, removed targets stay silent, same-live-target activation succeeds, and browser context order is preserved.',
    },
    {
      action: 'Open Observer, Observer replace/remove, and Observer throwing; move twice through each target, then run Remove target after transition from Left to Right and choose Reset.',
      expected: 'Canvas observers follow target callbacks; queued replacement/removal appears on the next event; a thrown observer does not stop its safe peer; only Right disappears after the current route; Reset restores Regions.',
    },
  ],
  knownLimitations: [
    'TFC-04 intentionally uses an untransformed root Canvas; CSS scale, transforms, clips, and offscreen layers remain in the TFC-05 geometry matrix.',
    'A CRC rerender requested from a handler settles on the next animation frame; narrow dispatcher tests separately prove synchronous live-registry mutation semantics.',
    'Logical related targets remain diagnostic contract data because the public CRC event type exposes only the native DOM relatedTarget.',
    'The Observer throwing fixture deliberately reports one browser error; context-menu ordering follows the active browser instead of being normalized.',
  ],
  visibility: 'test-laboratory',
  visibilityReason: 'It exposes a dense conformance matrix and deliberate error path rather than a beginner-facing API lesson.',
  maturity: 'trusted',
};

export const interactionLabScenarioEntry: ScenarioCatalogEntry<InteractionLabState> = {
  metadata: interactionLabMetadata,
  canvas: {
    width: 480,
    height: 240,
  },
  actions: [
    { id: 'show-regions', label: 'Regions' },
    { id: 'show-overlap', label: 'Overlap' },
    { id: 'show-nested', label: 'Nested' },
    { id: 'show-fill', label: 'Fill' },
    { id: 'show-stroke', label: 'Stroke' },
    { id: 'show-fill-stroke', label: 'Fill + stroke' },
    { id: 'show-transparent', label: 'Transparent fill' },
    { id: 'show-interaction-width', label: 'Interaction width' },
    { id: 'show-no-hit', label: 'No hit geometry' },
    { id: 'show-observer', label: 'Canvas observer' },
    { id: 'show-observer-remove', label: 'Observer queues removal' },
    { id: 'show-observer-replace', label: 'Observer queues replacement' },
    { id: 'show-observer-throwing', label: 'Throwing observer' },
    { id: 'show-remove-target-after-transition', label: 'Remove target after transition' },
    { id: 'reorder-overlap', label: 'Reorder overlap' },
    { id: 'remove-top', label: 'Remove top' },
    { id: 'replace-handler', label: 'Replace handler' },
    { id: 'remove-handler', label: 'Remove handler' },
    { id: 'clear-trace', label: 'Clear trace' },
  ],
  source: {
    id: 'interaction-trace-lab-example',
    language: 'ts',
    marker: "INTERACTION_LAB_SOURCE_ID = 'interaction-trace-lab-example'",
    path: 'packages/scenarios/src/interaction-lab.example.ts',
  },
  load: async () => (await import('./interaction-lab')).interactionLabScenario,
};

const mouseContractMetadata: ScenarioMetadata = {
  id: 'mouse-interaction-contract',
  slug: 'mouse-interaction-contract',
  title: 'Mouse interaction contract',
  summary: 'Explore the approved native evidence and CRC target/order rules before the dispatcher is changed.',
  category: 'Interaction contracts',
  apiTags: ['crc', 'mouse events', 'rect', 'layer', 'clip', 'g'],
  conceptTags: ['event order', 'topmost target', 'click identity', 'coordinates'],
  manualSteps: [
    {
      action: 'Select Enter, Move within, Switch, and Exit cases.',
      expected: 'The approved CRC sequence reports boundary transitions before movement.',
    },
    {
      action: 'Select overlap, nested child, clip, transform, and layer cases.',
      expected: 'The highlighted target and rule consistently use topmost reverse paint order and clip intersection.',
    },
    {
      action: 'Select primary, cross-target, double-click, and context-menu cases.',
      expected: 'The trace table distinguishes successful activation, no region click, and browser-dependent context ordering.',
    },
    {
      action: 'Choose Reset.',
      expected: 'The explorer returns to Enter a region.',
    },
  ],
  knownLimitations: [
    'The explorer shows the approved contract; TFC-04 and TFC-05 make the current runtime conform.',
    'Pointer, touch, capture/bubble phases, stopPropagation, preventDefault, and pointer capture remain outside this plan.',
    'Context-menu event order is shown for the reference Chromium environment and is not normalized across browsers.',
  ],
  visibility: 'test-laboratory',
  visibilityReason: 'It is a design oracle and implementation guide rather than a beginner API example.',
  maturity: 'contract',
};

export const mouseContractScenarioEntry: ScenarioCatalogEntry<MouseContractScenarioState> = {
  metadata: mouseContractMetadata,
  canvas: { width: 480, height: 240 },
  actions: MOUSE_CONTRACT_CASES.map(contractCase => ({
    id: `show-${contractCase.id}`,
    label: contractCase.title,
  })),
  source: {
    id: 'mouse-interaction-contract-example',
    language: 'ts',
    marker: "MOUSE_CONTRACT_SOURCE_ID = 'mouse-interaction-contract-example'",
    path: 'packages/scenarios/src/mouse-contract.example.ts',
  },
  load: async () => (await import('./mouse-contract-scenario')).mouseContractScenario,
};

const lifecycleLabMetadata: ScenarioMetadata = {
  id: 'event-lifecycle-lab',
  slug: 'event-lifecycle-lab',
  title: 'Event lifecycle laboratory',
  summary: 'Exercise rerender, handler, subtree, layer, abort, dispose, remount, and stale-cleanup ownership flows.',
  category: 'Diagnostics',
  apiTags: ['crc', 'CRCController', 'rect', 'layer', 'mouse events'],
  conceptTags: ['event ownership', 'teardown', 'dispose', 'remount'],
  manualSteps: [
    {
      action: 'Choose Run 1,000 rerenders, then Replace handler and click the blue primary region.',
      expected: 'Revision reaches 1,000; the visible handler generation changes and only the replacement records the click.',
    },
    {
      action: 'Choose Remove handler and Remove subtree, then click their former regions.',
      expected: 'The geometry/cursor state disappears or becomes inert and no ghost call is recorded.',
    },
    {
      action: 'Choose Add layer, click the orange layer, then Remove layer and click its former location.',
      expected: 'The layer records one call while mounted, then its pixels, cursor, and event behavior disappear.',
    },
    {
      action: 'Choose Abort runtime or Dispose runtime, Cleanup again, Remount runtime, and Cleanup stale.',
      expected: 'Cleanup is harmless when repeated; a stale signal/controller cannot disturb the fresh mount.',
    },
    {
      action: 'Click Throws, then Safe, and finally choose Reset.',
      expected: 'The deliberate error is reported, Safe still records input, and Reset restores the initial mounted scene.',
    },
  ],
  knownLimitations: [
    'Private listener, registry, teardown, instance, and frame ledgers remain test-only; the gallery exposes the same semantic lifecycle actions.',
    'The Throws region deliberately reports one browser error so error isolation can be inspected.',
    'Broader image and hook asynchronous cleanup remains assigned to TFC-07.',
  ],
  visibility: 'test-laboratory',
  visibilityReason: 'It exposes lifecycle stress controls and disposal semantics rather than a beginner-facing lesson.',
  maturity: 'trusted',
};

export const lifecycleLabScenarioEntry: ScenarioCatalogEntry<LifecycleLabState> = {
  metadata: lifecycleLabMetadata,
  canvas: { width: 480, height: 240 },
  actions: [
    { id: 'rerender-1000', label: 'Run 1,000 rerenders' },
    { id: 'replace-handler', label: 'Replace handler' },
    { id: 'remove-handler', label: 'Remove handler' },
    { id: 'remove-subtree', label: 'Remove subtree' },
    { id: 'add-layer', label: 'Add layer' },
    { id: 'remove-layer', label: 'Remove layer' },
    { id: 'abort-runtime', label: 'Abort runtime' },
    { id: 'dispose-runtime', label: 'Dispose runtime' },
    { id: 'cleanup-again', label: 'Cleanup again' },
    { id: 'remount-runtime', label: 'Remount runtime' },
    { id: 'cleanup-stale', label: 'Cleanup stale runtime' },
  ],
  source: {
    id: 'event-lifecycle-lab-example',
    language: 'ts',
    marker: "LIFECYCLE_LAB_SOURCE_ID = 'event-lifecycle-lab-example'",
    path: 'packages/scenarios/src/lifecycle-lab.example.ts',
  },
  load: async () => (await import('./lifecycle-lab')).lifecycleLabScenario,
};

const geometryMatrixMetadata: ScenarioMetadata = {
  id: 'geometry-composition-matrix',
  slug: 'geometry-composition-matrix',
  title: 'Geometry composition matrix',
  summary: 'Probe intrinsic coordinates, nested transforms and clips, global layer paint order, layer bounds, and stroke interaction geometry.',
  category: 'Interaction contracts',
  apiTags: ['crc', 'g', 'clip', 'layer', 'line', 'rect', 'mouse events'],
  conceptTags: ['coordinate conversion', 'clip intersection', 'paint order', 'hit boundaries'],
  manualSteps: [
    {
      action: 'Compare Root fill boundaries with CSS-scaled fill boundaries at the visible center, left edge, and just outside.',
      expected: 'Both cases target fill at the same intrinsic points and report the same intrinsic coordinates even though the scaled Canvas is half-size.',
    },
    {
      action: 'Open Nested compound transform with clip; move through the blue quadrilateral, the clipped-away target at its upper-left, and clear background.',
      expected: 'Only the visible transformed-and-clipped geometry targets transformed, and its pointer cursor agrees with the trace.',
    },
    {
      action: 'Open Nested clip intersection and evenodd hole; probe the visible intersection, each single-clip-only area, and the central hole.',
      expected: 'Only the visible intersection targets clipped; failing either active clip or entering the evenodd hole clears the target.',
    },
    {
      action: 'Open Root and sibling layer paint order; sweep left to right through x=50, 120, 260, and 350 at y=120.',
      expected: 'The single targets are root-under, layer-one, root-middle, and layer-two, with exit before entry and cursor parity at each switch.',
    },
    {
      action: 'Open Transformed custom-size nested layer; probe the nested green area, its visually cropped continuation, the orange base, and the original unshifted location.',
      expected: 'The translated nested layer wins only inside its visible bounds; cropped content falls through to the base and the unshifted location stays inert.',
    },
    {
      action: 'Open Transformed stroke interaction boundary; probe the painted center, the upper interaction boundary, and one intrinsic pixel above it.',
      expected: 'The center and boundary target stroke while the outside point misses; the wider interaction geometry never paints extra blue pixels.',
    },
  ],
  knownLimitations: [
    'The trusted matrix currently covers Chromium mouse input at device-pixel ratio 1; broader browser and pointer/touch coverage remain outside this plan.',
    'Rotation and skew values follow the existing degree-based DOMMatrix behavior of the public group API.',
    'Layers compose at their existing origin; group transforms supply the parent-space placement exercised here.',
  ],
  visibility: 'test-laboratory',
  visibilityReason: 'It is a dense conformance and boundary matrix rather than a beginner-facing drawing example.',
  maturity: 'trusted',
};

export const geometryMatrixScenarioEntry: ScenarioCatalogEntry<GeometryMatrixState> = {
  metadata: geometryMatrixMetadata,
  canvas: { width: 480, height: 240 },
  actions: [
    ...GEOMETRY_MATRIX_CASES.map(matrixCase => ({
      id: `show-${matrixCase.id}`,
      label: matrixCase.title,
    })),
    { id: 'clear-trace', label: 'Clear trace' },
  ],
  source: {
    id: 'geometry-composition-matrix-example',
    language: 'ts',
    marker: "GEOMETRY_MATRIX_SOURCE_ID = 'geometry-composition-matrix-example'",
    path: 'packages/scenarios/src/geometry-matrix.example.ts',
  },
  load: async () => (await import('./geometry-matrix')).geometryMatrixScenario,
};

export const scenarioCatalog: readonly AnyScenarioCatalogEntry[] = validateScenarioCatalog([
  smokeScenarioEntry,
  interactionLabScenarioEntry,
  mouseContractScenarioEntry,
  lifecycleLabScenarioEntry,
  geometryMatrixScenarioEntry,
] as const);

export function getScenarioBySlug(slug: string): AnyScenarioCatalogEntry | undefined {
  return scenarioCatalog.find(scenario => scenario.metadata.slug === slug);
}

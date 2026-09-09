import type { FilterLabState, ScenarioController } from '@crc/scenarios';
import {
  FILTER_LAB_PROBES,
  filterLabScenarioEntry,
  getLearningExampleBySlug,
  getLearningExampleRoute,
  getScenarioRoute,
  loadScenario,
  scenarioCatalog,
} from '@crc/scenarios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import filterLabSource from '../../scenarios/src/filter-lab.example.tsx?raw';
import learningFilterSource from '../../scenarios/src/learning/composition/filters.example.tsx?raw';
import { clickMouse, cssPointForIntrinsic } from './support/mouse-input';
import { expectVisualMatch } from './visual-compare';

const activeControllers = new Set<ScenarioController<FilterLabState>>();
const LAB_PROBES = {
  all: {
    opaque: { x: 42, y: 50 },
    transparent: { x: 470, y: 230 },
    shadow: { x: 17, y: 50 },
  },
  ordered: {
    opaque: { x: 130, y: 108 },
    transparent: { x: 36, y: 210 },
    shadow: { x: 198, y: 108 },
    orderSample: { x: 198, y: 108 },
  },
  nested: {
    opaque: { x: 116, y: 118 },
    transparent: { x: 36, y: 210 },
    shadow: { x: 171, y: 118 },
  },
  transformed: {
    opaque: { x: 110, y: 105 },
    transparent: { x: 36, y: 210 },
    shadow: { x: 157, y: 118 },
  },
  clipped: {
    opaque: { x: 55, y: 126 },
    transparent: { x: 16, y: 216 },
    shadow: { x: 418, y: 134 },
    visibleCenters: [{ x: 55, y: 126 }, { x: 215, y: 126 }, { x: 375, y: 126 }],
  },
  layered: {
    opaque: { x: 160, y: 115 },
    transparent: { x: 24, y: 216 },
    shadow: { x: 208, y: 115 },
    source: { x: 160, y: 115 },
    shadowOnly: { x: 208, y: 115 },
  },
} as const;

afterEach(async () => {
  for (const controller of activeControllers) {
    await controller.dispose();
  }
  activeControllers.clear();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function pixelAt(canvas: HTMLCanvasElement, point: { x: number; y: number }): readonly number[] {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('The filter laboratory Canvas has no 2D context.');
  }
  return Array.from(context.getImageData(point.x, point.y, 1, 1).data);
}

async function mountFilterLab() {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 240;
  canvas.style.cssText = 'display:block; width:480px; height:240px';
  document.body.replaceChildren(canvas);
  const definition = await loadScenario(filterLabScenarioEntry);
  const controller = await definition.mount({ canvas });
  activeControllers.add(controller);
  return { canvas, controller, definition };
}

describe('first-class filter public scenarios', () => {
  it('registers the exact learning route and the deterministic laboratory route', async () => {
    const learningEntry = getLearningExampleBySlug('filters');
    expect(learningEntry).toMatchObject({
      slug: 'filters',
      section: 'composition',
      api: ['Group', 'Rectangle', 'Circle', 'Text', 'CRCFilter'],
      source: {
        path: 'packages/scenarios/src/learning/composition/filters.example.tsx',
      },
    });
    expect(learningEntry && getLearningExampleRoute(learningEntry)).toBe(
      '#/examples/composition/filters',
    );

    expect(scenarioCatalog).toContain(filterLabScenarioEntry);
    expect(getScenarioRoute(filterLabScenarioEntry)).toBe('#/testing/filters');
    expect(filterLabScenarioEntry).toMatchObject({
      metadata: {
        id: 'first-class-filters',
        slug: 'filters',
      },
      canvas: { width: 480, height: 240 },
      source: {
        id: 'first-class-filters-laboratory-example',
        marker: "FILTER_LAB_SOURCE_ID = 'first-class-filters-laboratory-example'",
        path: 'packages/scenarios/src/filter-lab.example.tsx',
      },
    });
    expect(filterLabScenarioEntry.actions.map(action => action.id)).toEqual([
      'show-all',
      'show-ordered',
      'swap-order',
      'show-nested',
      'show-transformed',
      'show-clipped',
      'show-layered',
    ]);

    const definition = await loadScenario(filterLabScenarioEntry);
    expect(definition.id).toBe('first-class-filters');
    expect(definition.sourceId).toBe('first-class-filters-laboratory-example');
    expect(definition.actionIds).toEqual(
      filterLabScenarioEntry.actions.map(action => action.id),
    );
  });

  it('keeps both filter scenarios source-backed by direct public imports', () => {
    for (const source of [learningFilterSource, filterLabSource]) {
      expect(source).toMatch(/from ['"]@crc\/core['"]/u);
      expect(source).not.toMatch(/@crc\/core\/(?:src|lib)\//u);
    }
    expect(learningFilterSource).toContain('const CHAINS = [');
    expect(learningFilterSource).toContain('dropShadow');
    expect(learningFilterSource).toContain('grayscale');
    expect(filterLabSource).toContain(
      "FILTER_LAB_SOURCE_ID = 'first-class-filters-laboratory-example'",
    );
  });

  it('renders semantic opaque centers and transparent or shadow boundaries for every laboratory action', async () => {
    const { canvas, controller } = await mountFilterLab();
    const actionExpectations = [
      ['show-all', 'all'],
      ['show-ordered', 'ordered'],
      ['swap-order', 'ordered'],
      ['show-nested', 'nested'],
      ['show-transformed', 'transformed'],
      ['show-clipped', 'clipped'],
      ['show-layered', 'layered'],
    ] as const;

    expect(FILTER_LAB_PROBES).toEqual(LAB_PROBES);

    for (const [revision, [action, mode]] of actionExpectations.entries()) {
      await controller.perform(action);
      const probes = LAB_PROBES[mode];
      expect(controller.getState()).toMatchObject({
        mode,
        revision: revision + 1,
      });
      expect(pixelAt(canvas, probes.opaque)[3], action).toBeGreaterThan(180);
      expect(pixelAt(canvas, probes.transparent)[3], action).toBe(0);
      expect(pixelAt(canvas, probes.shadow)[3], action).toBeGreaterThan(0);
    }
  });

  it('keeps ordered chains distinct, composes nested filters inside-out, and preserves clip placement', async () => {
    const { canvas, controller } = await mountFilterLab();
    await controller.perform('show-ordered');
    const orderedPixel = pixelAt(canvas, LAB_PROBES.ordered.orderSample);
    expect(controller.getState()).toMatchObject({
      mode: 'ordered',
      order: 'grayscale-then-shadow',
      revision: 1,
    });

    await controller.perform('swap-order');
    expect(controller.getState()).toMatchObject({
      mode: 'ordered',
      order: 'shadow-then-grayscale',
      revision: 2,
    });
    expect(pixelAt(canvas, LAB_PROBES.ordered.orderSample)).not.toEqual(orderedPixel);

    const appliedFilters: string[] = [];
    const nativeDrawImage = OffscreenCanvasRenderingContext2D.prototype.drawImage;
    vi.spyOn(OffscreenCanvasRenderingContext2D.prototype, 'drawImage')
      .mockImplementation(function(
        this: OffscreenCanvasRenderingContext2D,
        ...args: Parameters<OffscreenCanvasRenderingContext2D['drawImage']>
      ) {
        appliedFilters.push(this.filter);
        return nativeDrawImage.apply(this, args);
      });
    await controller.perform('show-nested');
    expect(controller.getState()).toMatchObject({
      mode: 'nested',
      order: 'inside-out',
      revision: 3,
    });
    expect(appliedFilters.filter(filter => filter !== 'none')).toEqual([
      'grayscale(1)',
      'drop-shadow(8px 6px 3px rgb(15 23 42))',
      'blur(2px)',
    ]);

    await controller.perform('show-clipped');
    expect(controller.getState()).toMatchObject({
      mode: 'clipped',
      revision: 4,
    });
    expect(LAB_PROBES.clipped.visibleCenters).toHaveLength(3);
    for (const point of LAB_PROBES.clipped.visibleCenters) {
      expect(pixelAt(canvas, point)[3]).toBeGreaterThan(180);
    }
  });

  it('keeps cached Layer targets on source geometry and rejects shadow-only clicks', async () => {
    const { canvas, controller } = await mountFilterLab();
    await controller.perform('show-layered');
    expect(controller.getState()).toMatchObject({
      mode: 'layered',
      revision: 1,
      lastTarget: null,
    });

    await clickMouse(canvas, cssPointForIntrinsic(canvas, LAB_PROBES.layered.source));
    expect(controller.getState().lastTarget).toBe('layered-source');

    await clickMouse(canvas, cssPointForIntrinsic(canvas, LAB_PROBES.layered.shadowOnly));
    expect(controller.getState().lastTarget).toBe('layered-source');
  });

  it('matches the reviewed all-functions visual laboratory', async () => {
    const { canvas, controller } = await mountFilterLab();
    await controller.perform('show-all');
    await controller.settled();

    await expectVisualMatch({
      element: canvas,
      expectedPath: 'packages/core/test/visual-baselines/first-class-filters.expected.png',
      expectedArtifactPath: 'test-screenshots/first-class-filters/filters.expected.png',
      actualPath: '../../../test-screenshots/first-class-filters/filters.actual.png',
      diffPath: 'test-screenshots/first-class-filters/filters.diff.png',
    });
  });
});

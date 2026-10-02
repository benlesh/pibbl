import { grayscale, sepia, hueRotate, opacity } from '@crc/core/filters';
import type { FilterLabState, ScenarioController } from '@crc/scenarios';
import {
  FILTER_LAB_PROBES,
  filterLabScenarioEntry,
  getLearningExampleBySlug,
  getLearningExampleRoute,
  getScenarioRoute,
  loadLearningExample,
  loadScenario,
  scenarioCatalog,
} from '@crc/scenarios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Polygon,
  Rectangle,
  RegularPolygon,
  Star,
  crc,
  createElement,
} from '@crc/core';
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

async function nextPaint(): Promise<void> {
  await new Promise<void>(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
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
      '#/examples/drawing/filters',
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
    expect(learningFilterSource).toContain('const FILTER_SAMPLES = [');
    expect(learningFilterSource).toContain('const ORDERED_FILTERS = [');
    expect(learningFilterSource).toContain('createSharedGradient');
    expect(learningFilterSource).toContain('dropShadow');
    expect(learningFilterSource).toContain('grayscale');
    expect(filterLabSource).toContain(
      "FILTER_LAB_SOURCE_ID = 'first-class-filters-laboratory-example'",
    );
  });

  it('renders every filter plus ordered and nested compositions together in one static gallery', async () => {
    const entry = getLearningExampleBySlug('filters');
    if (!entry) throw new Error('Missing filters learning example.');

    const canvas = document.createElement('canvas');
    canvas.width = entry.canvas.width;
    canvas.height = entry.canvas.height;
    document.body.replaceChildren(canvas);

    const context = canvas.getContext('2d');
    if (!context) throw new Error('The filters learning Canvas has no 2D context.');

    const labels: string[] = [];
    const nativeFillText = context.fillText;
    context.fillText = function(text, ...args) {
      labels.push(text);
      return nativeFillText.call(this, text, ...args);
    };

    const appliedFilters: string[] = [];
    const nativeDrawImage = OffscreenCanvasRenderingContext2D.prototype.drawImage;
    vi.spyOn(OffscreenCanvasRenderingContext2D.prototype, 'drawImage')
      .mockImplementation(function(
        this: OffscreenCanvasRenderingContext2D,
        ...args: Parameters<OffscreenCanvasRenderingContext2D['drawImage']>
      ) {
        if (this.filter !== 'none') appliedFilters.push(this.filter);
        return nativeDrawImage.apply(this, args);
      });

    const definition = await loadLearningExample(entry);
    const controller = definition.default(canvas);
    try {
      await nextPaint();
      expect({
        canvas: { width: canvas.width, height: canvas.height },
        labels: labels.filter(label => [
          'NORMAL',
          'BLUR',
          'BRIGHTNESS',
          'CONTRAST',
          'DROP SHADOW',
          'GRAYSCALE',
          'HUE ROTATE',
          'INVERT',
          'OPACITY',
          'SATURATE',
          'SEPIA',
          'ORDERED ARRAY',
          'NESTED',
        ].includes(label)),
        appliedFilters,
      }).toEqual({
        canvas: { width: 960, height: 660 },
        labels: [
          'NORMAL',
          'BLUR',
          'BRIGHTNESS',
          'CONTRAST',
          'DROP SHADOW',
          'GRAYSCALE',
          'HUE ROTATE',
          'INVERT',
          'OPACITY',
          'SATURATE',
          'SEPIA',
          'ORDERED ARRAY',
          'NESTED',
        ],
        appliedFilters: [
          'blur(4px)',
          'brightness(1.35)',
          'contrast(1.5)',
          'drop-shadow(8px 7px 4px rgb(15 23 42))',
          'grayscale(1)',
          'hue-rotate(120deg)',
          'invert(1)',
          'opacity(0.55)',
          'saturate(2)',
          'sepia(1)',
          'grayscale(0.35) contrast(1.4) drop-shadow(7px 6px 3px rgb(15 23 42))',
          'hue-rotate(155deg)',
          'drop-shadow(7px 6px 3px rgb(15 23 42))',
          'blur(1.5px)',
        ],
      });
    } finally {
      controller.dispose();
    }
  });

  it('filters rounded and generated shape components through their public styles', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 100;
    document.body.replaceChildren(canvas);

    const appliedFilters: string[] = [];
    const nativeDrawImage = OffscreenCanvasRenderingContext2D.prototype.drawImage;
    vi.spyOn(OffscreenCanvasRenderingContext2D.prototype, 'drawImage')
      .mockImplementation(function(
        this: OffscreenCanvasRenderingContext2D,
        ...args: Parameters<OffscreenCanvasRenderingContext2D['drawImage']>
      ) {
        if (this.filter !== 'none') appliedFilters.push(this.filter);
        return nativeDrawImage.apply(this, args);
      });

    const controller = crc(canvas, [
      createElement(Rectangle, {
        style: {
          left: 10,
          top: 20,
          width: 50,
          height: 60,
          cornerRadius: 12,
          fill: '#ef4444',
          filter: grayscale({ amount: 1 }),
        },
      }),
      createElement(Polygon, {
        style: {
          coords: [[80, 75], [105, 20], [130, 75]],
          cornerRadius: 6,
          fill: '#facc15',
          filter: sepia({ amount: 1 }),
        },
      }),
      createElement(RegularPolygon, {
        style: {
          sides: 6,
          cx: 185,
          cy: 50,
          circumradius: 32,
          cornerRadius: 4,
          fill: '#10b981',
          filter: hueRotate({ degrees: 120 }),
        },
      }),
      createElement(Star, {
        style: {
          points: 5,
          cx: 270,
          cy: 50,
          outerRadius: 34,
          innerRadius: 16,
          cornerRadius: 3,
          fill: '#2563eb',
          filter: opacity({ amount: 0.55 }),
        },
      }),
    ]);

    try {
      await nextPaint();
      expect(appliedFilters).toEqual([
        'grayscale(1)',
        'sepia(1)',
        'hue-rotate(120deg)',
        'opacity(0.55)',
      ]);
      expect(pixelAt(canvas, { x: 35, y: 50 })[3]).toBeGreaterThan(0);
      expect(pixelAt(canvas, { x: 105, y: 50 })[3]).toBeGreaterThan(0);
      expect(pixelAt(canvas, { x: 185, y: 50 })[3]).toBeGreaterThan(0);
      expect(pixelAt(canvas, { x: 270, y: 50 })[3]).toBeGreaterThan(0);
    } finally {
      controller.dispose();
    }
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

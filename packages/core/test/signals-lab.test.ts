import type { ScenarioController, SignalsLabState } from '@crc/scenarios';
import {
  getLearningExampleBySlug,
  getLearningExampleRoute,
  getScenarioRoute,
  loadLearningExample,
  loadScenario,
  signalsLabScenarioEntry,
} from '@crc/scenarios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import signalsLabSource from '../../scenarios/src/signals-lab.example.tsx?raw';
import signalsLearningSource from '../../scenarios/src/learning/start/signals.example.tsx?raw';
import { clickLogicalPoint } from './support/user-input';

const activeControllers = new Set<ScenarioController<SignalsLabState>>();

afterEach(async () => {
  for (const controller of activeControllers) await controller.dispose();
  activeControllers.clear();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

async function mountSignalsLab() {
  const canvas = document.createElement('canvas');
  canvas.width = signalsLabScenarioEntry.canvas.width;
  canvas.height = signalsLabScenarioEntry.canvas.height;
  const referenceHost = document.createElement('div');
  document.body.replaceChildren(canvas, referenceHost);
  const definition = await loadScenario(signalsLabScenarioEntry);
  const controller = await definition.mount({ canvas, referenceHost });
  activeControllers.add(controller);
  await controller.settled();
  return { canvas, controller, definition, referenceHost };
}

describe('first-class signal public scenarios', () => {
  it('registers learning and laboratory routes with public-package-only sources', () => {
    const learning = getLearningExampleBySlug('signals');
    expect(learning).toMatchObject({
      slug: 'signals',
      section: 'start',
      api: ['signal', 'computed', 'crcSignal', 'Layer'],
      source: { path: 'packages/scenarios/src/learning/start/signals.example.tsx' },
    });
    expect(learning && getLearningExampleRoute(learning)).toBe('#/examples/start/signals');
    expect(getScenarioRoute(signalsLabScenarioEntry)).toBe('#/testing/signals');

    for (const source of [signalsLearningSource, signalsLabSource]) {
      expect(source).toMatch(/from ['"]@crc\/core['"]/u);
      expect(source).not.toMatch(/@crc\/core\/(?:internal|lib|src)\b/u);
      expect(source).not.toMatch(/(?:ManualFrames|flushPending|requestAnimationFrame)/u);
    }
    expect(signalsLearningSource).toContain('.get()');
    expect(signalsLearningSource).toContain('.update(');
    expect(signalsLearningSource).toContain('computed(');
    expect(signalsLabSource).toContain(
      "SIGNALS_LAB_SOURCE_ID = 'first-class-signals-laboratory-example'",
    );
  });

  it('mounts the learning example with explicit reads and updates its writable signals on click', async () => {
    const entry = getLearningExampleBySlug('signals');
    if (!entry) throw new Error('Missing signals learning example.');
    const canvas = document.createElement('canvas');
    canvas.width = entry.canvas.width;
    canvas.height = entry.canvas.height;
    document.body.appendChild(canvas);
    const controller = (await loadLearningExample(entry)).default(canvas);
    try {
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const before = Array.from(canvas.getContext('2d')!.getImageData(150, 200, 1, 1).data);
      await clickLogicalPoint(canvas, { x: 150, y: 200 });
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const after = Array.from(canvas.getContext('2d')!.getImageData(150, 200, 1, 1).data);
      expect(before).not.toEqual(after);
    } finally {
      controller.dispose();
    }
  });

  it('drives direct, equal, computed, dynamic, shared-root, layer, removal, and reset semantics', async () => {
    const { controller, definition, referenceHost } = await mountSignalsLab();
    expect(referenceHost.querySelectorAll('canvas')).toHaveLength(1);
    expect(definition.actionIds).toEqual(signalsLabScenarioEntry.actions.map(action => action.id));
    expect(controller.getState()).toEqual({
      direct: 1,
      derivedSource: 0,
      selectedSource: 'left',
      computed: 0,
      computedEvaluations: 1,
      rootRenders: { a: 1, b: 1 },
      layerChildRenders: { a: 1, b: 1 },
      layerComposites: { a: 1, b: 1 },
      consumerCount: 5,
      lastAction: 'mount',
    });

    await controller.perform('direct-write');
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      direct: 2,
      rootRenders: { a: 2, b: 1 },
      lastAction: 'direct-write',
    });

    const afterDirect = controller.getState();
    await controller.perform('equal-write');
    await controller.settled();
    expect(controller.getState()).toEqual({ ...afterDirect, lastAction: 'equal-write' });

    await controller.perform('computed-equal-write');
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      derivedSource: 2,
      computed: 0,
      computedEvaluations: 2,
      rootRenders: { a: 2, b: 1 },
      lastAction: 'computed-equal-write',
    });

    await controller.perform('dependency-switch');
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      selectedSource: 'right',
      computed: 20,
      rootRenders: { a: 3, b: 1 },
      lastAction: 'dependency-switch',
    });

    const nativeRequestAnimationFrame = globalThis.requestAnimationFrame;
    let callbacksAdvancingBothRoots = 0;
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback =>
      nativeRequestAnimationFrame.call(globalThis, timestamp => {
        const before = controller.getState().rootRenders;
        callback(timestamp);
        const after = controller.getState().rootRenders;
        if (after.a === before.a + 1 && after.b === before.b + 1) {
          callbacksAdvancingBothRoots += 1;
        }
      }),
    );
    await controller.perform('shared-roots');
    await controller.settled();
    expect(callbacksAdvancingBothRoots).toBe(1);
    vi.restoreAllMocks();
    expect(controller.getState()).toMatchObject({
      rootRenders: { a: 4, b: 2 },
      lastAction: 'shared-roots',
    });

    const beforeLayer = controller.getState();
    await controller.perform('layer-local-write');
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      rootRenders: { a: beforeLayer.rootRenders.a + 1, b: beforeLayer.rootRenders.b },
      layerChildRenders: { a: beforeLayer.layerChildRenders.a + 1, b: beforeLayer.layerChildRenders.b },
      layerComposites: { a: beforeLayer.layerComposites.a + 1, b: beforeLayer.layerComposites.b },
      lastAction: 'layer-local-write',
    });

    const beforeRemoval = controller.getState();
    await controller.perform('remove-consumer');
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      rootRenders: { a: beforeRemoval.rootRenders.a + 1, b: beforeRemoval.rootRenders.b },
      consumerCount: 4,
      lastAction: 'remove-consumer',
    });

    await controller.perform('reset');
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      direct: 1,
      derivedSource: 0,
      selectedSource: 'left',
      computed: 0,
      consumerCount: 5,
      lastAction: 'reset',
    });
  });
});

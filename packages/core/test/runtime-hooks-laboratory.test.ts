import type {
  RuntimeHooksState,
  ScenarioController,
} from '@crc/scenarios';
import {
  loadScenario,
  runtimeHooksScenarioEntry,
} from '@crc/scenarios';
import { afterEach, describe, expect, it } from 'vitest';
import runtimeHooksSource from '../../scenarios/src/runtime-hooks.example.ts?raw';
import { loadScenarioSource } from '../../../playground/src/scenario-sources';
import { GLOBAL_STATE } from '../src/lib/global-state';

const activeControllers = new Set<ScenarioController<RuntimeHooksState>>();

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): readonly number[] {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('The runtime hooks Canvas has no 2D context.');
  }
  return Array.from(context.getImageData(x, y, 1, 1).data);
}

async function mountLab() {
  const canvas = document.createElement('canvas');
  canvas.width = runtimeHooksScenarioEntry.canvas.width;
  canvas.height = runtimeHooksScenarioEntry.canvas.height;
  canvas.style.cssText = 'display:block; width:480px; height:240px';
  document.body.replaceChildren(canvas);
  const definition = await loadScenario(runtimeHooksScenarioEntry);
  const controller = await definition.mount({ canvas });
  activeControllers.add(controller);
  return { canvas, controller, definition };
}

function expectTemporaryRenderStateReleased(): void {
  expect(GLOBAL_STATE).toMatchObject({
    canvas: undefined,
    componentHookIndex: 0,
    componentIsMounting: false,
    componentRefs: undefined,
    currentCRCInstance: undefined,
    renderContext: undefined,
    seenIds: undefined,
    seenKeys: undefined,
    unseenIds: undefined,
  });
  expect(GLOBAL_STATE.clippingStack).toEqual([]);
}

afterEach(async () => {
  for (const controller of activeControllers) {
    await controller.dispose();
  }
  activeControllers.clear();
  document.body.replaceChildren();
});

describe('shared runtime and hooks laboratory', () => {
  it('loads the catalog source and preserves stable state, memo, ref, path, sibling, and falsy-child contracts', async () => {
    expect(runtimeHooksSource).toContain(runtimeHooksScenarioEntry.source.marker);
    await expect(loadScenarioSource(runtimeHooksScenarioEntry)).resolves.toBe(
      runtimeHooksSource,
    );
    expect(runtimeHooksScenarioEntry.source.path).toBe(
      'packages/scenarios/src/runtime-hooks.example.ts',
    );
    expect(runtimeHooksScenarioEntry.metadata.knownLimitations.join(' ')).toContain(
      'crcEvent',
    );
    expect(runtimeHooksScenarioEntry.metadata.knownLimitations.join(' ')).toContain(
      'crcCursor',
    );

    const { canvas, controller, definition } = await mountLab();
    expect(definition.actionIds).toEqual(
      runtimeHooksScenarioEntry.actions.map(action => action.id),
    );
    expect(controller.getState()).toEqual({
      componentKey: 1,
      componentVisible: true,
      dependency: 0,
      falsyChildren: 5,
      hookAcquisitions: 1,
      hookCleanups: 0,
      hookOrder: 'state → memo → ref → whenChanged → rectPath → linePath → svgPath',
      lastAction: 'mount',
      memoCreates: 1,
      memoIdentity: 'dependency-0-memo-1',
      misuseErrors: 0,
      misuseMessage: null,
      misuseName: null,
      pathIdentities: [2, 3, 4],
      refIdentity: 1,
      refValue: 0,
      renders: 1,
      rootVariant: 'a',
      siblingIdentities: { a: 5, b: 6, c: null },
      siblingOrder: ['a', 'b'],
      stateValue: 0,
    });
    expect(definition.formatState(controller.getState())).toEqual(
      expect.arrayContaining([
        { label: 'State', value: '0 · 1 renders' },
        { label: 'Memo', value: 'dependency-0-memo-1 · 1 creates' },
        { label: 'Change cleanup', value: '1 acquired · 0 cleaned' },
        { label: 'Path identities', value: '#2 · #3 · #4' },
        { label: 'Falsy children', value: '5' },
      ]),
    );
    expect(pixelAt(canvas, 10, 10)).toEqual([248, 250, 252, 255]);
    expect(pixelAt(canvas, 30, 35)).toEqual([37, 99, 235, 255]);
    expect(pixelAt(canvas, 100, 125)).toEqual([245, 158, 11, 255]);
    expect(pixelAt(canvas, 200, 60)).toEqual([14, 165, 233, 255]);
    expect(pixelAt(canvas, 280, 60)).toEqual([16, 185, 129, 255]);
    expect(pixelAt(canvas, 170, 20)).toEqual([248, 250, 252, 255]);

    await controller.perform('render-stable');
    expect(controller.getState()).toMatchObject({
      hookAcquisitions: 1,
      hookCleanups: 0,
      lastAction: 'render-stable',
      memoCreates: 1,
      memoIdentity: 'dependency-0-memo-1',
      pathIdentities: [2, 3, 4],
      refIdentity: 1,
      renders: 2,
      siblingIdentities: { a: 5, b: 6, c: null },
      stateValue: 0,
    });

    await controller.perform('mutate-ref');
    expect(controller.getState()).toMatchObject({
      lastAction: 'mutate-ref',
      refIdentity: 1,
      refValue: 1,
      renders: 2,
      stateValue: 0,
    });

    await controller.perform('increment-state');
    expect(controller.getState()).toMatchObject({
      lastAction: 'increment-state',
      memoCreates: 1,
      pathIdentities: [2, 3, 4],
      refIdentity: 1,
      refValue: 1,
      renders: 3,
      stateValue: 1,
    });
    expect(pixelAt(canvas, 30, 35)).toEqual([124, 58, 237, 255]);
  });

  it('balances dependency cleanup and retains keyed siblings through reorder, insertion, and removal', async () => {
    const { canvas, controller } = await mountLab();

    await controller.perform('change-dependency');
    expect(controller.getState()).toMatchObject({
      dependency: 1,
      hookAcquisitions: 2,
      hookCleanups: 1,
      memoCreates: 2,
      memoIdentity: 'dependency-1-memo-2',
      pathIdentities: [7, 8, 9],
      refIdentity: 1,
      renders: 2,
      stateValue: 0,
    });
    expect(pixelAt(canvas, 100, 125)).toEqual([236, 72, 153, 255]);

    await controller.perform('reorder-siblings');
    expect(controller.getState()).toMatchObject({
      siblingIdentities: { a: 5, b: 6, c: null },
      siblingOrder: ['b', 'a'],
    });
    expect(pixelAt(canvas, 200, 60)).toEqual([16, 185, 129, 255]);
    expect(pixelAt(canvas, 280, 60)).toEqual([14, 165, 233, 255]);

    await controller.perform('insert-sibling');
    expect(controller.getState()).toMatchObject({
      siblingIdentities: { a: 5, b: 6, c: 10 },
      siblingOrder: ['b', 'c', 'a'],
    });
    expect(pixelAt(canvas, 200, 60)).toEqual([16, 185, 129, 255]);
    expect(pixelAt(canvas, 280, 60)).toEqual([249, 115, 22, 255]);
    expect(pixelAt(canvas, 364, 60)).toEqual([14, 165, 233, 255]);

    await controller.perform('remove-sibling');
    expect(controller.getState()).toMatchObject({
      siblingIdentities: { a: 5, b: null, c: 10 },
      siblingOrder: ['a', 'c'],
    });
    expect(pixelAt(canvas, 200, 60)).toEqual([14, 165, 233, 255]);
    expect(pixelAt(canvas, 280, 60)).toEqual([249, 115, 22, 255]);
  });

  it('recreates hooks at key, component, and root boundaries and resets deterministically', async () => {
    const { canvas, controller } = await mountLab();

    await controller.perform('replace-component-key');
    expect(controller.getState()).toMatchObject({
      componentKey: 2,
      hookAcquisitions: 2,
      hookCleanups: 1,
      memoCreates: 2,
      pathIdentities: [8, 9, 10],
      refIdentity: 7,
      stateValue: 0,
    });

    await controller.perform('remove-component');
    expect(controller.getState()).toMatchObject({
      componentVisible: false,
      hookAcquisitions: 2,
      hookCleanups: 2,
    });
    expect(pixelAt(canvas, 30, 35)).toEqual([248, 250, 252, 255]);

    await controller.perform('restore-component');
    expect(controller.getState()).toMatchObject({
      componentVisible: true,
      hookAcquisitions: 3,
      hookCleanups: 2,
      memoCreates: 3,
      pathIdentities: [12, 13, 14],
      refIdentity: 11,
    });

    await controller.perform('replace-root');
    expect(controller.getState()).toMatchObject({
      hookAcquisitions: 4,
      hookCleanups: 3,
      memoCreates: 4,
      pathIdentities: [16, 17, 18],
      refIdentity: 15,
      rootVariant: 'b',
      siblingIdentities: { a: 19, b: 20, c: null },
    });
    expect(pixelAt(canvas, 10, 10)).toEqual([238, 242, 255, 255]);

    await controller.reset();
    expect(controller.getState()).toEqual({
      componentKey: 1,
      componentVisible: true,
      dependency: 0,
      falsyChildren: 5,
      hookAcquisitions: 1,
      hookCleanups: 0,
      hookOrder: 'state → memo → ref → whenChanged → rectPath → linePath → svgPath',
      lastAction: 'reset',
      memoCreates: 1,
      memoIdentity: 'dependency-0-memo-1',
      misuseErrors: 0,
      misuseMessage: null,
      misuseName: null,
      pathIdentities: [2, 3, 4],
      refIdentity: 1,
      refValue: 0,
      renders: 1,
      rootVariant: 'a',
      siblingIdentities: { a: 5, b: 6, c: null },
      siblingOrder: ['a', 'b'],
      stateValue: 0,
    });
  });

  it('reports every outside-render hook misuse and recovers without corrupting the live scene', async () => {
    const { canvas, controller, definition } = await mountLab();

    await controller.perform('probe-hook-misuse');
    expect(controller.getState()).toMatchObject({
      hookAcquisitions: 1,
      hookCleanups: 0,
      memoCreates: 1,
      misuseErrors: 9,
      misuseMessage: 'CRC hooks can only be called while rendering a component.',
      misuseName: 'Error × 9',
      pathIdentities: [2, 3, 4],
      refIdentity: 1,
      renders: 2,
      siblingIdentities: { a: 5, b: 6, c: null },
      stateValue: 0,
    });
    expectTemporaryRenderStateReleased();
    expect(pixelAt(canvas, 30, 35)).toEqual([37, 99, 235, 255]);
    expect(definition.formatState(controller.getState())).toContainEqual({
      label: 'Misuse errors',
      value: '9 · Error × 9 · CRC hooks can only be called while rendering a component.',
    });

    await controller.perform('increment-state');
    expect(controller.getState()).toMatchObject({
      misuseErrors: 9,
      misuseMessage: 'CRC hooks can only be called while rendering a component.',
      misuseName: 'Error × 9',
      renders: 3,
      stateValue: 1,
    });
    expect(pixelAt(canvas, 30, 35)).toEqual([124, 58, 237, 255]);

    await controller.dispose();
    activeControllers.delete(controller);
    expect(controller.getState()).toMatchObject({
      hookAcquisitions: 1,
      hookCleanups: 1,
    });
    expectTemporaryRenderStateReleased();
  });
});

import type {
  LifecycleLabState,
  ScenarioController,
} from '@crc/scenarios';
import {
  lifecycleLabScenarioEntry,
  loadScenario,
} from '@crc/scenarios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import lifecycleLabSource from '../../scenarios/src/lifecycle-lab.example.ts?raw';
import { RuntimeDiagnostics } from './support/runtime-diagnostics';

const activeControllers = new Set<ScenarioController<LifecycleLabState>>();
const activeDiagnostics = new Set<RuntimeDiagnostics>();

const BASELINE_HANDLERS = {
  click: 4,
  contextmenu: 1,
  dblclick: 1,
  mousedown: 1,
  mousemove: 1,
  mouseout: 1,
  mouseover: 1,
  mouseup: 1,
};

const EMPTY_HANDLERS = {
  click: 0,
  contextmenu: 0,
  dblclick: 0,
  mousedown: 0,
  mousemove: 0,
  mouseout: 0,
  mouseover: 0,
  mouseup: 0,
};

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): readonly number[] {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('The lifecycle laboratory Canvas has no 2D context.');
  }
  return Array.from(context.getImageData(x, y, 1, 1).data);
}

function dispatchMouse(canvas: HTMLCanvasElement, type: 'click' | 'mousemove', x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  const init = {
    bubbles: true,
    clientX: bounds.left + x * bounds.width / canvas.width,
    clientY: bounds.top + y * bounds.height / canvas.height,
  };
  if (type === 'click') {
    canvas.dispatchEvent(new MouseEvent('mousedown', { ...init, button: 0 }));
    canvas.dispatchEvent(new MouseEvent('mouseup', { ...init, button: 0 }));
  }
  canvas.dispatchEvent(new MouseEvent(type, init));
}

async function mountLifecycleLab() {
  const canvas = document.createElement('canvas');
  canvas.width = lifecycleLabScenarioEntry.canvas.width;
  canvas.height = lifecycleLabScenarioEntry.canvas.height;
  canvas.style.cssText = 'display:block; width:480px; height:240px';
  document.body.replaceChildren(canvas);
  const diagnostics = new RuntimeDiagnostics(canvas);
  activeDiagnostics.add(diagnostics);
  const definition = await loadScenario(lifecycleLabScenarioEntry);
  const controller = await definition.mount({ canvas });
  activeControllers.add(controller);
  return { canvas, controller, definition, diagnostics };
}

function expectFullyReleased(diagnostics: RuntimeDiagnostics): void {
  expect(diagnostics.snapshot()).toEqual({
    instances: 0,
    nativeListeners: 0,
    handlers: EMPTY_HANDLERS,
    componentTeardowns: 0,
    mainTeardowns: 0,
    scheduledFrames: 0,
  });
  const ledger = diagnostics.ledgerSnapshot();
  expect(ledger.nativeListeners).toMatchObject({
    released: ledger.nativeListeners.acquired,
    duplicateReleases: 0,
    live: 0,
  });
  for (const eventLedger of Object.values(ledger.handlers)) {
    expect(eventLedger).toMatchObject({
      released: eventLedger.acquired,
      duplicateReleases: 0,
      live: 0,
    });
  }
  expect(ledger.frames.pending).toBe(0);
}

afterEach(async () => {
  for (const controller of activeControllers) {
    await controller.dispose();
  }
  activeControllers.clear();
  for (const diagnostics of activeDiagnostics) {
    diagnostics.restore();
  }
  activeDiagnostics.clear();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('shared event lifecycle laboratory', () => {
  it('keeps resources stable through rerender, replacement, removal, and layer flows', async () => {
    expect(lifecycleLabSource).toContain(lifecycleLabScenarioEntry.source.marker);
    const { canvas, controller, diagnostics } = await mountLifecycleLab();
    expect(lifecycleLabScenarioEntry.actions.map(action => action.id)).toEqual([
      'rerender-1000',
      'replace-handler',
      'remove-handler',
      'remove-subtree',
      'add-layer',
      'remove-layer',
      'abort-runtime',
      'dispose-runtime',
      'cleanup-again',
      'remount-runtime',
      'cleanup-stale',
    ]);

    const baseline = diagnostics.snapshot();
    expect(baseline).toMatchObject({
      instances: 1,
      nativeListeners: 8,
      handlers: BASELINE_HANDLERS,
      scheduledFrames: 0,
    });
    expect(pixelAt(canvas, 50, 80)).toEqual([37, 99, 235, 255]);
    expect(pixelAt(canvas, 180, 80)).toEqual([124, 58, 237, 255]);

    await controller.perform('rerender-1000');
    expect(controller.getState().revision).toBe(1_000);
    expect(diagnostics.snapshot()).toEqual(baseline);
    for (const eventLedger of Object.values(diagnostics.ledgerSnapshot().handlers)) {
      expect(eventLedger.acquired - eventLedger.released).toBe(eventLedger.live);
      expect(eventLedger.duplicateReleases).toBe(0);
    }

    dispatchMouse(canvas, 'click', 50, 80);
    expect(controller.getState()).toMatchObject({
      calls: 1,
      lastHandlerGeneration: 1,
      lastTarget: 'primary',
    });
    await controller.perform('replace-handler');
    expect(diagnostics.snapshot()).toEqual(baseline);
    dispatchMouse(canvas, 'click', 50, 80);
    expect(controller.getState()).toMatchObject({
      calls: 2,
      handlerGeneration: 2,
      lastHandlerGeneration: 2,
      lastTarget: 'primary',
    });

    await controller.perform('remove-handler');
    expect(diagnostics.snapshot().handlers).toEqual({
      ...BASELINE_HANDLERS,
      click: 3,
      contextmenu: 0,
      dblclick: 0,
      mousedown: 0,
      mousemove: 0,
      mouseout: 0,
      mouseover: 0,
      mouseup: 0,
    });
    expect(pixelAt(canvas, 50, 80)).toEqual([100, 116, 139, 255]);
    dispatchMouse(canvas, 'click', 50, 80);
    expect(controller.getState().calls).toBe(2);

    dispatchMouse(canvas, 'mousemove', 180, 80);
    expect(canvas.style.cursor).toBe('pointer');
    await controller.perform('remove-subtree');
    expect(canvas.style.cursor).toBe('');
    expect(pixelAt(canvas, 180, 80)).toEqual([248, 250, 252, 255]);
    expect(diagnostics.snapshot().handlers).toEqual({
      ...EMPTY_HANDLERS,
      click: 2,
    });
    dispatchMouse(canvas, 'click', 180, 80);
    expect(controller.getState().calls).toBe(2);

    const beforeLayer = diagnostics.snapshot();
    await controller.perform('add-layer');
    expect(diagnostics.snapshot()).toMatchObject({ instances: 2, nativeListeners: 8 });
    expect(pixelAt(canvas, 290, 190)).toEqual([217, 119, 6, 255]);
    dispatchMouse(canvas, 'click', 200, 170);
    expect(controller.getState().targetCalls.layer).toBe(1);
    await controller.perform('remove-layer');
    expect(diagnostics.snapshot()).toEqual(beforeLayer);
    expect(pixelAt(canvas, 290, 190)).toEqual([248, 250, 252, 255]);
    dispatchMouse(canvas, 'click', 200, 170);
    expect(controller.getState().targetCalls.layer).toBe(1);

    await controller.dispose();
    activeControllers.delete(controller);
    expectFullyReleased(diagnostics);
  }, 40_000);

  it('isolates thrown handlers and stale cleanup across abort, dispose, and remount', async () => {
    const reportError = vi.spyOn(globalThis, 'reportError').mockImplementation(() => {});
    const { canvas, controller, diagnostics } = await mountLifecycleLab();

    dispatchMouse(canvas, 'click', 310, 80);
    expect(controller.getState()).toMatchObject({ lastTarget: 'throwing', calls: 1 });
    expect(reportError).toHaveBeenCalledOnce();
    dispatchMouse(canvas, 'click', 410, 80);
    expect(controller.getState()).toMatchObject({ lastTarget: 'safe', calls: 2 });

    await controller.perform('abort-runtime');
    expect(diagnostics.snapshot().instances).toBe(0);
    await controller.perform('cleanup-again');
    expect(diagnostics.snapshot().instances).toBe(0);
    await controller.perform('remount-runtime');
    const afterAbortRemount = diagnostics.snapshot();
    expect(afterAbortRemount).toMatchObject({ instances: 1, nativeListeners: 8 });
    await controller.perform('cleanup-stale');
    expect(diagnostics.snapshot()).toEqual(afterAbortRemount);

    await controller.perform('dispose-runtime');
    expect(diagnostics.snapshot().instances).toBe(0);
    await controller.perform('cleanup-again');
    expect(diagnostics.snapshot().instances).toBe(0);
    await controller.perform('remount-runtime');
    const afterDisposeRemount = diagnostics.snapshot();
    await controller.perform('cleanup-stale');
    expect(diagnostics.snapshot()).toEqual(afterDisposeRemount);

    await controller.reset();
    expect(controller.getState()).toMatchObject({
      runtime: 'mounted',
      mountGeneration: 1,
      revision: 0,
      calls: 0,
      handlerGeneration: 1,
      handlerRemoved: false,
      subtreeVisible: true,
      layerVisible: false,
      lastAction: 'reset',
    });

    await controller.dispose();
    activeControllers.delete(controller);
    expectFullyReleased(diagnostics);
  });
});

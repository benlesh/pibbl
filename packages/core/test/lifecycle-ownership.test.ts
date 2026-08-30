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
import {
  absolute,
  crc,
  defineComp,
  layer,
  rect,
  type CRCController,
} from '../src/index';
import { executeRender } from '../src/lib/execute-render';
import { GLOBAL_STATE, getCRCInstance } from '../src/lib/global-state';
import { mountCRC } from '../src/lib/mount-crc';
import { CRC_EVENT_TYPES } from '../src/lib/events/event-definitions';
import { RuntimeDiagnostics } from './support/runtime-diagnostics';

const activeControllers = new Set<ScenarioController<LifecycleLabState>>();
const activeDiagnostics = new Set<RuntimeDiagnostics>();
const activeRuntimeControllers = new Set<CRCController>();

const EMPTY_HANDLERS = Object.fromEntries(
  CRC_EVENT_TYPES.map(type => [type, 0]),
);

const BASELINE_HANDLERS = {
  ...EMPTY_HANDLERS,
  click: 4,
  contextmenu: 1,
  dblclick: 1,
  mousedown: 1,
  mousemove: 1,
  mouseout: 1,
  mouseover: 1,
  mouseup: 1,
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
    eventTargets: 0,
    instances: 0,
    nativeListeners: 0,
    handlers: EMPTY_HANDLERS,
    componentTeardowns: 0,
    mainTeardowns: 0,
    pointerCaptures: 0,
    propagationListeners: 0,
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
  for (const controller of activeRuntimeControllers) {
    controller.dispose();
  }
  activeRuntimeControllers.clear();
  for (const diagnostics of activeDiagnostics) {
    diagnostics.restore();
  }
  activeDiagnostics.clear();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('shared event lifecycle laboratory', () => {
  it('releases a layered target and its active pointer capture to the exact root baseline', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    canvas.style.cssText = 'display:block; width:100px; height:100px';
    document.body.replaceChildren(canvas);
    const diagnostics = new RuntimeDiagnostics(canvas);
    activeDiagnostics.add(diagnostics);
    const activeNativeCaptures = new Set<number>();
    vi.spyOn(canvas, 'setPointerCapture').mockImplementation(pointerId => {
      activeNativeCaptures.add(pointerId);
    });
    vi.spyOn(canvas, 'hasPointerCapture').mockImplementation(pointerId =>
      activeNativeCaptures.has(pointerId),
    );
    vi.spyOn(canvas, 'releasePointerCapture').mockImplementation(pointerId => {
      activeNativeCaptures.delete(pointerId);
    });
    let ghostLossCalls = 0;
    const CaptureLayerScene = defineComp<{ show: boolean }>(({ show }) =>
      show ? layer({
        render: rect({
          style: { x: 0, y: 0, width: 50, height: 50, fill: '#2563eb' },
          onPointerDown: event => {
            event.currentTarget.setPointerCapture(event.pointerId);
          },
          onLostPointerCapture: () => { ghostLossCalls++; },
        }),
      }) : undefined,
    );
    const controller = crc(canvas, CaptureLayerScene({ show: true }));
    activeRuntimeControllers.add(controller);
    await settleFrames();

    expect(diagnostics.snapshot()).toMatchObject({
      eventTargets: 1,
      instances: 2,
      nativeListeners: 2,
      pointerCaptures: 0,
      propagationListeners: 0,
      scheduledFrames: 0,
    });

    dispatchPointerDown(canvas, 25, 25, 71);
    expect(activeNativeCaptures).toEqual(new Set([71]));
    expect(diagnostics.snapshot()).toMatchObject({
      eventTargets: 1,
      instances: 2,
      nativeListeners: 4,
      pointerCaptures: 1,
      propagationListeners: 0,
    });

    crc(canvas, CaptureLayerScene({ show: false }));
    await settleFrames();
    expect(activeNativeCaptures).toEqual(new Set());
    expect(diagnostics.snapshot()).toMatchObject({
      eventTargets: 0,
      instances: 1,
      nativeListeners: 0,
      pointerCaptures: 0,
      propagationListeners: 0,
      scheduledFrames: 0,
    });
    canvas.dispatchEvent(new PointerEvent('lostpointercapture', {
      bubbles: true,
      pointerId: 71,
      pointerType: 'touch',
    }));
    expect(ghostLossCalls).toBe(0);
    expect(diagnostics.ledgerSnapshot().nativeListeners).toMatchObject({
      acquired: 4,
      duplicateReleases: 0,
      live: 0,
      released: 4,
    });

    controller.dispose();
    activeRuntimeControllers.delete(controller);
    expectFullyReleased(diagnostics);
  });

  it('fails closed and releases partial layout ownership after duplicate keys', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 120;
    document.body.replaceChildren(canvas);
    const diagnostics = new RuntimeDiagnostics(canvas);
    activeDiagnostics.add(diagnostics);
    const scene = absolute({
      style: { width: 200, height: 120 },
      children: [
        rect({
          key: 'duplicate',
          style: { width: 80, height: 60, fill: '#2563eb' },
          onClick: () => undefined,
        }),
        rect({
          key: 'duplicate',
          style: { left: 90, width: 80, height: 60, fill: '#7c3aed' },
          onClick: () => undefined,
        }),
      ],
    });
    const controller = mountCRC(canvas, scene);
    activeRuntimeControllers.add(controller);
    diagnostics.snapshot();
    diagnostics.ledgerSnapshot();

    expect(() => executeRender(canvas, 1)).toThrowError(/duplicate.*key/i);
    const instance = getCRCInstance(canvas);
    expect(instance.refs.size).toBe(0);
    expect(instance.regions.size).toBe(0);
    expect(instance.paintEntries.size).toBe(0);
    expect(diagnostics.snapshot()).toMatchObject({
      componentTeardowns: 0,
      eventTargets: 0,
      handlers: EMPTY_HANDLERS,
      instances: 1,
      nativeListeners: 0,
      pointerCaptures: 0,
      propagationListeners: 0,
      scheduledFrames: 0,
    });
    expect(diagnostics.ledgerSnapshot().handlers.click).toEqual({
      acquired: 1,
      released: 1,
      duplicateReleases: 0,
      live: 0,
    });
    expect(GLOBAL_STATE).toMatchObject({
      canvas: undefined,
      componentRefs: undefined,
      currentCRCInstance: undefined,
      layoutStack: undefined,
      renderContext: undefined,
      seenIds: undefined,
      seenKeys: undefined,
      unseenIds: undefined,
    });
    expect(GLOBAL_STATE.clippingStack).toEqual([]);

    controller.dispose();
    activeRuntimeControllers.delete(controller);
    expectFullyReleased(diagnostics);
  });

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
      eventTargets: 4,
      instances: 1,
      nativeListeners: 7,
      handlers: BASELINE_HANDLERS,
      pointerCaptures: 0,
      propagationListeners: 0,
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
    expect(diagnostics.snapshot()).toMatchObject({
      eventTargets: 3,
      handlers: {
        ...BASELINE_HANDLERS,
        click: 3,
        contextmenu: 0,
        dblclick: 0,
        mousedown: 0,
        mousemove: 0,
        mouseout: 0,
        mouseover: 0,
        mouseup: 0,
      },
    });
    expect(pixelAt(canvas, 50, 80)).toEqual([100, 116, 139, 255]);
    dispatchMouse(canvas, 'click', 50, 80);
    expect(controller.getState().calls).toBe(2);

    dispatchMouse(canvas, 'mousemove', 180, 80);
    expect(canvas.style.cursor).toBe('pointer');
    await controller.perform('remove-subtree');
    expect(canvas.style.cursor).toBe('');
    expect(pixelAt(canvas, 180, 80)).toEqual([248, 250, 252, 255]);
    expect(diagnostics.snapshot()).toMatchObject({
      eventTargets: 2,
      handlers: {
        ...EMPTY_HANDLERS,
        click: 2,
      },
    });
    dispatchMouse(canvas, 'click', 180, 80);
    expect(controller.getState().calls).toBe(2);

    const beforeLayer = diagnostics.snapshot();
    await controller.perform('add-layer');
    expect(diagnostics.snapshot()).toMatchObject({
      eventTargets: 3,
      instances: 2,
      nativeListeners: 5,
      pointerCaptures: 0,
      propagationListeners: 0,
    });
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
    expect(afterAbortRemount).toMatchObject({ instances: 1, nativeListeners: 7 });
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

function settleFrames(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() =>
    requestAnimationFrame(() => resolve()),
  ));
}

function dispatchPointerDown(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  pointerId: number,
): void {
  const bounds = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    clientX: bounds.left + x,
    clientY: bounds.top + y,
    pointerId,
    pointerType: 'touch',
  }));
}

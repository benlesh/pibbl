import type { CRCBasicMouseEvents, CRCController } from '../src/lib/types';
import { crc, crcEvent, defineComp, layer, rect } from '@crc/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearSharedState } from '../src/lib/global-state';
import { RuntimeDiagnostics } from './support/runtime-diagnostics';

const activeDiagnostics = new Set<RuntimeDiagnostics>();
const activeControllers = new Set<CRCController>();

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

const ONE_REGION_HANDLERS = {
  click: 1,
  contextmenu: 1,
  dblclick: 1,
  mousedown: 1,
  mousemove: 3,
  mouseout: 2,
  mouseover: 0,
  mouseup: 1,
};

interface ProbeSceneProps {
  calls: number[];
  enabled: boolean;
  generation: number;
  show: boolean;
}

function handlers(generation: number, calls: number[]): Required<CRCBasicMouseEvents> {
  const handler = () => calls.push(generation);
  return {
    onClick: handler,
    onContextMenu: handler,
    onDblClick: handler,
    onMouseDown: handler,
    onMouseMove: handler,
    onMouseOut: handler,
    onMouseOver: handler,
    onMouseUp: handler,
  };
}

const ProbeScene = defineComp<ProbeSceneProps>(({ calls, enabled, generation, show }) => show ? rect({
  x: 20,
  y: 20,
  width: 100,
  height: 100,
  fillStyle: '#2563eb',
  ...(enabled ? handlers(generation, calls) : {}),
}) : undefined);

const ToggleNestedLayerScene = defineComp<ProbeSceneProps>(({ calls, enabled, generation, show }) =>
  show ? layer({
    key: 'outer-layer',
    render: layer({
      key: 'inner-layer',
      render: rect({
        key: 'nested-region',
        x: 20,
        y: 20,
        width: 100,
        height: 100,
        fillStyle: '#7c3aed',
        ...(enabled ? handlers(generation, calls) : {}),
      }),
    }),
  }) : undefined,
);

const PersistentLayerScene = defineComp<ProbeSceneProps>(({ calls, enabled, generation }) => layer({
  key: 'persistent-layer',
  render: rect({
    key: 'persistent-region',
    x: 20,
    y: 20,
    width: 100,
    height: 100,
    fillStyle: '#7c3aed',
    onClick: enabled ? () => calls.push(generation) : undefined,
  }),
}));

const FirstLayerRoot = defineComp<{ calls: string[] }>(({ calls }) => rect({
  x: 20,
  y: 20,
  width: 100,
  height: 100,
  fillStyle: '#2563eb',
  onClick: () => calls.push('first'),
}));

const SecondLayerRoot = defineComp<{ calls: string[] }>(({ calls }) => rect({
  x: 20,
  y: 20,
  width: 100,
  height: 100,
  fillStyle: '#7c3aed',
  onClick: () => calls.push('second'),
}));

const SwitchingLayerScene = defineComp<{ calls: string[]; second: boolean }>(({ calls, second }) => layer({
  key: 'switching-layer',
  render: second ? SecondLayerRoot({ calls }) : FirstLayerRoot({ calls }),
}));

const CursorOwnershipScene = defineComp(() => [
  rect({
    key: 'first-cursor',
    x: 20,
    y: 20,
    width: 60,
    height: 60,
    fillStyle: '#2563eb',
    cursor: 'pointer',
  }),
  rect({
    key: 'second-cursor',
    x: 100,
    y: 20,
    width: 60,
    height: 60,
    fillStyle: '#7c3aed',
    cursor: 'crosshair',
  }),
]);

const ObserverScene = defineComp<{ calls: string[] }>(({ calls }) => {
  crcEvent('click', () => {
    calls.push('throws');
    throw new Error('expected lifecycle handler error');
  });
  crcEvent('click', () => calls.push('safe'));
  return rect({ x: 0, y: 0, width: 160, height: 120, fillStyle: '#f8fafc' });
});

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function createHarness() {
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 160;
  canvas.style.cssText = 'display:block; width:200px; height:160px';
  document.body.replaceChildren(canvas);
  const diagnostics = new RuntimeDiagnostics(canvas);
  activeDiagnostics.add(diagnostics);
  return { canvas, diagnostics };
}

function track(controller: CRCController): CRCController {
  activeControllers.add(controller);
  return controller;
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

afterEach(() => {
  for (const controller of activeControllers) {
    controller.dispose();
  }
  activeControllers.clear();
  for (const diagnostics of activeDiagnostics) {
    diagnostics.restore();
  }
  activeDiagnostics.clear();
  clearSharedState();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('event lifecycle ownership', () => {
  it('keeps every handler and teardown count stable across 1,000 settled rerenders', async () => {
    const { canvas, diagnostics } = createHarness();
    const calls: number[] = [];
    const abortController = new AbortController();
    track(crc(canvas, ProbeScene({ calls, enabled: true, generation: 0, show: true }), {
      signal: abortController.signal,
    }));
    await nextFrame();

    const baseline = diagnostics.snapshot();
    expect(baseline).toMatchObject({
      instances: 1,
      nativeListeners: 8,
      handlers: ONE_REGION_HANDLERS,
      scheduledFrames: 0,
    });

    for (let generation = 1; generation <= 1_000; generation++) {
      crc(canvas, ProbeScene({ calls, enabled: true, generation, show: true }));
      await nextFrame();
    }
    expect(diagnostics.snapshot()).toEqual(baseline);

    canvas.dispatchEvent(new MouseEvent('click', { clientX: 40, clientY: 40 }));
    expect(calls).toEqual([1_000]);
    const liveLedger = diagnostics.ledgerSnapshot();
    for (const eventLedger of Object.values(liveLedger.handlers)) {
      expect(eventLedger.acquired - eventLedger.released).toBe(eventLedger.live);
      expect(eventLedger.duplicateReleases).toBe(0);
    }
  }, 30_000);

  it('replaces, removes, and unmounts handlers without ghost calls', async () => {
    const { canvas, diagnostics } = createHarness();
    const calls: number[] = [];
    const controller = track(crc(
      canvas,
      ProbeScene({ calls, enabled: true, generation: 1, show: true }),
    ));
    await nextFrame();
    const baseline = diagnostics.snapshot();

    crc(canvas, ProbeScene({ calls, enabled: true, generation: 2, show: true }));
    await nextFrame();
    expect(diagnostics.snapshot()).toEqual(baseline);
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 40, clientY: 40 }));
    expect(calls).toEqual([2]);

    crc(canvas, ProbeScene({ calls, enabled: false, generation: 2, show: true }));
    await nextFrame();
    expect(diagnostics.snapshot().handlers).toEqual(EMPTY_HANDLERS);
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 40, clientY: 40 }));
    expect(calls).toEqual([2]);

    crc(canvas, ProbeScene({ calls, enabled: true, generation: 3, show: true }));
    await nextFrame();
    crc(canvas, ProbeScene({ calls, enabled: true, generation: 3, show: false }));
    await nextFrame();
    expect(diagnostics.snapshot().handlers).toEqual(EMPTY_HANDLERS);
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 40, clientY: 40 }));
    expect(calls).toEqual([2]);

    controller.dispose();
    expectFullyReleased(diagnostics);
  });

  it('cancels immediate work and disposes a no-signal mount idempotently', () => {
    const { canvas, diagnostics } = createHarness();
    const controller = track(crc(
      canvas,
      ProbeScene({ calls: [], enabled: true, generation: 1, show: true }),
    ));
    expect(diagnostics.snapshot().scheduledFrames).toBe(1);

    controller.dispose();
    controller.dispose();

    expectFullyReleased(diagnostics);
    expect(diagnostics.ledgerSnapshot().frames).toMatchObject({
      requested: 1,
      canceled: 1,
      pending: 0,
    });
  });

  it('cancels legal animation-frame id zero and makes its dequeued callback inert', () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;
    let pendingCallback: FrameRequestCallback | undefined;
    const canceled: number[] = [];
    window.requestAnimationFrame = (callback) => {
      pendingCallback = callback;
      return 0;
    };
    window.cancelAnimationFrame = frameId => canceled.push(frameId);

    try {
      const canvas = document.createElement('canvas');
      const controller = track(crc(
        canvas,
        ProbeScene({ calls: [], enabled: true, generation: 1, show: true }),
      ));
      controller.dispose();

      expect(canceled).toEqual([0]);
      expect(() => pendingCallback?.(1)).not.toThrow();
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame;
      window.cancelAnimationFrame = originalCancelAnimationFrame;
    }
  });

  it('keeps a remount live when its stale controller and signal clean up again', async () => {
    const { canvas, diagnostics } = createHarness();
    const calls: number[] = [];
    const staleAbort = new AbortController();
    const staleController = track(crc(
      canvas,
      ProbeScene({ calls, enabled: true, generation: 1, show: true }),
      { signal: staleAbort.signal },
    ));
    await nextFrame();
    staleController.dispose();

    const liveController = track(crc(
      canvas,
      ProbeScene({ calls, enabled: true, generation: 2, show: true }),
    ));
    await nextFrame();
    const remounted = diagnostics.snapshot();

    staleController.dispose();
    staleAbort.abort();
    expect(diagnostics.snapshot()).toEqual(remounted);
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 40, clientY: 40 }));
    expect(calls).toEqual([2]);

    liveController.dispose();
    expectFullyReleased(diagnostics);
  });

  it('uses only the initial mount signal for an existing Canvas lifetime', async () => {
    const { canvas, diagnostics } = createHarness();
    const calls: number[] = [];
    const mountAbort = new AbortController();
    const updateAbort = new AbortController();
    const controller = track(crc(
      canvas,
      ProbeScene({ calls, enabled: true, generation: 1, show: true }),
      { signal: mountAbort.signal },
    ));
    await nextFrame();

    const updatedController = crc(
      canvas,
      ProbeScene({ calls, enabled: true, generation: 2, show: true }),
      { signal: updateAbort.signal },
    );
    expect(updatedController).toBe(controller);
    await nextFrame();

    updateAbort.abort();
    expect(diagnostics.snapshot().instances).toBe(1);
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 40, clientY: 40 }));
    expect(calls).toEqual([2]);

    mountAbort.abort();
    expectFullyReleased(diagnostics);
  });

  it('releases nested layer instances and bridges when their subtree disappears', async () => {
    const { canvas, diagnostics } = createHarness();
    const calls: number[] = [];
    const controller = track(crc(
      canvas,
      ToggleNestedLayerScene({ calls, enabled: true, generation: 1, show: true }),
    ));
    await nextFrame();
    expect(diagnostics.snapshot().instances).toBe(3);

    crc(canvas, ToggleNestedLayerScene({ calls, enabled: true, generation: 1, show: false }));
    await nextFrame();
    expect(diagnostics.snapshot()).toMatchObject({
      instances: 1,
      nativeListeners: 8,
      handlers: EMPTY_HANDLERS,
      scheduledFrames: 0,
    });
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 40, clientY: 40 }));
    expect(calls).toEqual([]);

    controller.dispose();
    expectFullyReleased(diagnostics);
  });

  it('updates handlers inside a persistent layer and removes them without ghosts', async () => {
    const { canvas, diagnostics } = createHarness();
    const calls: number[] = [];
    const controller = track(crc(
      canvas,
      PersistentLayerScene({ calls, enabled: true, generation: 1, show: true }),
    ));
    await nextFrame();

    canvas.dispatchEvent(new MouseEvent('click', { clientX: 40, clientY: 40 }));
    expect(calls).toEqual([1]);

    crc(canvas, PersistentLayerScene({ calls, enabled: true, generation: 2, show: true }));
    await nextFrame();
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 40, clientY: 40 }));
    expect(calls).toEqual([1, 2]);

    crc(canvas, PersistentLayerScene({ calls, enabled: false, generation: 2, show: true }));
    await nextFrame();
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 40, clientY: 40 }));
    expect(calls).toEqual([1, 2]);

    controller.dispose();
    expectFullyReleased(diagnostics);
  });

  it('replaces a persistent layer root when its component type changes', async () => {
    const { canvas, diagnostics } = createHarness();
    const calls: string[] = [];
    const controller = track(crc(canvas, SwitchingLayerScene({ calls, second: false })));
    await nextFrame();
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 40, clientY: 40 }));

    crc(canvas, SwitchingLayerScene({ calls, second: true }));
    await nextFrame();
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 40, clientY: 40 }));
    expect(calls).toEqual(['first', 'second']);

    controller.dispose();
    expectFullyReleased(diagnostics);
  });

  it('does not clear a cursor value replaced by another owner', async () => {
    const { canvas, diagnostics } = createHarness();
    const controller = track(crc(canvas, CursorOwnershipScene({})));
    await nextFrame();

    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, clientY: 40 }));
    expect(canvas.style.cursor).toBe('pointer');
    canvas.style.cursor = 'wait';

    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 120, clientY: 40 }));
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 180, clientY: 120 }));
    expect(canvas.style.cursor).toBe('wait');

    controller.dispose();
    expect(canvas.style.cursor).toBe('wait');
    expectFullyReleased(diagnostics);
  });

  it('reports a thrown observer and continues the same native dispatch and cleanup', async () => {
    const { canvas, diagnostics } = createHarness();
    const calls: string[] = [];
    const expectedError = vi.spyOn(globalThis, 'reportError').mockImplementation(() => {});
    const controller = track(crc(canvas, ObserverScene({ calls })));
    await nextFrame();
    diagnostics.snapshot();

    canvas.dispatchEvent(new MouseEvent('click', { clientX: 40, clientY: 40 }));
    expect(calls).toEqual(['throws', 'safe']);
    expect(expectedError).toHaveBeenCalledOnce();

    controller.dispose();
    expectFullyReleased(diagnostics);
  });
});

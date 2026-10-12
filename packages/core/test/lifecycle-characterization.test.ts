import type { PibblEventHandlers } from '../src/lib/events/types';
import type { PibblController } from '../src/lib/types';
import { pibbl, useCursor, Layer, Rectangle } from '@pibbl/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearSharedState,
  getPibblInstance,
  GLOBAL_STATE,
} from '../src/lib/global-state';
import { PIBBL_EVENT_TYPES } from '../src/lib/events/event-definitions';
import { RuntimeDiagnostics } from './support/runtime-diagnostics';
import { createElement } from '@pibbl/core';

const activeDiagnostics = new Set<RuntimeDiagnostics>();
const activeControllers = new Set<PibblController>();

const EMPTY_HANDLERS = Object.fromEntries(
  PIBBL_EVENT_TYPES.map(type => [type, 0]),
);

const EMPTY_FOCUS_DIAGNOSTICS = {
  documentListeners: 0,
  enhancers: 0,
  focusCandidates: 0,
  focusManagers: 0,
  focusedTarget: null,
  focusedTargets: 0,
  navigationBoundaries: 0,
  pendingActivations: 0,
  tabIndex: {
    current: { existed: false, value: null },
    original: { existed: false, value: null },
    owned: false,
  },
} as const;

const ONE_REGION_HANDLERS = {
  ...EMPTY_HANDLERS,
  click: 1,
  contextmenu: 1,
  dblclick: 1,
  mousedown: 1,
  mousemove: 1,
  mouseout: 1,
  mouseover: 1,
  mouseup: 1,
};

interface ProbeSceneProps {
  calls: number[];
  enabled: boolean;
  generation: number;
  show: boolean;
}

type ShippedMouseHandlers = Required<Pick<
  PibblEventHandlers,
  | 'onClick'
  | 'onContextMenu'
  | 'onDblClick'
  | 'onMouseDown'
  | 'onMouseMove'
  | 'onMouseOut'
  | 'onMouseOver'
  | 'onMouseUp'
>>;

function handlers(
  generation: number,
  calls: number[],
): ShippedMouseHandlers {
  const noop = () => undefined;
  return {
    onClick: () => calls.push(generation),
    onContextMenu: noop,
    onDblClick: noop,
    onMouseDown: noop,
    onMouseMove: noop,
    onMouseOut: noop,
    onMouseOver: noop,
    onMouseUp: noop,
  };
}

const ProbeScene = ({ calls, enabled, generation, show }: ProbeSceneProps) => show ? createElement(Rectangle, {
  style: {
    left: 20,
    top: 20,
    width: 100,
    height: 100,
    fill: '#2563eb',
  },
  ...(enabled ? handlers(generation, calls) : {}),
}) : undefined;

const ToggleNestedLayerScene = ({ calls, enabled, generation, show }: ProbeSceneProps) =>
  show ? createElement(Layer, {
    key: 'outer-layer',
    children: createElement(Layer, {
      key: 'inner-layer',
      children: createElement(Rectangle, {
        key: 'nested-region',
        style: {
          left: 20,
          top: 20,
          width: 100,
          height: 100,
          fill: '#7c3aed',
        },
        ...(enabled ? handlers(generation, calls) : {}),
      }),
    }),
  }) : undefined;

const PersistentLayerScene = ({ calls, enabled, generation }: ProbeSceneProps) => createElement(Layer, {
  key: 'persistent-layer',
  children: createElement(Rectangle, {
    key: 'persistent-region',
    style: {
      left: 20,
      top: 20,
      width: 100,
      height: 100,
      fill: '#7c3aed',
    },
    onClick: enabled ? () => calls.push(generation) : undefined,
  }),
});

const FirstLayerRoot = ({ calls }: { calls: string[] }) => createElement(Rectangle, {
  style: {
    left: 20,
    top: 20,
    width: 100,
    height: 100,
    fill: '#2563eb',
  },
  onClick: () => calls.push('first'),
});

const SecondLayerRoot = ({ calls }: { calls: string[] }) => createElement(Rectangle, {
  style: {
    left: 20,
    top: 20,
    width: 100,
    height: 100,
    fill: '#7c3aed',
  },
  onClick: () => calls.push('second'),
});

const SwitchingLayerScene = ({ calls, second }: { calls: string[]; second: boolean }) => createElement(Layer, {
  key: 'switching-layer',
  children: second ? createElement(SecondLayerRoot, { calls }) : createElement(FirstLayerRoot, { calls }),
});

const CursorOwnershipScene = (_props: {}) => [
  createElement(Rectangle, {
    key: 'first-cursor',
    style: {
      left: 20,
      top: 20,
      width: 60,
      height: 60,
      fill: '#2563eb',
      cursor: 'pointer',
    },
  }),
  createElement(Rectangle, {
    key: 'second-cursor',
    style: {
      left: 100,
      top: 20,
      width: 60,
      height: 60,
      fill: '#7c3aed',
      cursor: 'crosshair',
    },
  }),
];

const LayerGlobalResources = ({ calls }: { calls: string[] }) => {
  useCursor({ style: 'wait' });
  return createElement(Rectangle, {
    style: {
      left: 20,
      top: 20,
      width: 100,
      height: 100,
      fill: '#7c3aed',
    },
    onMouseMove: () => calls.push('target'),
  });
};

const LayerGlobalResourcesScene = ({ calls, show }: { calls: string[]; show: boolean }) =>
  show ? createElement(Layer, {
    key: 'global-resource-layer',
    children: createElement(LayerGlobalResources, { calls }),
  }) : undefined;

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function clickCanvas(canvas: HTMLCanvasElement, x: number, y: number): void {
  const init = { bubbles: true, button: 0, clientX: x, clientY: y };
  canvas.dispatchEvent(new MouseEvent('mousedown', init));
  canvas.dispatchEvent(new MouseEvent('mouseup', init));
  canvas.dispatchEvent(new MouseEvent('click', init));
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

function drive(controller: PibblController): PibblController {
  activeControllers.add(controller);
  return controller;
}

function expectFullyReleased(diagnostics: RuntimeDiagnostics): void {
  expect(diagnostics.snapshot()).toEqual({
    ...EMPTY_FOCUS_DIAGNOSTICS,
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
    drive(pibbl(canvas, createElement(ProbeScene, { calls, enabled: true, generation: 0, show: true }), {
      signal: abortController.signal,
    }));
    await nextFrame();

    const baseline = diagnostics.snapshot();
    expect(baseline).toMatchObject({
      instances: 1,
      nativeListeners: 7,
      handlers: ONE_REGION_HANDLERS,
      scheduledFrames: 0,
    });

    for (let generation = 1; generation <= 1_000; generation++) {
      pibbl(canvas, createElement(ProbeScene, { calls, enabled: true, generation, show: true }));
      await nextFrame();
    }
    expect(diagnostics.snapshot()).toEqual(baseline);

    clickCanvas(canvas, 40, 40);
    expect(calls).toEqual([1_000]);
    const liveLedger = diagnostics.ledgerSnapshot();
    for (const eventLedger of Object.values(liveLedger.handlers)) {
      expect(eventLedger.acquired - eventLedger.released).toBe(eventLedger.live);
      expect(eventLedger.duplicateReleases).toBe(0);
    }
  }, 60_000);

  it('replaces, removes, and unmounts handlers without ghost calls', async () => {
    const { canvas, diagnostics } = createHarness();
    const calls: number[] = [];
    const controller = drive(pibbl(
      canvas,
      createElement(ProbeScene, { calls, enabled: true, generation: 1, show: true }),
    ));
    await nextFrame();
    const baseline = diagnostics.snapshot();

    pibbl(canvas, createElement(ProbeScene, { calls, enabled: true, generation: 2, show: true }));
    await nextFrame();
    expect(diagnostics.snapshot()).toEqual(baseline);
    clickCanvas(canvas, 40, 40);
    expect(calls).toEqual([2]);

    pibbl(canvas, createElement(ProbeScene, { calls, enabled: false, generation: 2, show: true }));
    await nextFrame();
    expect(diagnostics.snapshot().handlers).toEqual(EMPTY_HANDLERS);
    clickCanvas(canvas, 40, 40);
    expect(calls).toEqual([2]);

    pibbl(canvas, createElement(ProbeScene, { calls, enabled: true, generation: 3, show: true }));
    await nextFrame();
    pibbl(canvas, createElement(ProbeScene, { calls, enabled: true, generation: 3, show: false }));
    await nextFrame();
    expect(diagnostics.snapshot().handlers).toEqual(EMPTY_HANDLERS);
    clickCanvas(canvas, 40, 40);
    expect(calls).toEqual([2]);

    controller.dispose();
    expectFullyReleased(diagnostics);
  });

  it('cancels immediate work and disposes a no-signal mount idempotently', () => {
    const { canvas, diagnostics } = createHarness();
    const controller = drive(pibbl(
      canvas,
      createElement(ProbeScene, { calls: [], enabled: true, generation: 1, show: true }),
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
      const controller = drive(pibbl(
        canvas,
        createElement(ProbeScene, { calls: [], enabled: true, generation: 1, show: true }),
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
    const staleController = drive(pibbl(
      canvas,
      createElement(ProbeScene, { calls, enabled: true, generation: 1, show: true }),
      { signal: staleAbort.signal },
    ));
    await nextFrame();
    staleController.dispose();

    const liveController = drive(pibbl(
      canvas,
      createElement(ProbeScene, { calls, enabled: true, generation: 2, show: true }),
    ));
    await nextFrame();
    const remounted = diagnostics.snapshot();

    staleController.dispose();
    staleAbort.abort();
    expect(diagnostics.snapshot()).toEqual(remounted);
    clickCanvas(canvas, 40, 40);
    expect(calls).toEqual([2]);

    liveController.dispose();
    expectFullyReleased(diagnostics);
  });

  it('uses only the initial mount signal for an existing Canvas lifetime', async () => {
    const { canvas, diagnostics } = createHarness();
    const calls: number[] = [];
    const mountAbort = new AbortController();
    const updateAbort = new AbortController();
    const controller = drive(pibbl(
      canvas,
      createElement(ProbeScene, { calls, enabled: true, generation: 1, show: true }),
      { signal: mountAbort.signal },
    ));
    await nextFrame();

    const updatedController = pibbl(
      canvas,
      createElement(ProbeScene, { calls, enabled: true, generation: 2, show: true }),
      { signal: updateAbort.signal },
    );
    expect(updatedController).toBe(controller);
    await nextFrame();

    updateAbort.abort();
    expect(diagnostics.snapshot().instances).toBe(1);
    clickCanvas(canvas, 40, 40);
    expect(calls).toEqual([2]);

    mountAbort.abort();
    expectFullyReleased(diagnostics);
  });

  it('releases nested layer instances when their subtree disappears', async () => {
    const { canvas, diagnostics } = createHarness();
    const calls: number[] = [];
    const controller = drive(pibbl(
      canvas,
      createElement(ToggleNestedLayerScene, { calls, enabled: true, generation: 1, show: true }),
    ));
    await nextFrame();
    expect(diagnostics.snapshot().instances).toBe(3);

    pibbl(canvas, createElement(ToggleNestedLayerScene, { calls, enabled: true, generation: 1, show: false }));
    await nextFrame();
    expect(diagnostics.snapshot()).toMatchObject({
      instances: 1,
      nativeListeners: 0,
      handlers: EMPTY_HANDLERS,
      scheduledFrames: 0,
    });
    clickCanvas(canvas, 40, 40);
    expect(calls).toEqual([]);

    controller.dispose();
    expectFullyReleased(diagnostics);
  });

  it('releases layered paint entries and root cursor defaults', async () => {
    const { canvas, diagnostics } = createHarness();
    const calls: string[] = [];
    const controller = drive(pibbl(canvas, createElement(LayerGlobalResourcesScene, { calls, show: true })));
    await nextFrame();
    const root = getPibblInstance(canvas);

    expect(diagnostics.snapshot()).toMatchObject({ instances: 2, nativeListeners: 2 });
    expect(root.paintEntries.size).toBe(1);
    expect(root.cursorDefaults.size).toBe(1);

    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, clientY: 40 }));
    expect(calls).toEqual(['target']);
    expect(canvas.style.cursor).toBe('wait');

    pibbl(canvas, createElement(LayerGlobalResourcesScene, { calls, show: false }));
    await nextFrame();
    expect(GLOBAL_STATE.pibblInstances.size).toBe(1);
    expect(root.paintEntries.size).toBe(0);
    expect(root.cursorDefaults.size).toBe(0);
    expect(root.interaction.hoveredRegion).toBeUndefined();
    expect(canvas.style.cursor).toBe('');

    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, clientY: 40 }));
    expect(calls).toEqual(['target']);

    controller.dispose();
    expectFullyReleased(diagnostics);
  });

  it('updates handlers inside a persistent layer and removes them without ghosts', async () => {
    const { canvas, diagnostics } = createHarness();
    const calls: number[] = [];
    const controller = drive(pibbl(
      canvas,
      createElement(PersistentLayerScene, { calls, enabled: true, generation: 1, show: true }),
    ));
    await nextFrame();

    clickCanvas(canvas, 40, 40);
    expect(calls).toEqual([1]);

    pibbl(canvas, createElement(PersistentLayerScene, { calls, enabled: true, generation: 2, show: true }));
    await nextFrame();
    clickCanvas(canvas, 40, 40);
    expect(calls).toEqual([1, 2]);

    pibbl(canvas, createElement(PersistentLayerScene, { calls, enabled: false, generation: 2, show: true }));
    await nextFrame();
    clickCanvas(canvas, 40, 40);
    expect(calls).toEqual([1, 2]);

    controller.dispose();
    expectFullyReleased(diagnostics);
  });

  it('replaces a persistent layer root when its component type changes', async () => {
    const { canvas, diagnostics } = createHarness();
    const calls: string[] = [];
    const controller = drive(pibbl(canvas, createElement(SwitchingLayerScene, { calls, second: false })));
    await nextFrame();
    clickCanvas(canvas, 40, 40);

    pibbl(canvas, createElement(SwitchingLayerScene, { calls, second: true }));
    await nextFrame();
    clickCanvas(canvas, 40, 40);
    expect(calls).toEqual(['first', 'second']);

    controller.dispose();
    expectFullyReleased(diagnostics);
  });

  it('does not clear a cursor value replaced by another owner', async () => {
    const { canvas, diagnostics } = createHarness();
    const controller = drive(pibbl(canvas, createElement(CursorOwnershipScene, {})));
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

});

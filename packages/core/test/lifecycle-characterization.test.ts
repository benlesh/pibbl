import type { CRCBasicMouseEvents } from '../src/lib/types';
import { crc, defineComp, layer, rect } from '@crc/core';
import { afterEach, describe, expect, it } from 'vitest';
import { clearSharedState } from '../src/lib/global-state';
import { RuntimeDiagnostics } from './support/runtime-diagnostics';

const activeDiagnostics = new Set<RuntimeDiagnostics>();
const activeAbortControllers = new Set<AbortController>();

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

const ProbeScene = defineComp<ProbeSceneProps>(({ calls, generation, show }) => show ? rect({
  x: 20,
  y: 20,
  width: 100,
  height: 100,
  fillStyle: '#2563eb',
  ...handlers(generation, calls),
}) : undefined);

const ToggleNestedLayerScene = defineComp<ProbeSceneProps>(({ calls, generation, show }) =>
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
        ...handlers(generation, calls),
      }),
    }),
  }) : undefined,
);

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
  const abortController = new AbortController();
  activeDiagnostics.add(diagnostics);
  activeAbortControllers.add(abortController);
  return { abortController, canvas, diagnostics };
}

afterEach(() => {
  for (const abortController of activeAbortControllers) {
    abortController.abort();
  }
  activeAbortControllers.clear();
  for (const diagnostics of activeDiagnostics) {
    diagnostics.restore();
  }
  activeDiagnostics.clear();
  clearSharedState();
  document.body.replaceChildren();
});

describe('lifecycle characterization', () => {
  it('freezes listener, handler, teardown, instance, and frame counts across 100 real rerenders', async () => {
    const { abortController, canvas, diagnostics } = createHarness();
    const calls: number[] = [];
    crc(canvas, ProbeScene({ calls, generation: 0, show: true }), { signal: abortController.signal });

    expect(diagnostics.snapshot()).toEqual({
      instances: 1,
      nativeListeners: 8,
      handlers: EMPTY_HANDLERS,
      componentTeardowns: 0,
      mainTeardowns: 1,
      scheduledFrames: 1,
    });

    await nextFrame();
    expect(diagnostics.snapshot()).toEqual({
      instances: 1,
      nativeListeners: 8,
      handlers: ONE_REGION_HANDLERS,
      componentTeardowns: 4,
      mainTeardowns: 3,
      scheduledFrames: 0,
    });

    for (let generation = 1; generation <= 100; generation++) {
      crc(canvas, ProbeScene({ calls, generation, show: true }), { signal: abortController.signal });
      await nextFrame();
    }
    expect(diagnostics.snapshot()).toEqual({
      instances: 1,
      nativeListeners: 8,
      handlers: ONE_REGION_HANDLERS,
      componentTeardowns: 204,
      mainTeardowns: 3,
      scheduledFrames: 0,
    });

    crc(canvas, ProbeScene({ calls, generation: 101, show: true }), { signal: abortController.signal });
    await nextFrame();
    expect(diagnostics.snapshot()).toEqual({
      instances: 1,
      nativeListeners: 8,
      handlers: ONE_REGION_HANDLERS,
      componentTeardowns: 206,
      mainTeardowns: 3,
      scheduledFrames: 0,
    });

    canvas.dispatchEvent(new MouseEvent('click', { clientX: 40, clientY: 40 }));
    expect(calls).toEqual([101]);
  });

  it('captures the current subtree-removal handler retention', async () => {
    const { abortController, canvas, diagnostics } = createHarness();
    const calls: number[] = [];
    crc(canvas, ProbeScene({ calls, generation: 1, show: true }), { signal: abortController.signal });
    await nextFrame();
    crc(canvas, ProbeScene({ calls, generation: 2, show: false }), { signal: abortController.signal });
    await nextFrame();

    expect(diagnostics.snapshot()).toEqual({
      instances: 1,
      nativeListeners: 8,
      handlers: {
        click: 1,
        contextmenu: 1,
        dblclick: 1,
        mousedown: 1,
        mousemove: 1,
        mouseout: 0,
        mouseover: 0,
        mouseup: 1,
      },
      componentTeardowns: 1,
      mainTeardowns: 2,
      scheduledFrames: 0,
    });

    canvas.dispatchEvent(new MouseEvent('click', { clientX: 40, clientY: 40 }));
    expect(calls).toEqual([1]);
  });

  it('captures settled abort cleanup', async () => {
    const { abortController, canvas, diagnostics } = createHarness();
    crc(canvas, ProbeScene({ calls: [], generation: 1, show: true }), { signal: abortController.signal });
    await nextFrame();
    abortController.abort();

    expect(diagnostics.snapshot()).toEqual({
      instances: 0,
      nativeListeners: 0,
      handlers: EMPTY_HANDLERS,
      componentTeardowns: 0,
      mainTeardowns: 0,
      scheduledFrames: 0,
    });
  });

  it('freezes nested-layer retention across removal and root abort', async () => {
    const { abortController, canvas, diagnostics } = createHarness();
    const props = { calls: [], generation: 1, show: true };
    crc(canvas, ToggleNestedLayerScene(props), { signal: abortController.signal });
    await nextFrame();

    expect(diagnostics.snapshot()).toEqual({
      instances: 3,
      nativeListeners: 8,
      handlers: {
        click: 3,
        contextmenu: 3,
        dblclick: 3,
        mousedown: 3,
        mousemove: 5,
        mouseout: 4,
        mouseover: 2,
        mouseup: 3,
      },
      componentTeardowns: 6,
      mainTeardowns: 21,
      scheduledFrames: 0,
    });

    crc(canvas, ToggleNestedLayerScene({ ...props, show: false }), { signal: abortController.signal });
    await nextFrame();
    expect(diagnostics.snapshot()).toEqual({
      instances: 3,
      nativeListeners: 8,
      handlers: {
        click: 3,
        contextmenu: 3,
        dblclick: 3,
        mousedown: 3,
        mousemove: 5,
        mouseout: 4,
        mouseover: 2,
        mouseup: 3,
      },
      componentTeardowns: 5,
      mainTeardowns: 20,
      scheduledFrames: 0,
    });

    abortController.abort();
    expect(diagnostics.snapshot()).toEqual({
      instances: 2,
      nativeListeners: 0,
      handlers: {
        click: 2,
        contextmenu: 2,
        dblclick: 2,
        mousedown: 2,
        mousemove: 4,
        mouseout: 3,
        mouseover: 1,
        mouseup: 2,
      },
      componentTeardowns: 4,
      mainTeardowns: 18,
      scheduledFrames: 0,
    });
  });
});

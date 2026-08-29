import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComp } from '../define-comp';
import { clearSharedState, getCRCInstance } from '../global-state';
import { mountCRC } from '../mount-crc';
import { Teardowns } from '../teardowns';
import { RuntimeDiagnostics } from '../../../test/support/runtime-diagnostics';
import { createNativeListenerHub } from './native-listener-hub';

const activeDiagnostics = new Set<RuntimeDiagnostics>();

afterEach(() => {
  clearSharedState();
  for (const diagnostics of activeDiagnostics) {
    diagnostics.restore();
  }
  activeDiagnostics.clear();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('native listener hub', () => {
  it('keeps an empty HTML root free of native UI listeners', () => {
    const canvas = document.createElement('canvas');
    const diagnostics = new RuntimeDiagnostics(canvas);
    activeDiagnostics.add(diagnostics);
    const Empty = defineComp(() => undefined);

    const controller = mountCRC(canvas, Empty({}));

    expect(diagnostics.snapshot().nativeListeners).toBe(0);
    controller.dispose();
    expect(diagnostics.ledgerSnapshot().nativeListeners).toEqual({
      acquired: 0,
      duplicateReleases: 0,
      live: 0,
      released: 0,
    });
  });

  it('shares the HTML event root with layers and omits a hub for an Offscreen root', () => {
    const canvas = document.createElement('canvas');
    const Empty = defineComp(() => undefined);
    const rootController = mountCRC(canvas, Empty({}));
    const layerCanvas = new OffscreenCanvas(20, 10);
    const layerController = mountCRC(layerCanvas, Empty({}), { parent: canvas });

    expect(getCRCInstance(layerCanvas).eventRoot)
      .toBe(getCRCInstance(canvas).eventRoot);
    expect(getCRCInstance(layerCanvas).eventRoot.canvas).toBe(canvas);

    layerController.dispose();
    rootController.dispose();

    const offscreen = new OffscreenCanvas(20, 10);
    const offscreenController = mountCRC(offscreen, Empty({}));
    expect(getCRCInstance(offscreen).eventRoot).toMatchObject({
      canvas: undefined,
      nativeListeners: undefined,
    });
    offscreenController.dispose();
  });

  it('reference-counts one native listener and makes releases idempotent', () => {
    const canvas = document.createElement('canvas');
    const diagnostics = new RuntimeDiagnostics(canvas);
    activeDiagnostics.add(diagnostics);
    const teardowns = new Teardowns();
    const hub = createNativeListenerHub(canvas, () => undefined, teardowns);

    expect(diagnostics.snapshot().nativeListeners).toBe(0);
    const releaseA = hub.acquire('pointerdown');
    const releaseB = hub.acquire('pointerdown');
    expect(hub.count('pointerdown')).toBe(2);
    expect(diagnostics.snapshot().nativeListeners).toBe(1);
    releaseA();
    expect(hub.count('pointerdown')).toBe(1);
    expect(diagnostics.snapshot().nativeListeners).toBe(1);
    releaseB();
    expect(hub.count('pointerdown')).toBe(0);
    expect(diagnostics.snapshot().nativeListeners).toBe(0);
    releaseB();
    expect(diagnostics.ledgerSnapshot().nativeListeners.duplicateReleases).toBe(0);
  });

  it('uses non-passive listeners for cancellable touch and wheel input', () => {
    const canvas = document.createElement('canvas');
    const addEventListener = vi.spyOn(canvas, 'addEventListener');
    const hub = createNativeListenerHub(canvas, () => undefined, new Teardowns());

    hub.acquire('touchstart');
    hub.acquire('wheel');
    hub.acquire('pointerdown');

    expect(addEventListener).toHaveBeenCalledWith(
      'touchstart',
      expect.any(Function),
      { passive: false },
    );
    expect(addEventListener).toHaveBeenCalledWith(
      'wheel',
      expect.any(Function),
      { passive: false },
    );
    expect(addEventListener).toHaveBeenCalledWith(
      'pointerdown',
      expect.any(Function),
      false,
    );
    hub.dispose();
  });

  it('dispatches the canonical definition and disposes every live type once', () => {
    const canvas = document.createElement('canvas');
    const diagnostics = new RuntimeDiagnostics(canvas);
    activeDiagnostics.add(diagnostics);
    const dispatch = vi.fn();
    const teardowns = new Teardowns();
    const hub = createNativeListenerHub(canvas, dispatch, teardowns);
    const releasePointer = hub.acquire('pointerdown');
    hub.acquire('keydown');
    const event = new PointerEvent('pointerdown');

    canvas.dispatchEvent(event);

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pointerdown', family: 'pointer' }),
      event,
    );
    teardowns.execute();
    expect(hub.count('pointerdown')).toBe(0);
    expect(hub.count('keydown')).toBe(0);
    expect(diagnostics.ledgerSnapshot().nativeListeners).toEqual({
      acquired: 2,
      duplicateReleases: 0,
      live: 0,
      released: 2,
    });
    releasePointer();
    hub.dispose();
    expect(diagnostics.ledgerSnapshot().nativeListeners.duplicateReleases).toBe(0);
  });
});

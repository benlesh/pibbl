import { createElement, crcWhenChanged, type CRCController } from '../src/index';
import { executeRender } from '../src/lib/execute-render';
import { GLOBAL_STATE, getCRCInstance } from '../src/lib/global-state';
import { mountCRC } from '../src/lib/mount-crc';
import { snapshotRealmScheduler } from '../src/lib/scheduler/testing';
import { update } from '../src/lib/update';
import { afterEach, describe, expect, it, vi } from 'vitest';

const controllers = new Set<CRCController>();

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('backend ownership cleanup', () => {
  it('clears frame ownership before a failing cancellation and continues teardown', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 41);
    const cancellationError = new Error('cancellation failed');
    const cancel = vi.spyOn(window, 'cancelAnimationFrame')
      .mockImplementationOnce(() => {
        throw cancellationError;
      })
      .mockImplementation(() => undefined);
    const reported: unknown[] = [];
    vi.spyOn(globalThis, 'reportError').mockImplementation(error => {
      reported.push(error);
    });
    const cleanup = vi.fn();
    function OwnedComponent(): void {
      crcWhenChanged(() => cleanup, []);
    }
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const controller = mountCRC(
      canvas,
      createElement(OwnedComponent, {}),
    );
    controllers.add(controller);
    executeRender(canvas, 1);
    update(canvas);
    const instance = getCRCInstance(canvas);
    expect(snapshotRealmScheduler().pendingHostFrames).toBe(1);

    expect(() => controller.dispose()).not.toThrow();

    expect(cancel).toHaveBeenCalledOnce();
    expect(reported).toEqual([cancellationError]);
    expect(snapshotRealmScheduler().pendingHostFrames).toBe(0);
    expect(instance.mainTeardowns.closed).toBe(true);
    expect(instance.refs.size).toBe(0);
    expect(GLOBAL_STATE.crcInstances.has(canvas)).toBe(false);
    expect(cleanup).toHaveBeenCalledOnce();
    controller.dispose();
    expect(cancel).toHaveBeenCalledOnce();
  });
});

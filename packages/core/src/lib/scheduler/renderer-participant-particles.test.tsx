import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pibbl, createElement, signal } from '@pibbl/core';
import {
  pibblInternalAssertCommandAllowed,
  pibblInternalCurrentRenderOwner,
  pibblInternalOnRenderFinish,
  pibblInternalPaintTarget,
  pibblInternalQueueBegin,
  pibblInternalQueueCurrentCommit,
  pibblInternalQueueCurrentComplete,
  pibblInternalRegisterAdvance,
  pibblInternalRequestRender,
  type PibblInternalRenderOwner,
} from '@pibbl/core/internal';
import { clearSharedState, getPibblInstance } from '../global-state';
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
  snapshotRealmScheduler,
} from './testing';

let driver: ManualSchedulerDriver;
let restoreDriver: () => void;

beforeEach(() => {
  document.body.innerHTML = '';
  driver = new ManualSchedulerDriver();
  restoreDriver = installSchedulerDriverForTest(driver);
});

afterEach(() => {
  clearSharedState();
  restoreDriver();
  vi.restoreAllMocks();
});

describe('@pibbl/core/internal owner-scoped particle scheduler seam', () => {
  it('uses the active direct-write guard without mutating a signal', () => {
    let error: unknown;
    const controller = pibbl(createCanvas(), createElement(() => {
      try {
        pibblInternalAssertCommandAllowed();
      } catch (caught) {
        error = caught;
      }
    }, {}));

    driver.flush(0);

    expect(error).toMatchObject({ message: 'Pibbl render' });
    controller.dispose();
  });

  it('orders one owner command through Advance, Commit, render, and Complete', () => {
    const trace: string[] = [];
    const value = signal(0);
    let owner: PibblInternalRenderOwner | undefined;
    let recordRender = false;
    let releaseAdvance = () => {};
    const canvas = createCanvas();
    const Root = (_props: {}) => {
      owner ??= pibblInternalCurrentRenderOwner();
      value.get();
      if (recordRender) trace.push(`render:${value.get()}`);
    };
    const controller = pibbl(canvas, createElement(Root, {}));
    driver.flush(0);
    recordRender = true;

    let commandFrame: number | undefined;
    const command = pibblInternalQueueBegin(owner!, (frame, batch, sequence) => {
      pibblInternalAssertCommandAllowed();
      commandFrame = frame.frameId;
      trace.push(`begin:${sequence}`);
      batch.stage(value, 1, command);
      pibblInternalQueueCurrentCommit(owner!, (_commitFrame, outcome) => {
        expect(_commitFrame.frameId).toBe(commandFrame);
        trace.push(`commit:${sequence}:${outcome.applied}`);
      });
      pibblInternalRequestRender(owner!);
    });
    releaseAdvance = pibblInternalRegisterAdvance(owner!, (frame, batch) => {
      expect(frame.frameId).toBe(commandFrame);
      trace.push(`advance:${command.sequence}`);
      batch.stage(value, batch.read(value), releaseAdvance);
      pibblInternalQueueCurrentComplete(owner!, completeFrame => {
        expect(completeFrame.frameId).toBe(commandFrame);
        trace.push(`complete:${command.sequence}`);
      });
      releaseAdvance();
    });

    expect(command.sequence).toBe(1);
    expect(snapshotRealmScheduler()).toMatchObject({
      registeredAdvanceParticipants: 1,
      pendingHostFrames: 1,
    });

    driver.flush(1);

    expect(trace).toEqual([
      'begin:1',
      'advance:1',
      'commit:1:true',
      'render:1',
      'complete:1',
    ]);
    controller.dispose();
  });

  it('cancels Begin commands and makes later owner callbacks inert after disposal', () => {
    const trace: string[] = [];
    let owner: PibblInternalRenderOwner | undefined;
    const controller = pibbl(createCanvas(), createElement(() => {
      owner ??= pibblInternalCurrentRenderOwner();
    }, {}));
    driver.flush(0);

    const cancelled = pibblInternalQueueBegin(owner!, () => trace.push('cancelled'));
    expect(driver.pendingHostFrames).toBe(1);
    cancelled.cancel();
    expect(driver.pendingHostFrames).toBe(0);

    pibblInternalQueueBegin(owner!, () => {
      trace.push('dispose');
      controller.dispose();
    });
    pibblInternalQueueBegin(owner!, () => trace.push('inert begin'));
    pibblInternalRegisterAdvance(owner!, () => trace.push('inert advance'));

    driver.flush(1);

    expect(trace).toEqual(['dispose']);
    expect(snapshotRealmScheduler()).toMatchObject({
      registeredAdvanceParticipants: 0,
      pendingHostFrames: 0,
    });
  });

  it('delivers render-finish success and failure to the currently evaluating owner', () => {
    const outcomes: boolean[] = [];
    const failure = new Error('particle render failed');
    let owner: PibblInternalRenderOwner | undefined;
    let fail = false;
    const Root = (_props: {}) => {
      owner ??= pibblInternalCurrentRenderOwner();
      pibblInternalOnRenderFinish(owner, success => outcomes.push(success));
      if (fail) throw failure;
    };
    const controller = pibbl(createCanvas(), createElement(Root, {}));

    driver.flush(0);
    expect(outcomes).toEqual([true]);
    expect(() => pibblInternalOnRenderFinish(owner!, () => {}))
      .toThrow(/currently evaluating Pibbl component/i);

    fail = true;
    pibblInternalRequestRender(owner!);
    expect(() => driver.flush(1)).toThrow(failure);
    expect(outcomes).toEqual([true, false]);
    controller.dispose();
  });

  it('adds internal paint targets by default and removes them for pointerEvents none', () => {
    const path = new Path2D();
    path.rect(0, 0, 10, 10);
    const enabledCanvas = createCanvas();
    const disabledCanvas = createCanvas();
    const Enabled = (_props: {}) => {
      pibblInternalPaintTarget({ onPointerDown: () => {} }, { path, fill: true });
    };
    const Disabled = (_props: {}) => {
      pibblInternalPaintTarget(
        { onPointerDown: () => {} },
        { path, fill: true },
        'none',
      );
    };
    const enabled = pibbl(enabledCanvas, createElement(Enabled, {}));
    const disabled = pibbl(disabledCanvas, createElement(Disabled, {}));

    driver.flush(0);

    expect(getPibblInstance(enabledCanvas).paintEntries.size).toBe(1);
    expect(getPibblInstance(disabledCanvas).paintEntries.size).toBe(0);
    enabled.dispose();
    disabled.dispose();
  });
});

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  return canvas;
}

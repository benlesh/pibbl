import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crc, createElement, signal } from '@crc/core';
import {
  crcInternalAssertCommandAllowed,
  crcInternalCurrentRenderOwner,
  crcInternalOnRenderFinish,
  crcInternalPaintTarget,
  crcInternalQueueBegin,
  crcInternalQueueCurrentCommit,
  crcInternalQueueCurrentComplete,
  crcInternalRegisterAdvance,
  crcInternalRequestRender,
  type CRCInternalRenderOwner,
} from '@crc/core/internal';
import { clearSharedState, getCRCInstance } from '../global-state';
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

describe('@crc/core/internal owner-scoped particle scheduler seam', () => {
  it('uses the active direct-write guard without mutating a signal', () => {
    let error: unknown;
    const controller = crc(createCanvas(), createElement(() => {
      try {
        crcInternalAssertCommandAllowed();
      } catch (caught) {
        error = caught;
      }
    }, {}));

    driver.flush(0);

    expect(error).toMatchObject({ message: 'CRC render' });
    controller.dispose();
  });

  it('orders one owner command through Advance, Commit, render, and Complete', () => {
    const trace: string[] = [];
    const value = signal(0);
    let owner: CRCInternalRenderOwner | undefined;
    let recordRender = false;
    let releaseAdvance = () => {};
    const canvas = createCanvas();
    const Root = (_props: {}) => {
      owner ??= crcInternalCurrentRenderOwner();
      value.get();
      if (recordRender) trace.push(`render:${value.get()}`);
    };
    const controller = crc(canvas, createElement(Root, {}));
    driver.flush(0);
    recordRender = true;

    let commandFrame: number | undefined;
    const command = crcInternalQueueBegin(owner!, (frame, batch, sequence) => {
      crcInternalAssertCommandAllowed();
      commandFrame = frame.frameId;
      trace.push(`begin:${sequence}`);
      batch.stage(value, 1, command);
      crcInternalQueueCurrentCommit(owner!, (_commitFrame, outcome) => {
        expect(_commitFrame.frameId).toBe(commandFrame);
        trace.push(`commit:${sequence}:${outcome.applied}`);
      });
      crcInternalRequestRender(owner!);
    });
    releaseAdvance = crcInternalRegisterAdvance(owner!, (frame, batch) => {
      expect(frame.frameId).toBe(commandFrame);
      trace.push(`advance:${command.sequence}`);
      batch.stage(value, batch.read(value), releaseAdvance);
      crcInternalQueueCurrentComplete(owner!, completeFrame => {
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
    let owner: CRCInternalRenderOwner | undefined;
    const controller = crc(createCanvas(), createElement(() => {
      owner ??= crcInternalCurrentRenderOwner();
    }, {}));
    driver.flush(0);

    const cancelled = crcInternalQueueBegin(owner!, () => trace.push('cancelled'));
    expect(driver.pendingHostFrames).toBe(1);
    cancelled.cancel();
    expect(driver.pendingHostFrames).toBe(0);

    crcInternalQueueBegin(owner!, () => {
      trace.push('dispose');
      controller.dispose();
    });
    crcInternalQueueBegin(owner!, () => trace.push('inert begin'));
    crcInternalRegisterAdvance(owner!, () => trace.push('inert advance'));

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
    let owner: CRCInternalRenderOwner | undefined;
    let fail = false;
    const Root = (_props: {}) => {
      owner ??= crcInternalCurrentRenderOwner();
      crcInternalOnRenderFinish(owner, success => outcomes.push(success));
      if (fail) throw failure;
    };
    const controller = crc(createCanvas(), createElement(Root, {}));

    driver.flush(0);
    expect(outcomes).toEqual([true]);
    expect(() => crcInternalOnRenderFinish(owner!, () => {}))
      .toThrow(/currently evaluating CRC component/i);

    fail = true;
    crcInternalRequestRender(owner!);
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
      crcInternalPaintTarget({ onPointerDown: () => {} }, { path, fill: true });
    };
    const Disabled = (_props: {}) => {
      crcInternalPaintTarget(
        { onPointerDown: () => {} },
        { path, fill: true },
        'none',
      );
    };
    const enabled = crc(enabledCanvas, createElement(Enabled, {}));
    const disabled = crc(disabledCanvas, createElement(Disabled, {}));

    driver.flush(0);

    expect(getCRCInstance(enabledCanvas).paintEntries.size).toBe(1);
    expect(getCRCInstance(disabledCanvas).paintEntries.size).toBe(0);
    enabled.dispose();
    disabled.dispose();
  });
});

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  return canvas;
}

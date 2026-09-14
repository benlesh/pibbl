import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Fragment,
  crc,
  createElement,
  signal,
} from '@crc/core';
import {
  crcInternalCurrentSimulationOwner,
  crcInternalOnSimulationRenderTransactionFinish,
  crcInternalQueueSimulationBegin,
  crcInternalQueueSimulationCommitAcknowledgement,
  crcInternalQueueSimulationComplete,
  crcInternalRegisterSimulationAdvance,
  crcInternalRequestSimulationRender,
  type CRCInternalAdvanceLane,
  type CRCInternalFrame,
  type CRCInternalSignalBatch,
  type CRCInternalSimulationOwner,
} from '@crc/core/internal';
import { clearSharedState } from '../global-state';
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

describe('@crc/core/internal simulation participants', () => {
  it('runs animation before physics in stable lane order with one shared batch and Commit', () => {
    const target = signal(0);
    const result = signal(0);
    const laneTrace: string[] = [];
    const renderSnapshots: Array<readonly [number, number]> = [];
    const frames = new Set<CRCInternalFrame>();
    const batches = new Set<CRCInternalSignalBatch>();
    const commitOutcomes: boolean[] = [];
    const completions: number[] = [];
    const transactionOutcomes: boolean[] = [];
    const registrations = new WeakSet<CRCInternalSimulationOwner>();
    let beginSequence: number | undefined;
    let cancelledBeginRan = false;

    const Probe = ({
      label,
      lane,
      run,
      queueBegin = false,
    }: {
      label: string;
      lane: CRCInternalAdvanceLane;
      run?: (
        owner: CRCInternalSimulationOwner,
        frame: CRCInternalFrame,
        batch: CRCInternalSignalBatch,
      ) => void;
      queueBegin?: boolean;
    }) => {
      const owner = crcInternalCurrentSimulationOwner();
      crcInternalOnSimulationRenderTransactionFinish(
        owner,
        success => transactionOutcomes.push(success),
      );
      if (!registrations.has(owner)) {
        registrations.add(owner);
        if (queueBegin) {
          const handle = crcInternalQueueSimulationBegin(
            owner,
            (_frame, batch, sequence) => {
              beginSequence = sequence;
              expect('commit' in batch).toBe(false);
              expect('clear' in batch).toBe(false);
              crcInternalRequestSimulationRender(owner);
            },
          );
          expect(Object.isFrozen(handle)).toBe(true);
          const cancelled = crcInternalQueueSimulationBegin(owner, () => {
            cancelledBeginRan = true;
          });
          cancelled.cancel();
        }
        let release = () => {};
        release = crcInternalRegisterSimulationAdvance(
          owner,
          lane,
          (frame, batch) => {
            laneTrace.push(label);
            frames.add(frame);
            batches.add(batch);
            run?.(owner, frame, batch);
            release();
          },
        );
      }
      return undefined;
    };

    const Root = () => {
      renderSnapshots.push([target.get(), result.get()]);
      return createElement(Fragment, {
        children: [
          createElement(Probe, {
            label: 'animation-a',
            lane: 'animation',
            queueBegin: true,
            run: (owner, _frame, batch) => batch.stage(target, 8, owner),
          }),
          createElement(Probe, { label: 'physics-a', lane: 'physics' }),
          createElement(Probe, { label: 'animation-b', lane: 'animation' }),
          createElement(Probe, {
            label: 'physics-b',
            lane: 'physics',
            run: (owner, frame, batch) => {
              expect(batch.read(target)).toBe(8);
              batch.stage(result, 13, owner);
              crcInternalQueueSimulationCommitAcknowledgement(
                owner,
                (committedFrame, outcome) => {
                  expect(committedFrame).toBe(frame);
                  commitOutcomes.push(outcome.applied);
                },
              );
              crcInternalQueueSimulationComplete(owner, completedFrame => {
                expect(completedFrame).toBe(frame);
                completions.push(completedFrame.frameId);
              });
            },
          }),
        ],
      });
    };

    const controller = crc(createCanvas(), createElement(Root, {}));
    driver.flush(1);
    renderSnapshots.length = 0;
    transactionOutcomes.length = 0;

    driver.flush(20);

    expect(laneTrace).toEqual([
      'animation-a',
      'animation-b',
      'physics-a',
      'physics-b',
    ]);
    expect(frames.size).toBe(1);
    expect(Object.isFrozen([...frames][0])).toBe(true);
    expect(batches.size).toBe(1);
    expect([target.get(), result.get()]).toEqual([8, 13]);
    expect(renderSnapshots).toEqual([[8, 13]]);
    expect(commitOutcomes).toEqual([true]);
    expect(completions).toEqual([[...frames][0].frameId]);
    expect(transactionOutcomes).toEqual([true, true, true, true]);
    expect(beginSequence).toBeTypeOf('number');
    expect(cancelledBeginRan).toBe(false);
    expect(driver.pendingHostFrames).toBe(0);
    controller.dispose();
  });

  it('discards a failed simulation owner while siblings, rendering, and Complete succeed', () => {
    const animated = signal(0);
    const discarded = signal(0);
    const surviving = signal(0);
    const failure = new Error('physics owner failed');
    const failedWriter = Object.freeze({});
    const calls: string[] = [];
    const registrations = new WeakSet<CRCInternalSimulationOwner>();
    let recordRender = false;

    const Probe = ({
      label,
      lane,
      run,
    }: {
      label: string;
      lane: CRCInternalAdvanceLane;
      run: (
        owner: CRCInternalSimulationOwner,
        frame: CRCInternalFrame,
        batch: CRCInternalSignalBatch,
      ) => void;
    }) => {
      const owner = crcInternalCurrentSimulationOwner();
      if (!registrations.has(owner)) {
        registrations.add(owner);
        let release = () => {};
        release = crcInternalRegisterSimulationAdvance(
          owner,
          lane,
          (frame, batch) => {
            calls.push(label);
            release();
            run(owner, frame, batch);
          },
        );
      }
      return undefined;
    };

    const Root = () => {
      animated.get();
      discarded.get();
      surviving.get();
      if (recordRender) calls.push('root');
      return createElement(Fragment, {
        children: [
          createElement(Probe, {
            label: 'animation',
            lane: 'animation',
            run: (owner, _frame, batch) => batch.stage(animated, 1, owner),
          }),
          createElement(Probe, {
            label: 'physics-failed',
            lane: 'physics',
            run: (owner, _frame, batch) => {
              batch.stage(discarded, 2, failedWriter);
              crcInternalQueueSimulationComplete(owner, () => {
                calls.push('complete');
              });
              throw failure;
            },
          }),
          createElement(Probe, {
            label: 'physics-sibling',
            lane: 'physics',
            run: (owner, _frame, batch) => batch.stage(surviving, 3, owner),
          }),
        ],
      });
    };

    const controller = crc(createCanvas(), createElement(Root, {}));
    driver.flush(1);
    recordRender = true;

    expect(() => driver.flush(20)).toThrow(failure);

    expect([animated.get(), discarded.get(), surviving.get()]).toEqual([1, 0, 3]);
    expect(calls).toEqual([
      'animation',
      'physics-failed',
      'physics-sibling',
      'root',
      'complete',
    ]);
    expect(driver.pendingHostFrames).toBe(0);
    controller.dispose();
  });

  it('cancels all queued simulation work when its mounted slot tears down', () => {
    const calls: string[] = [];
    let owner: CRCInternalSimulationOwner | undefined;
    const controller = crc(createCanvas(), createElement(() => {
      owner ??= crcInternalCurrentSimulationOwner();
      crcInternalQueueSimulationBegin(owner, () => calls.push('begin'));
      crcInternalRegisterSimulationAdvance(
        owner,
        'physics',
        () => calls.push('advance'),
      );
      crcInternalQueueSimulationComplete(owner, () => calls.push('complete'));
      return undefined;
    }, {}));
    driver.flush(1);

    expect(snapshotRealmScheduler()).toMatchObject({
      queuedBeginCommands: 1,
      registeredAdvanceParticipants: 1,
    });
    controller.dispose();

    expect(calls).toEqual([]);
    expect(snapshotRealmScheduler()).toMatchObject({
      queuedBeginCommands: 0,
      registeredAdvanceParticipants: 0,
      queuedFrameCompletions: 0,
      completionCallbacks: 0,
    });
    expect(driver.pendingHostFrames).toBe(0);
    expect(() => crcInternalRequestSimulationRender(owner!)).toThrow(
      /active CRC internal simulation owner/i,
    );
  });
});

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  return canvas;
}

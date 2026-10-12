import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Fragment,
  pibbl,
  createElement,
  signal,
} from '@pibbl/core';
import {
  pibblInternalCurrentSimulationOwner,
  pibblInternalOnSimulationRenderTransactionFinish,
  pibblInternalQueueSimulationBegin,
  pibblInternalQueueSimulationCommitAcknowledgement,
  pibblInternalQueueSimulationComplete,
  pibblInternalRegisterSimulationAdvance,
  pibblInternalRequestSimulationRender,
  type PibblInternalAdvanceLane,
  type PibblInternalFrame,
  type PibblInternalSignalBatch,
  type PibblInternalSimulationOwner,
} from '@pibbl/core/internal';
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

describe('@pibbl/core/internal simulation participants', () => {
  it('runs animation before physics in stable lane order with one shared batch and Commit', () => {
    const target = signal(0);
    const result = signal(0);
    const laneTrace: string[] = [];
    const renderSnapshots: Array<readonly [number, number]> = [];
    const frames = new Set<PibblInternalFrame>();
    const batches = new Set<PibblInternalSignalBatch>();
    const commitOutcomes: boolean[] = [];
    const completions: number[] = [];
    const transactionOutcomes: boolean[] = [];
    const registrations = new WeakSet<PibblInternalSimulationOwner>();
    let beginSequence: number | undefined;
    let cancelledBeginRan = false;

    const Probe = ({
      label,
      lane,
      run,
      queueBegin = false,
    }: {
      label: string;
      lane: PibblInternalAdvanceLane;
      run?: (
        owner: PibblInternalSimulationOwner,
        frame: PibblInternalFrame,
        batch: PibblInternalSignalBatch,
      ) => void;
      queueBegin?: boolean;
    }) => {
      const owner = pibblInternalCurrentSimulationOwner();
      pibblInternalOnSimulationRenderTransactionFinish(
        owner,
        success => transactionOutcomes.push(success),
      );
      if (!registrations.has(owner)) {
        registrations.add(owner);
        if (queueBegin) {
          const handle = pibblInternalQueueSimulationBegin(
            owner,
            (_frame, batch, sequence) => {
              beginSequence = sequence;
              expect('commit' in batch).toBe(false);
              expect('clear' in batch).toBe(false);
              pibblInternalRequestSimulationRender(owner);
            },
          );
          expect(Object.isFrozen(handle)).toBe(true);
          const cancelled = pibblInternalQueueSimulationBegin(owner, () => {
            cancelledBeginRan = true;
          });
          cancelled.cancel();
        }
        let release = () => {};
        release = pibblInternalRegisterSimulationAdvance(
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
              pibblInternalQueueSimulationCommitAcknowledgement(
                owner,
                (committedFrame, outcome) => {
                  expect(committedFrame).toBe(frame);
                  commitOutcomes.push(outcome.applied);
                },
              );
              pibblInternalQueueSimulationComplete(owner, completedFrame => {
                expect(completedFrame).toBe(frame);
                completions.push(completedFrame.frameId);
              });
            },
          }),
        ],
      });
    };

    const controller = pibbl(createCanvas(), createElement(Root, {}));
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
    const sharedWriter = Object.freeze({});
    const calls: string[] = [];
    const registrations = new WeakSet<PibblInternalSimulationOwner>();
    let recordRender = false;

    const Probe = ({
      label,
      lane,
      run,
    }: {
      label: string;
      lane: PibblInternalAdvanceLane;
      run: (
        owner: PibblInternalSimulationOwner,
        frame: PibblInternalFrame,
        batch: PibblInternalSignalBatch,
      ) => void;
    }) => {
      const owner = pibblInternalCurrentSimulationOwner();
      if (!registrations.has(owner)) {
        registrations.add(owner);
        let release = () => {};
        release = pibblInternalRegisterSimulationAdvance(
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
            run: (_owner, _frame, batch) => batch.stage(animated, 1, sharedWriter),
          }),
          createElement(Probe, {
            label: 'physics-failed',
            lane: 'physics',
            run: (owner, _frame, batch) => {
              batch.stage(discarded, 2, sharedWriter);
              pibblInternalQueueSimulationComplete(owner, () => {
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

    const controller = pibbl(createCanvas(), createElement(Root, {}));
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
    let owner: PibblInternalSimulationOwner | undefined;
    const controller = pibbl(createCanvas(), createElement(() => {
      owner ??= pibblInternalCurrentSimulationOwner();
      pibblInternalQueueSimulationBegin(owner, () => calls.push('begin'));
      pibblInternalRegisterSimulationAdvance(
        owner,
        'physics',
        () => calls.push('advance'),
      );
      pibblInternalQueueSimulationComplete(owner, () => calls.push('complete'));
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
    expect(() => pibblInternalRequestSimulationRender(owner!)).toThrow(
      /active Pibbl internal simulation owner/i,
    );
  });

  it('discards writes staged before and after owner teardown during Begin', () => {
    const beforeTeardown = signal(0);
    const afterTeardown = signal(0);
    let controller: ReturnType<typeof pibbl>;
    const Root = () => {
      const owner = pibblInternalCurrentSimulationOwner();
      pibblInternalQueueSimulationBegin(owner, (_frame, batch) => {
        batch.stage(beforeTeardown, 1, {});
        controller.dispose();
        batch.stage(afterTeardown, 2, {});
      });
      return undefined;
    };

    controller = pibbl(createCanvas(), createElement(Root, {}));
    driver.flush(1);
    driver.flush(2);

    expect([beforeTeardown.get(), afterTeardown.get()]).toEqual([0, 0]);
    expect(driver.pendingHostFrames).toBe(0);
  });

  it('discards writes staged before and after owner teardown during Advance', () => {
    const beforeTeardown = signal(0);
    const afterTeardown = signal(0);
    let controller: ReturnType<typeof pibbl>;
    const Root = () => {
      const owner = pibblInternalCurrentSimulationOwner();
      pibblInternalRegisterSimulationAdvance(
        owner,
        'physics',
        (_frame, batch) => {
          batch.stage(beforeTeardown, 1, {});
          controller.dispose();
          batch.stage(afterTeardown, 2, {});
        },
      );
      return undefined;
    };

    controller = pibbl(createCanvas(), createElement(Root, {}));
    driver.flush(1);
    driver.flush(2);

    expect([beforeTeardown.get(), afterTeardown.get()]).toEqual([0, 0]);
    expect(driver.pendingHostFrames).toBe(0);
  });

  it('scopes explicit discardWriter to the calling simulation owner', () => {
    const retained = signal(0);
    const discarded = signal(0);
    const sharedWriter = Object.freeze({});
    const registrations = new WeakSet<PibblInternalSimulationOwner>();

    const Probe = ({
      lane,
      run,
    }: {
      lane: PibblInternalAdvanceLane;
      run: (batch: PibblInternalSignalBatch) => void;
    }) => {
      const owner = pibblInternalCurrentSimulationOwner();
      if (!registrations.has(owner)) {
        registrations.add(owner);
        let release = () => {};
        release = pibblInternalRegisterSimulationAdvance(
          owner,
          lane,
          (_frame, batch) => {
            run(batch);
            release();
          },
        );
      }
      return undefined;
    };

    const Root = () => {
      retained.get();
      discarded.get();
      return createElement(Fragment, {
        children: [
          createElement(Probe, {
            lane: 'animation',
            run: batch => batch.stage(retained, 1, sharedWriter),
          }),
          createElement(Probe, {
            lane: 'physics',
            run: batch => {
              batch.stage(discarded, 2, sharedWriter);
              batch.discardWriter(sharedWriter);
            },
          }),
        ],
      });
    };

    const controller = pibbl(createCanvas(), createElement(Root, {}));
    driver.flush(1);
    driver.flush(2);

    expect([retained.get(), discarded.get()]).toEqual([1, 0]);
    expect(driver.pendingHostFrames).toBe(0);
    controller.dispose();
  });
});

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  return canvas;
}

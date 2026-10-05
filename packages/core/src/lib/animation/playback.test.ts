import { signalObserversForTest } from "../../../test/support/signal-observer";
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  computed,
  pibbl,
  createElement,
  defineAnimation,
  marker,
  parallel,
  repeat,
  sequence,
  signal,
  spring,
  stepper,
  drive,
  tween,
  usePlayback,
  wait,
  type PibblAnimationProgram,
  type PibblNode,
} from '../../index';
import { clearSharedState } from '../global-state';
import { getSignalNode } from '../signals/graph';
import {
  queueBeginCommand,
  queueFrameCompletion,
  registerAdvanceParticipant,
} from '../scheduler/realm-scheduler';
import {
  installSchedulerDriverForTest,
  installSchedulerTraceCollectorForTest,
  ManualSchedulerDriver,
  snapshotRealmScheduler,
  type PibblSchedulerTraceRecord,
} from '../scheduler/testing';
import {
  animationPlaybackSnapshot,
  createAnimationPlaybackController,
  type AnimationPlaybackController,
} from './playback';
import { writerLeaseSnapshot } from './writer-leases';

let driver: ManualSchedulerDriver;
let restoreDriver: () => void;
const controllers = new Set<AnimationPlaybackController>();
const roots = new Set<ReturnType<typeof pibbl>>();

beforeEach(() => {
  document.body.replaceChildren();
  driver = new ManualSchedulerDriver();
  restoreDriver = installSchedulerDriverForTest(driver);
});

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  for (const root of roots) root.dispose();
  controllers.clear();
  roots.clear();
  clearSharedState();
  restoreDriver();
  document.body.replaceChildren();
});

function playback(
  program: PibblAnimationProgram,
  options: Parameters<typeof createAnimationPlaybackController>[1] = {},
): AnimationPlaybackController {
  const controller = createAnimationPlaybackController(program, options);
  controllers.add(controller);
  return controller;
}

function root(node: PibblNode) {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const controller = pibbl(canvas, node);
  roots.add(controller);
  return controller;
}

describe('scheduler-integrated animation playback', () => {
  it('releases a render-disposal status command when its root is disposed', () => {
    const mounted = signal(true);
    let retained!: ReturnType<typeof usePlayback>;
    const Child = () => {
      retained = usePlayback(drive(signal(0), tween({ to: 1, duration: 100 })), {
        autoplay: true,
      });
      return null;
    };
    const Root = () => mounted.get() ? createElement(Child, {}) : null;
    const controller = root(createElement(Root, {}));

    driver.flush(0);
    mounted.set(false);
    driver.flush(1);
    expect(snapshotRealmScheduler().queuedBeginCommands).toBe(1);

    controller.dispose();
    roots.delete(controller);
    expect(retained.status.get()).toBe('disposed');
    expect(snapshotRealmScheduler().queuedBeginCommands).toBe(0);
    expect(driver.pendingHostFrames).toBe(0);
  });

  it('publishes two playbacks atomically before two roots render in mount order', () => {
    const order: string[] = [];
    const firstValue = signal(0);
    const secondValue = signal(0);
    let firstController!: AnimationPlaybackController;
    let secondController!: AnimationPlaybackController;
    const firstDerived = computed(() => {
      const value = firstValue.get();
      if (value > 0) order.push('plan');
      return value;
    });
    const snapshots: string[] = [];
    const Root = ({ name }: { name: string }) => {
      snapshots.push(
        `${name}:${firstDerived.get()}:${secondValue.get()}:` +
          `${firstController?.handle.status.get() ?? 'idle'}:` +
          `${secondController?.handle.status.get() ?? 'idle'}:` +
          `${firstController?.handle.currentTime.get() ?? 0}:` +
          `${secondController?.handle.currentTime.get() ?? 0}`,
      );
      order.push(`render:${name}`);
    };
    root(createElement(Root, { name: 'root-1' }));
    root(createElement(Root, { name: 'root-2' }));
    driver.flush(1);
    expect(snapshots).toEqual([
      'root-1:0:0:idle:idle:0:0',
      'root-2:0:0:idle:idle:0:0',
    ]);
    order.length = 0;
    snapshots.length = 0;

    firstController = playback(drive(firstValue, defineAnimation({
      duration: 50,
      sample: ({ localTime }) => {
        order.push('advance:1');
        if (localTime === 0) {
          expect(firstController.handle.status.get()).toBe('idle');
          expect(firstController.handle.currentTime.get()).toBe(0);
        }
        return localTime + 1;
      },
    })), { onEvent: event => order.push(`complete:1:${event.type}`) });
    secondController = playback(drive(secondValue, defineAnimation({
      duration: 50,
      sample: ({ localTime }) => {
        order.push('advance:2');
        if (localTime === 0) {
          expect(secondController.handle.status.get()).toBe('idle');
          expect(secondController.handle.currentTime.get()).toBe(0);
        }
        return (localTime + 1) * 2;
      },
    })), { onEvent: event => order.push(`complete:2:${event.type}`) });
    const restoreTrace = installSchedulerTraceCollectorForTest(record => {
      if (record.kind === 'animation-command' && record.command === 'play') {
        order.push(`begin:${record.debugName}`);
      }
    });
    signalObserversForTest(getSignalNode(firstValue)).add(() => order.push('commit:1'));
    signalObserversForTest(getSignalNode(secondValue)).add(() => order.push('commit:2'));

    firstController.handle.play();
    secondController.handle.play();
    expect(firstController.handle.status.get()).toBe('idle');
    expect(secondController.handle.status.get()).toBe('idle');
    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(10);

    expect(order).toEqual([
      'begin:undefined',
      'begin:undefined',
      'advance:1',
      'advance:2',
      'commit:1',
      'commit:2',
      'plan',
      'render:root-1',
      'render:root-2',
      'complete:1:start',
      'complete:2:start',
    ]);
    expect(firstController.handle.status.get()).toBe('running');
    expect(secondController.handle.status.get()).toBe('running');
    expect(snapshots).toEqual([
      'root-1:1:2:running:running:0:0',
      'root-2:1:2:running:running:0:0',
    ]);

    order.length = 0;
    snapshots.length = 0;
    driver.flush(60);

    expect(order).toEqual([
      'advance:1',
      'advance:2',
      'commit:1',
      'commit:2',
      'plan',
      'render:root-1',
      'render:root-2',
      'complete:1:finish',
      'complete:2:finish',
    ]);
    expect(snapshots).toEqual([
      'root-1:51:102:finished:finished:50:50',
      'root-2:51:102:finished:finished:50:50',
    ]);
    expect(driver.pendingHostFrames).toBe(0);
    restoreTrace();
  });

  it('restarts play from the currently committed output snapshot', () => {
    const value = signal(0);
    const controller = playback(drive(value, tween({ to: 10, duration: 100 })));

    controller.handle.play();
    driver.flush(0);
    driver.flush(50);
    expect(value.get()).toBe(5);

    controller.handle.play();
    driver.flush(60);
    expect(value.get()).toBe(5);
    driver.flush(110);
    expect(value.get()).toBe(7.5);
  });

  it('preflights an adopted restart before cancelling the active run', () => {
    const output = signal({ value: 0 }, { debugName: 'restart output' });
    const failures: unknown[] = [];
    const controller = playback(drive(output, defineAnimation({
      duration: 100,
      sample: ({ localTime }) => ({ value: localTime / 100 }),
    })), { onError: error => failures.push(error) });
    controller.handle.play();
    driver.flush(0);

    controller.adopt(drive(output, tween({
      to: { value: 2 },
      duration: 100,
      debugName: 'invalid adopted restart',
    })), { onError: error => failures.push(error) });
    controller.handle.play();
    driver.flush(10);

    expect(controller.handle.status.get()).toBe('running');
    expect(controller.handle.currentTime.get()).toBe(10);
    expect(output.get()).toEqual({ value: 0.1 });
    expect(writerLeaseSnapshot().active).toBe(1);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toEqual(expect.objectContaining({
      message: expect.stringMatching(/invalid adopted restart.*interpolator.*nonnumeric/iu),
    }));
  });

  it('preserves a healthy run when an adopted restart has a non-self conflict', () => {
    const firstOutput = signal(0, { debugName: 'restart first output' });
    const externalOutput = signal(0, { debugName: 'restart external output' });
    const firstEvents: string[] = [];
    const externalEvents: string[] = [];
    const failures: unknown[] = [];
    const first = playback(
      drive(firstOutput, tween({ to: 10, duration: 100 })),
      {
        debugName: 'restarting playback',
        onEvent: event => firstEvents.push(event.type),
        onError: error => failures.push(error),
      },
    );
    const external = playback(
      drive(externalOutput, tween({ to: 20, duration: 100 })),
      {
        debugName: 'external playback',
        onEvent: event => externalEvents.push(event.type),
      },
    );
    first.handle.play();
    external.handle.play();
    driver.flush(0);
    driver.flush(20);

    first.adopt(parallel(
      drive(firstOutput, tween({ to: 100, duration: 100 })),
      drive(externalOutput, tween({ to: 200, duration: 100 })),
    ), {
      debugName: 'restarting playback',
      onEvent: event => firstEvents.push(event.type),
      onError: error => failures.push(error),
    });
    first.handle.play();
    driver.flush(30);

    expect(first.handle.status.get()).toBe('running');
    expect(first.handle.currentTime.get()).toBe(30);
    expect(external.handle.status.get()).toBe('running');
    expect([firstOutput.get(), externalOutput.get()]).toEqual([3, 6]);
    expect(firstEvents).toEqual(['start']);
    expect(externalEvents).toEqual(['start']);
    expect((failures[0] as Error).message).toMatch(
      /restart external output.*external playback/iu,
    );
    expect(writerLeaseSnapshot().active).toBe(2);

    first.handle.play({ conflict: 'replace' });
    driver.flush(40);

    expect(first.handle.status.get()).toBe('running');
    expect(first.handle.currentTime.get()).toBe(0);
    expect(external.handle.status.get()).toBe('cancelled');
    expect([firstOutput.get(), externalOutput.get()]).toEqual([3, 6]);
    expect(firstEvents.filter(event => event === 'cancel')).toHaveLength(1);
    expect(externalEvents).toEqual(['start', 'cancel']);
    expect(writerLeaseSnapshot().active).toBe(2);
  });

  it('restores a same-handle run when its accepted restart is rejected at Commit', () => {
    let rejectRestart = false;
    const value = signal(0, {
      equals: (previous, next) => {
        if (rejectRestart) {
          rejectRestart = false;
          throw new Error('restart Commit rejected');
        }
        return Object.is(previous, next);
      },
    });
    const events: string[] = [];
    const controller = playback(
      drive(value, tween({ from: 0, to: 10, duration: 100 })),
      { onEvent: event => events.push(event.type) },
    );
    controller.handle.play();
    driver.flush(0);
    driver.flush(20);
    expect(value.get()).toBe(2);

    controller.adopt(drive(value, tween({ to: 20, duration: 100 })), {
      onEvent: event => events.push(event.type),
    });
    rejectRestart = true;
    controller.handle.play();
    expect(() => driver.flush(30)).toThrow(/restart Commit rejected/iu);

    expect([value.get(), controller.handle.currentTime.get(), controller.handle.status.get()])
      .toEqual([2, 20, 'running']);
    expect(events).toEqual(['start']);
    expect(writerLeaseSnapshot().active).toBe(1);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(1);

    driver.flush(40);
    expect([value.get(), controller.handle.currentTime.get()]).toEqual([4, 40]);
    controller.handle.play();
    driver.flush(50);
    expect([value.get(), controller.handle.currentTime.get(), controller.handle.status.get()])
      .toEqual([4, 0, 'running']);
    expect(events).toEqual(['start', 'cancel', 'start']);
  });

  it('releases disjoint provisional outputs when an adopted restart rolls back', () => {
    const previousValue = signal(0);
    let rejectRestart = true;
    const adoptedValue = signal(5, {
      equals: (previous, next) => {
        if (rejectRestart) {
          rejectRestart = false;
          throw new Error('disjoint restart rejected');
        }
        return Object.is(previous, next);
      },
    });
    const controller = playback(
      drive(previousValue, tween({ from: 0, to: 10, duration: 100 })),
    );
    controller.handle.play();
    driver.flush(0);
    driver.flush(20);

    controller.adopt(drive(adoptedValue, tween({ to: 20, duration: 100 })));
    controller.handle.play();
    expect(() => driver.flush(30)).toThrow(/disjoint restart rejected/iu);

    expect(writerLeaseSnapshot().active).toBe(1);
    expect(() => adoptedValue.set(6)).not.toThrow();
    driver.flush(40);
    expect([previousValue.get(), controller.handle.currentTime.get()]).toEqual([4, 40]);
  });

  it('releases a displaced run when disposal interrupts a rejected restart', () => {
    const previousValue = signal(0);
    const adoptedValue = signal(0);
    const rejector = signal(0, {
      equals: () => {
        throw new Error('disposed restart rejected');
      },
    });
    const before = {
      leases: writerLeaseSnapshot().active,
      playbacks: animationPlaybackSnapshot().activePlaybacks,
    };
    let controller!: AnimationPlaybackController;
    controller = playback(
      drive(previousValue, tween({ from: 0, to: 10, duration: 100 })),
    );
    controller.handle.play();
    driver.flush(0);

    controller.adopt(drive(adoptedValue, defineAnimation({
      duration: 100,
      sample: () => {
        controller.dispose();
        return 1;
      },
    })));
    controller.handle.play();
    let unregister = () => {};
    unregister = registerAdvanceParticipant((_snapshot, batch) => {
      unregister();
      batch.stage(rejector, 1, {});
    }, 'physics');
    let thrown: unknown;
    try {
      driver.flush(10);
    } catch (error) {
      thrown = error;
    }
    const failures = thrown instanceof AggregateError ? thrown.errors : [thrown];
    expect(failures.map(error => (error as Error).message))
      .toContainEqual(expect.stringMatching(/disposed restart rejected/iu));
    if (driver.pendingHostFrames > 0) driver.flush(11);

    expect(writerLeaseSnapshot().active).toBe(before.leases);
    expect(animationPlaybackSnapshot().activePlaybacks).toBe(before.playbacks);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
  });

  it('restores a replaced playback when the replacing run is rejected at Commit', () => {
    const before = writerLeaseSnapshot();
    const value = signal(0, { debugName: 'provisional replacement output' });
    const events: string[] = [];
    const first = playback(
      drive(value, tween({ from: 0, to: 10, duration: 100 })),
      { debugName: 'restored owner', onEvent: event => events.push(`first:${event.type}`) },
    );
    const second = playback(
      drive(value, tween({ to: 20, duration: 100 })),
      { debugName: 'provisional owner', onEvent: event => events.push(`second:${event.type}`) },
    );
    first.handle.play();
    driver.flush(0);
    driver.flush(20);

    second.handle.play({ conflict: 'replace' });
    queueBeginCommand(() => {
      let unregister = () => {};
      unregister = registerAdvanceParticipant((_snapshot, batch) => {
        unregister();
        batch.stage(value, 999, {});
      }, 'physics');
    });
    expect(() => driver.flush(30)).toThrow(/does not own the active lease/iu);

    expect([value.get(), first.handle.currentTime.get(), first.handle.status.get()])
      .toEqual([2, 20, 'running']);
    expect(second.handle.status.get()).toBe('idle');
    expect(events).toEqual(['first:start']);
    expect(writerLeaseSnapshot().active).toBe(1);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(1);

    driver.flush(40);
    expect([value.get(), first.handle.currentTime.get()]).toEqual([4, 40]);
    second.handle.play({ conflict: 'replace' });
    driver.flush(50);
    expect(first.handle.status.get()).toBe('cancelled');
    expect([value.get(), second.handle.currentTime.get(), second.handle.status.get()])
      .toEqual([4, 0, 'running']);
    expect(events).toEqual(['first:start', 'first:cancel', 'second:start']);
    expect(writerLeaseSnapshot()).toMatchObject({
      active: before.active + 1,
      acquired: before.acquired + 3,
      released: before.released + 2,
    });
  });

  it('restores a paused displaced playback without registering continuous work', () => {
    let rejectReplacement = false;
    const value = signal(0, {
      equals: (previous, next) => {
        if (rejectReplacement) {
          rejectReplacement = false;
          throw new Error('paused replacement rejected');
        }
        return Object.is(previous, next);
      },
    });
    const first = playback(drive(value, tween({ from: 0, to: 10, duration: 100 })));
    const second = playback(drive(value, tween({ to: 20, duration: 100 })));
    first.handle.play();
    driver.flush(0);
    driver.flush(20);
    first.handle.pause();
    driver.flush(21);

    rejectReplacement = true;
    second.handle.play({ conflict: 'replace' });
    expect(() => driver.flush(30)).toThrow(/paused replacement rejected/iu);

    expect([value.get(), first.handle.currentTime.get(), first.handle.status.get()])
      .toEqual([2, 20, 'paused']);
    expect(second.handle.status.get()).toBe('idle');
    expect(writerLeaseSnapshot().active).toBe(1);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
    expect(driver.pendingHostFrames).toBe(0);

    queueFrameCompletion(() => {});
    driver.flush(40);
    expect([value.get(), first.handle.currentTime.get(), first.handle.status.get()])
      .toEqual([2, 20, 'paused']);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
    expect(driver.pendingHostFrames).toBe(0);
  });

  it('rejects a multi-owner replacement before staging effects for an earlier paused owner', () => {
    const x = signal(0, { debugName: 'ending owner output' });
    const y = signal(0, { debugName: 'paused owner output' });
    const z = signal(100, { debugName: 'paused owner second output' });
    const pausedEvents: string[] = [];
    const endingEvents: string[] = [];
    const candidateEvents: string[] = [];
    const candidateErrors: unknown[] = [];
    const paused = playback(
      parallel(
        drive(y, tween({ from: 0, to: 10, duration: 100 })),
        drive(z, tween({ from: 100, to: 110, duration: 100 })),
      ),
      { onEvent: event => pausedEvents.push(event.type) },
    );
    const ending = playback(
      drive(x, tween({ from: 0, to: 20, duration: 100 })),
      { onEvent: event => endingEvents.push(event.type) },
    );
    const candidate = playback(
      parallel(
        drive(x, tween({ to: 30, duration: 100 })),
        drive(y, tween({ to: 40, duration: 100 })),
        drive(z, tween({ to: 140, duration: 100 })),
      ),
      {
        onEvent: event => candidateEvents.push(event.type),
        onError: error => candidateErrors.push(error),
      },
    );

    paused.handle.play();
    driver.flush(0);
    driver.flush(20);
    paused.handle.pause();
    driver.flush(21);
    ending.handle.play();
    driver.flush(22);

    ending.handle.cancel();
    candidate.handle.play({ conflict: 'replace' });
    driver.flush(30);

    expect([y.get(), z.get(), paused.handle.currentTime.get(), paused.handle.status.get()])
      .toEqual([2, 102, 20, 'paused']);
    expect([x.get(), ending.handle.status.get(), candidate.handle.status.get()])
      .toEqual([0, 'cancelled', 'cancelled']);
    expect(pausedEvents).toEqual(['start']);
    expect(endingEvents).toEqual(['start', 'cancel']);
    expect(candidateEvents).toEqual([]);
    expect(candidateErrors).toHaveLength(1);
    expect(candidateErrors[0]).toEqual(expect.objectContaining({
      message: expect.stringMatching(/already ending/iu),
    }));
    expect(writerLeaseSnapshot().activeOutputs).toEqual([
      'paused owner output',
      'paused owner second output',
    ]);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
    expect(driver.pendingHostFrames).toBe(0);
    expect(() => x.set(5)).not.toThrow();
    expect(() => y.set(5)).toThrow(/paused owner output/iu);
    expect(() => z.set(105)).toThrow(/paused owner second output/iu);

    paused.handle.resume();
    driver.flush(40);
    expect([y.get(), z.get(), paused.handle.currentTime.get(), paused.handle.status.get()])
      .toEqual([2, 102, 20, 'running']);
    driver.flush(50);
    expect([y.get(), z.get(), paused.handle.currentTime.get()]).toEqual([3, 103, 30]);
  });

  it('restores the rightful owner after a rejected chained replacement', () => {
    let rejectReplacement = false;
    const value = signal(0, {
      equals: (previous, next) => {
        if (rejectReplacement) {
          rejectReplacement = false;
          throw new Error('chained replacement rejected');
        }
        return Object.is(previous, next);
      },
    });
    const before = writerLeaseSnapshot();
    const first = playback(drive(value, tween({ from: 0, to: 10, duration: 100 })));
    const second = playback(drive(value, tween({ to: 20, duration: 100 })));
    const third = playback(drive(value, tween({ to: 30, duration: 100 })));
    first.handle.play();
    driver.flush(0);
    driver.flush(20);

    rejectReplacement = true;
    second.handle.play({ conflict: 'replace' });
    third.handle.play({ conflict: 'replace' });
    expect(() => driver.flush(30)).toThrow(/chained replacement rejected/iu);

    expect([value.get(), first.handle.currentTime.get(), first.handle.status.get()])
      .toEqual([2, 20, 'running']);
    expect([second.handle.status.get(), third.handle.status.get()])
      .toEqual(['idle', 'idle']);
    expect(writerLeaseSnapshot()).toMatchObject({
      active: before.active + 1,
      acquired: before.acquired + 3,
      released: before.released + 2,
    });
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(1);

    expect(() => driver.flush(40)).not.toThrow();
    expect([value.get(), first.handle.currentTime.get()]).toEqual([4, 40]);
    expect(writerLeaseSnapshot().active).toBe(before.active + 1);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(1);
  });

  it('does not restore a displaced lease whose owner disposed during rejected sampling', () => {
    let rejectReplacement = false;
    const value = signal(0, {
      equals: (previous, next) => {
        if (rejectReplacement) {
          rejectReplacement = false;
          throw new Error('disposed owner replacement rejected');
        }
        return Object.is(previous, next);
      },
    });
    const before = writerLeaseSnapshot();
    const first = playback(drive(value, tween({ from: 0, to: 10, duration: 100 })));
    let disposed = false;
    const second = playback(drive(value, defineAnimation({
      duration: 100,
      sample: ({ localTime }) => {
        if (!disposed) {
          disposed = true;
          first.dispose();
        }
        return 10 + localTime;
      },
    })));
    first.handle.play();
    driver.flush(0);
    driver.flush(20);

    rejectReplacement = true;
    second.handle.play({ conflict: 'replace' });
    expect(() => driver.flush(30)).toThrow(/disposed owner replacement rejected/iu);

    const statusAfterRejection = second.handle.status.get();
    const leasesAfterRejection = writerLeaseSnapshot();
    const participantsAfterRejection =
      snapshotRealmScheduler().registeredAdvanceParticipants;
    let directWriteError: unknown;
    try {
      value.set(7);
    } catch (error) {
      directWriteError = error;
    }
    driver.flush(31);

    expect(statusAfterRejection).toBe('idle');
    expect(leasesAfterRejection).toMatchObject({
      active: before.active,
      acquired: before.acquired + 2,
      released: before.released + 2,
    });
    expect(participantsAfterRejection).toBe(0);
    expect(directWriteError).toBeUndefined();
    expect(first.handle.status.get()).toBe('disposed');
    expect(writerLeaseSnapshot().active).toBe(before.active);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
    expect(driver.pendingHostFrames).toBe(0);
  });

  it('keeps only the final owner after a successful chained replacement', () => {
    const value = signal(0);
    const before = writerLeaseSnapshot();
    const events: string[] = [];
    const first = playback(
      drive(value, tween({ from: 0, to: 10, duration: 100 })),
      { onEvent: event => events.push(`first:${event.type}`) },
    );
    const second = playback(
      drive(value, tween({ to: 20, duration: 100 })),
      { onEvent: event => events.push(`second:${event.type}`) },
    );
    const third = playback(
      drive(value, tween({ to: 30, duration: 100 })),
      { onEvent: event => events.push(`third:${event.type}`) },
    );
    first.handle.play();
    driver.flush(0);
    driver.flush(20);

    second.handle.play({ conflict: 'replace' });
    third.handle.play({ conflict: 'replace' });
    driver.flush(30);

    expect([first.handle.status.get(), second.handle.status.get(), third.handle.status.get()])
      .toEqual(['cancelled', 'cancelled', 'running']);
    expect(events).toEqual([
      'first:start',
      'first:cancel',
      'second:start',
      'second:cancel',
      'third:start',
    ]);
    expect(writerLeaseSnapshot()).toMatchObject({
      active: before.active + 1,
      acquired: before.acquired + 3,
      released: before.released + 2,
    });
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(1);

    driver.flush(40);
    expect(value.get()).toBeCloseTo(4.8);
    expect(third.handle.currentTime.get()).toBe(10);
    expect(writerLeaseSnapshot().active).toBe(before.active + 1);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(1);
  });

  it('pauses without a jump, retains leases, and resumes from a fresh anchor', () => {
    const value = signal(0);
    const before = writerLeaseSnapshot();
    const controller = playback(drive(value, tween({ to: 10, duration: 100 })));

    controller.handle.play();
    driver.flush(0);
    driver.flush(40);
    expect(value.get()).toBe(4);

    controller.handle.pause();
    driver.flush(60);
    expect(controller.handle.status.get()).toBe('paused');
    expect(controller.handle.currentTime.get()).toBe(40);
    expect(value.get()).toBe(4);
    expect(writerLeaseSnapshot().active).toBe(before.active + 1);
    expect(driver.pendingHostFrames).toBe(0);

    controller.handle.resume();
    driver.flush(100);
    expect(value.get()).toBe(4);
    expect(controller.handle.status.get()).toBe('running');
    driver.flush(140);
    expect(value.get()).toBe(8);
  });

  it('publishes start before a same-Begin pause without scheduling continuous work', () => {
    const value = signal(0);
    const events: string[] = [];
    const controller = playback(
      drive(value, tween({ from: 0, to: 10, duration: 100 })),
      { onEvent: event => events.push(event.type) },
    );

    controller.handle.play();
    controller.handle.pause();
    driver.flush(0);

    expect(controller.handle.status.get()).toBe('paused');
    expect(controller.handle.currentTime.get()).toBe(0);
    expect(value.get()).toBe(0);
    expect(events).toEqual(['start']);
    expect(writerLeaseSnapshot().active).toBe(1);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
    expect(driver.pendingHostFrames).toBe(0);
  });

  it('retries start before cancel when a same-Begin cancellation Commit is rejected', () => {
    const value = signal(0);
    const rejector = signal(0, {
      equals: () => {
        throw new Error('play cancel Commit rejected');
      },
    });
    const events: string[] = [];
    const controller = playback(
      drive(value, tween({ from: 0, to: 10, duration: 100 })),
      { onEvent: event => events.push(event.type) },
    );
    let unregister = () => {};
    unregister = registerAdvanceParticipant((_snapshot, batch) => {
      unregister();
      batch.stage(rejector, 1, {});
    }, 'physics');

    controller.handle.play();
    controller.handle.cancel();
    expect(() => driver.flush(0)).toThrow(/play cancel Commit rejected/iu);
    expect(controller.handle.status.get()).toBe('idle');
    expect(events).toEqual([]);
    expect(writerLeaseSnapshot().active).toBe(1);

    driver.flush(1);
    expect(controller.handle.status.get()).toBe('cancelled');
    expect(events).toEqual(['start', 'cancel']);
    expect(writerLeaseSnapshot().active).toBe(0);
  });

  it('seeks fresh idle, cancelled, and finished handles into a paused run', () => {
    const value = signal(0);
    const controller = playback(drive(value, tween({ to: 10, duration: 100 })));

    controller.handle.seek(150);
    driver.flush(1);
    expect([value.get(), controller.handle.currentTime.get(), controller.handle.status.get()])
      .toEqual([10, 100, 'paused']);

    controller.handle.cancel();
    driver.flush(2);
    expect(controller.handle.status.get()).toBe('cancelled');
    controller.handle.seek(50);
    driver.flush(3);
    expect([value.get(), controller.handle.currentTime.get(), controller.handle.status.get()])
      .toEqual([10, 50, 'paused']);

    controller.handle.finish();
    driver.flush(4);
    expect([value.get(), controller.handle.currentTime.get(), controller.handle.status.get()])
      .toEqual([10, 100, 'finished']);
    controller.handle.seek(20);
    driver.flush(5);
    expect([value.get(), controller.handle.currentTime.get(), controller.handle.status.get()])
      .toEqual([10, 20, 'paused']);
  });

  it('reverses and changes playback rate without changing the presented position', () => {
    const value = signal(0);
    const controller = playback(drive(value, tween({ from: 0, to: 10, duration: 100 })));

    controller.handle.play();
    driver.flush(0);
    driver.flush(40);
    expect(value.get()).toBe(4);

    controller.handle.reverse();
    driver.flush(50);
    expect([value.get(), controller.handle.currentTime.get()]).toEqual([4, 40]);
    driver.flush(60);
    expect([value.get(), controller.handle.currentTime.get()]).toEqual([3, 30]);

    controller.handle.setPlaybackRate(2);
    driver.flush(70);
    expect([value.get(), controller.handle.currentTime.get()]).toEqual([3, 30]);
    driver.flush(80);
    expect([value.get(), controller.handle.currentTime.get()]).toEqual([1, 10]);
    expect(() => controller.handle.setPlaybackRate(0)).toThrow(/finite and greater than zero/iu);
    expect(() => controller.handle.setPlaybackRate(Number.NaN)).toThrow(/finite and greater than zero/iu);
  });

  it('samples seekable time from a stable control anchor regardless of frame cadence', () => {
    const jumpedValue = signal(0);
    const jumped = playback(drive(jumpedValue, tween({
      from: 0,
      to: 1_000,
      duration: 1_000,
    })));
    jumped.handle.play();
    jumped.handle.setPlaybackRate(0.1);
    driver.flush(0);
    driver.flush(1_000);
    const oneJump = jumpedValue.get();
    jumped.dispose();

    const cadencedValue = signal(0);
    const cadenced = playback(drive(cadencedValue, tween({
      from: 0,
      to: 1_000,
      duration: 1_000,
    })));
    cadenced.handle.play();
    cadenced.handle.setPlaybackRate(0.1);
    driver.flush(1_000);
    for (let index = 1; index <= 10_000; index++) {
      driver.flush(1_000 + index / 10);
    }

    expect(oneJump).toBe(100);
    expect(cadencedValue.get()).toBe(oneJump);
    expect(cadenced.handle.currentTime.get()).toBe(oneJump);
  });

  it('reanchors stable logical time only when pause-resume, reverse, or rate controls require it', () => {
    const value = signal(0);
    const controller = playback(drive(value, tween({
      from: 0,
      to: 1_000,
      duration: 1_000,
    })));
    controller.handle.play();
    controller.handle.setPlaybackRate(0.1);
    driver.flush(0);
    driver.flush(50);
    expect(value.get()).toBe(5);

    controller.handle.pause();
    driver.flush(60);
    controller.handle.resume();
    driver.flush(100);
    driver.flush(120);
    expect(value.get()).toBe(7);

    controller.handle.reverse();
    driver.flush(130);
    driver.flush(140);
    expect(value.get()).toBe(6);

    controller.handle.setPlaybackRate(0.2);
    driver.flush(150);
    driver.flush(160);
    expect(value.get()).toBe(4);
  });

  it('starts a fresh finite seekable program in reverse from its resolved terminal', () => {
    const value = signal(0);
    const controller = playback(
      drive(value, tween({ from: 0, to: 10, duration: 100 })),
    );

    controller.handle.reverse();
    driver.flush(0);
    expect([value.get(), controller.handle.currentTime.get(), controller.handle.status.get()])
      .toEqual([10, 100, 'running']);
    driver.flush(25);
    expect([value.get(), controller.handle.currentTime.get(), controller.handle.status.get()])
      .toEqual([7.5, 75, 'running']);
  });

  it('finishes an activation-resolved finite spring from a fresh handle', () => {
    const value = signal(2);
    const controller = playback(drive(value, spring({
      to: 10,
      stiffness: 170,
      damping: 26,
      maxDuration: 5_000,
    })));

    controller.handle.finish();
    driver.flush(0);

    expect(value.get()).toBe(10);
    expect(controller.handle.status.get()).toBe('finished');
    expect(controller.handle.currentTime.get()).toBeGreaterThan(0);
    expect(controller.handle.currentTime.get()).toBeLessThan(5_000);
  });

  it('finishes finite content and cancels without restoring committed values', () => {
    const value = signal(0);
    const before = writerLeaseSnapshot();
    const events: string[] = [];
    const controller = playback(
      drive(value, tween({ to: 10, duration: 100 })),
      { onEvent: event => events.push(event.type) },
    );

    controller.handle.play();
    driver.flush(0);
    driver.flush(30);
    controller.handle.finish();
    driver.flush(40);
    expect([value.get(), controller.handle.currentTime.get(), controller.handle.status.get()])
      .toEqual([10, 100, 'finished']);
    expect(events).toEqual(['start', 'finish']);
    expect(writerLeaseSnapshot().active).toBe(before.active);

    controller.handle.play();
    driver.flush(50);
    driver.flush(70);
    const committed = value.get();
    controller.handle.cancel();
    driver.flush(80);
    expect(value.get()).toBe(committed);
    expect(controller.handle.status.get()).toBe('cancelled');
    expect(events).toEqual(['start', 'finish', 'start', 'cancel']);
    expect(writerLeaseSnapshot().active).toBe(before.active);
  });

  it('does not resurrect a cancelled run and lets a later seek create a fresh paused run', () => {
    const firstValue = signal(0);
    const first = playback(drive(firstValue, tween({ to: 10, duration: 100 })));
    first.handle.play();
    driver.flush(0);
    first.handle.pause();
    driver.flush(10);

    first.handle.cancel();
    first.handle.resume();
    driver.flush(20);
    expect(first.handle.status.get()).toBe('cancelled');

    const secondValue = signal(0);
    const second = playback(drive(secondValue, tween({ to: 10, duration: 100 })));
    second.handle.play();
    driver.flush(30);
    second.handle.pause();
    driver.flush(40);

    second.handle.cancel();
    second.handle.seek(50);
    driver.flush(50);
    expect([secondValue.get(), second.handle.currentTime.get(), second.handle.status.get()])
      .toEqual([5, 50, 'paused']);
  });

  it('reports infinite and unresolved stateful reverse/finish controls without acquiring a run', () => {
    const value = signal(0);
    const failures: unknown[] = [];
    const infinite = playback(
      repeat(wait(10), {
        iterations: Number.POSITIVE_INFINITY,
      }),
      { onError: error => failures.push(error) },
    );
    infinite.handle.finish();
    driver.flush(1);
    infinite.handle.reverse();
    driver.flush(2);

    let stepCalls = 0;
    const stateful = playback(drive(value, stepper({
      stepMilliseconds: 10,
      initial: current => current,
      step: state => {
        stepCalls++;
        return state + 1;
      },
      read: state => state,
      done: state => state >= 3,
      debugName: 'unresolved motion',
    })), { onError: error => failures.push(error) });
    stateful.handle.reverse();
    driver.flush(3);
    stateful.handle.finish();
    driver.flush(4);

    expect(failures.map(error => (error as Error).message)).toEqual([
      expect.stringMatching(/infinite.*finish/iu),
      expect.stringMatching(/infinite.*reverse/iu),
      expect.stringMatching(/unresolved motion.*terminal time.*reverse/iu),
      expect.stringMatching(/unresolved motion.*terminal time.*finish/iu),
    ]);
    expect(stepCalls).toBe(0);
    expect(value.get()).toBe(0);
    expect(infinite.handle.status.get()).toBe('idle');
    expect(stateful.handle.status.get()).toBe('idle');
  });

  it('delivers one-shot playback diagnostics despite an unrelated rejected Commit', () => {
    const leased = signal(0, { debugName: 'diagnostic leased output' });
    const rejector = signal(0, {
      equals: () => {
        throw new Error('unrelated Commit rejected');
      },
    });
    const owner = playback(
      drive(leased, tween({ from: 0, to: 10, duration: 100 })),
      { debugName: 'diagnostic owner' },
    );
    const preflightErrors: unknown[] = [];
    const stalePreflightErrors: unknown[] = [];
    const preflightProgram = drive(leased, tween({ from: 0, to: 20, duration: 100 }));
    const preflight = playback(preflightProgram, {
      debugName: 'preflight contender',
      onError: error => stalePreflightErrors.push(error),
    });
    const acquisitionErrors: unknown[] = [];
    const acquisition = playback(
      drive(leased, tween({ from: 0, to: 30, duration: 100 })),
      { debugName: 'acquisition contender', onError: error => acquisitionErrors.push(error) },
    );
    const unavailableErrors: unknown[] = [];
    const unavailable = playback(
      repeat(wait(10), { iterations: Number.POSITIVE_INFINITY }),
      { onError: error => unavailableErrors.push(error) },
    );
    owner.handle.play();
    driver.flush(0);

    const rejectNextCommit = () => {
      let unregister = () => {};
      unregister = registerAdvanceParticipant((_snapshot, batch) => {
        unregister();
        batch.stage(rejector, 1, {});
      }, 'physics');
    };

    rejectNextCommit();
    preflight.handle.play();
    queueFrameCompletion(() => preflight.adopt(preflightProgram, {
      debugName: 'preflight contender',
      onError: error => preflightErrors.push(error),
    }));
    expect(() => driver.flush(10)).toThrow(/unrelated Commit rejected/iu);
    expect(preflightErrors).toHaveLength(1);
    expect(stalePreflightErrors).toEqual([]);
    expect((preflightErrors[0] as Error).message).toMatch(
      /diagnostic leased output.*diagnostic owner/iu,
    );
    expect(preflight.handle.status.get()).toBe('idle');

    rejectNextCommit();
    acquisition.handle.seek(10);
    expect(() => driver.flush(20)).toThrow(/unrelated Commit rejected/iu);
    expect(acquisitionErrors).toHaveLength(1);
    expect((acquisitionErrors[0] as Error).message).toMatch(
      /diagnostic leased output.*diagnostic owner/iu,
    );
    expect(acquisition.handle.status.get()).toBe('idle');

    rejectNextCommit();
    unavailable.handle.finish();
    expect(() => driver.flush(30)).toThrow(/unrelated Commit rejected/iu);
    expect(unavailableErrors).toHaveLength(1);
    expect((unavailableErrors[0] as Error).message).toMatch(/infinite.*finish/iu);
    expect(unavailable.handle.status.get()).toBe('idle');

    driver.flush(40);
    expect(preflightErrors).toHaveLength(1);
    expect(acquisitionErrors).toHaveLength(1);
    expect(unavailableErrors).toHaveLength(1);
    expect(owner.handle.status.get()).toBe('running');
    expect(writerLeaseSnapshot().active).toBe(1);
  });

  it('reports an unhandled one-shot diagnostic alongside the rejected Commit', () => {
    const rejector = signal(0, {
      equals: () => {
        throw new Error('host-path Commit rejected');
      },
    });
    const controller = playback(
      repeat(wait(10), { iterations: Number.POSITIVE_INFINITY }),
    );
    let unregister = () => {};
    unregister = registerAdvanceParticipant((_snapshot, batch) => {
      unregister();
      batch.stage(rejector, 1, {});
    }, 'physics');
    controller.handle.finish();

    let thrown: unknown;
    try {
      driver.flush(0);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AggregateError);
    expect((thrown as AggregateError).errors.map(error => (error as Error).message))
      .toEqual([
        expect.stringMatching(/host-path Commit rejected/iu),
        expect.stringMatching(/infinite.*finish/iu),
      ]);
    expect(controller.handle.status.get()).toBe('idle');
  });

  it('samples seekable definitions directly after dropped frames and clamps stepper work with trace evidence', () => {
    const tweened = signal(0);
    const tweenController = playback(
      drive(tweened, tween({ from: 0, to: 100, duration: 1_000 })),
    );
    tweenController.handle.play();
    driver.flush(0);
    driver.flush(16);
    expect(tweened.get()).toBe(1.6);
    driver.flush(1_000);
    expect(tweened.get()).toBe(100);

    const stepped = signal(0);
    const traces: PibblSchedulerTraceRecord[] = [];
    const restoreTrace = installSchedulerTraceCollectorForTest(record => traces.push(record));
    const stepperController = playback(drive(stepped, stepper({
      stepMilliseconds: 10,
      maxElapsedMilliseconds: 100,
      initial: current => current,
      step: state => state + 1,
      read: state => state,
    })));
    stepperController.handle.play();
    driver.flush(2_000);
    driver.flush(2_250);

    expect(stepped.get()).toBe(10);
    expect(traces).toContainEqual(expect.objectContaining({
      kind: 'animation-stepper',
      clampedElapsedMilliseconds: 100,
      discardedElapsedMilliseconds: 150,
    }));
    restoreTrace();
  });

  it('defers controls queued from Advance, Render, and Complete until the next Begin', () => {
    const advanceValue = signal(0);
    let advanceController!: AnimationPlaybackController;
    let queuedFromAdvance = false;
    advanceController = playback(drive(advanceValue, defineAnimation({
      duration: 100,
      sample: ({ localTime }) => {
        if (localTime > 0 && !queuedFromAdvance) {
          queuedFromAdvance = true;
          advanceController.handle.pause();
        }
        return localTime;
      },
    })));
    advanceController.handle.play();
    driver.flush(0);
    driver.flush(10);
    expect(advanceController.handle.status.get()).toBe('running');
    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(20);
    expect(advanceController.handle.status.get()).toBe('paused');

    const renderValue = signal(0);
    const renderController = playback(drive(renderValue, tween({ to: 10, duration: 100 })));
    let queuedFromRender = false;
    root(createElement(() => {
      if (renderValue.get() > 0 && !queuedFromRender) {
        queuedFromRender = true;
        renderController.handle.pause();
      }
    }, {}));
    driver.flush(30);
    renderController.handle.play();
    driver.flush(40);
    driver.flush(50);
    expect(renderController.handle.status.get()).toBe('running');
    driver.flush(60);
    expect(renderController.handle.status.get()).toBe('paused');

    const completeValue = signal(0);
    let completeController!: AnimationPlaybackController;
    completeController = playback(
      drive(completeValue, tween({ to: 10, duration: 100 })),
      { onEvent: event => {
        if (event.type === 'start') completeController.handle.pause();
      } },
    );
    completeController.handle.play();
    driver.flush(70);
    expect(completeController.handle.status.get()).toBe('running');
    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(80);
    expect(completeController.handle.status.get()).toBe('paused');
  });

  it('defers generic commands queued from Advance and Complete to the next Begin snapshot', () => {
    const calls: string[] = [];
    let release = () => {};
    release = registerAdvanceParticipant(() => {
      release();
      calls.push('advance');
      queueFrameCompletion(() => calls.push('late-complete'));
    }, 'animation');
    queueFrameCompletion(() => calls.push('complete'));

    driver.flush(1);
    expect(calls).toEqual(['advance', 'complete']);
    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(2);
    expect(calls).toEqual(['advance', 'complete', 'late-complete']);
  });

  it('delivers an older run marker and finish before a newer Begin start at the same logical time', () => {
    const events: string[] = [];
    const older = playback(sequence(
      wait(10),
      marker('older marker'),
    ), { onEvent: event => events.push(`older:${event.marker ?? event.type}`) });
    const newerValue = signal(0);
    const newer = playback(
      drive(newerValue, tween({ to: 10, duration: 100 })),
      { onEvent: event => events.push(`newer:${event.type}`) },
    );
    older.handle.play();
    driver.flush(0);
    expect(events).toEqual(['older:start']);
    events.length = 0;

    newer.handle.play();
    driver.flush(10);

    expect(events).toEqual([
      'older:older marker',
      'older:finish',
      'newer:start',
    ]);
    expect(older.handle.status.get()).toBe('finished');
    expect(newer.handle.status.get()).toBe('running');
  });

  it('discards later owner deliveries when an earlier Complete callback disposes it', () => {
    const statefulValue = signal(0);
    const ownerEvents: string[] = [];
    const ownerErrors: unknown[] = [];
    const otherEvents: string[] = [];
    let owner!: AnimationPlaybackController;
    owner = playback(sequence(
      wait(10),
      marker('first owner marker'),
      marker('second owner marker'),
      drive(statefulValue, stepper({
        stepMilliseconds: 10,
        initial: current => current,
        step: state => state + 1,
        read: state => state,
      })),
    ), {
      onEvent: event => {
        ownerEvents.push(event.marker ?? event.type);
        if (event.marker === 'first owner marker') {
          owner.dispose();
          throw new Error('first owner callback failed');
        }
      },
      onError: error => ownerErrors.push(error),
    });
    const other = playback(sequence(
      wait(10),
      marker('other marker'),
    ), { onEvent: event => otherEvents.push(event.marker ?? event.type) });
    owner.handle.play();
    other.handle.play();
    driver.flush(0);
    ownerEvents.length = 0;
    otherEvents.length = 0;

    owner.handle.finish();
    expect(() => driver.flush(10)).toThrow(/first owner callback failed/iu);

    expect(ownerEvents).toEqual(['first owner marker']);
    expect(ownerErrors).toEqual([]);
    expect(owner.handle.status.get()).toBe('disposed');
    expect(otherEvents).toEqual(['other marker', 'finish']);
    expect(other.handle.status.get()).toBe('finished');
  });

  it('cancels only a failing playback, discards its frame writes, and completes unrelated work', () => {
    const failed = signal(0);
    const healthy = signal(0);
    const errors: unknown[] = [];
    const failedController = playback(drive(failed, defineAnimation({
      duration: 100,
      sample: ({ localTime }) => {
        if (localTime >= 10) throw new Error('sample exploded');
        return 5;
      },
    })), { onError: error => errors.push(error) });
    const healthyController = playback(drive(healthy, tween({ to: 10, duration: 100 })));
    failedController.handle.play();
    healthyController.handle.play();
    driver.flush(0);
    expect(failed.get()).toBe(5);
    driver.flush(10);

    expect(failed.get()).toBe(5);
    expect(healthy.get()).toBe(1);
    expect(failedController.handle.status.get()).toBe('cancelled');
    expect(healthyController.handle.status.get()).toBe('running');
    expect((errors[0] as Error).message).toMatch(/sample exploded/iu);
  });

  it('retries terminal sampling and suppresses finish when equality rejects Commit', () => {
    let rejectTerminalOnce = true;
    const value = signal(0, {
      equals: (previous, next) => {
        if (next === 10 && rejectTerminalOnce) {
          rejectTerminalOnce = false;
          throw new Error('terminal equality rejected');
        }
        return Object.is(previous, next);
      },
    });
    const events: string[] = [];
    const before = writerLeaseSnapshot();
    const controller = playback(
      drive(value, tween({ from: 0, to: 10, duration: 10 })),
      { onEvent: event => events.push(event.type) },
    );
    controller.handle.play();
    driver.flush(0);

    expect(() => driver.flush(10)).toThrow(/terminal equality rejected/iu);
    expect([value.get(), controller.handle.currentTime.get(), controller.handle.status.get()])
      .toEqual([0, 0, 'running']);
    expect(events).toEqual(['start']);
    expect(writerLeaseSnapshot().active).toBe(before.active + 1);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(1);
    expect(driver.pendingHostFrames).toBe(1);

    driver.flush(20);
    expect([value.get(), controller.handle.currentTime.get(), controller.handle.status.get()])
      .toEqual([10, 10, 'finished']);
    expect(events).toEqual(['start', 'finish']);
    expect(writerLeaseSnapshot().active).toBe(before.active);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
  });

  it('retries a rejected stateful sample from the last committed activation state', () => {
    let rejectNextStep = true;
    const value = signal(0, {
      equals: (previous, next) => {
        if (next === 1 && rejectNextStep) {
          rejectNextStep = false;
          throw new Error('stateful equality rejected');
        }
        return Object.is(previous, next);
      },
    });
    const traces: PibblSchedulerTraceRecord[] = [];
    const restoreTrace = installSchedulerTraceCollectorForTest(record => traces.push(record));
    const before = {
      leases: writerLeaseSnapshot().active,
      playbacks: animationPlaybackSnapshot().activePlaybacks,
    };
    const controller = playback(drive(value, stepper({
      stepMilliseconds: 10,
      initial: current => current,
      step: state => state + 1,
      read: state => state,
    })));
    controller.handle.play();
    driver.flush(0);
    traces.length = 0;

    expect(() => driver.flush(10)).toThrow(/stateful equality rejected/iu);
    expect([value.get(), controller.handle.currentTime.get()]).toEqual([0, 0]);
    expect(traces.filter(record => record.kind === 'animation-stepper'))
      .toEqual([expect.objectContaining({ appliedSteps: 1 })]);

    traces.length = 0;
    driver.flush(10);
    expect([value.get(), controller.handle.currentTime.get()]).toEqual([1, 10]);
    expect(traces.filter(record => record.kind === 'animation-stepper'))
      .toEqual([expect.objectContaining({ appliedSteps: 1 })]);

    controller.dispose();
    expect(writerLeaseSnapshot().active).toBe(before.leases);
    expect(animationPlaybackSnapshot().activePlaybacks).toBe(before.playbacks);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
    restoreTrace();
  });

  it('replays a rejected alternate repeat frontier and reverse endpoint exactly', () => {
    const value = signal(0);
    const rejector = signal(0, {
      equals: () => {
        throw new Error('repeat frontier rejected');
      },
    });
    const events: string[] = [];
    const traces: PibblSchedulerTraceRecord[] = [];
    const restoreTrace = installSchedulerTraceCollectorForTest(record => traces.push(record));
    const controller = playback(repeat(drive(value, stepper({
      stepMilliseconds: 10,
      initial: (current: number) => ({ value: current, steps: 0 }),
      step: state => ({ value: state.value, steps: state.steps + 1 }),
      read: state => state.value,
      done: state => state.steps === 1,
    })), { iterations: 2, direction: 'alternate' }), {
      onEvent: event => events.push(event.type),
    });
    controller.handle.play();
    driver.flush(0);
    events.length = 0;
    traces.length = 0;
    let unregister = () => {};
    unregister = registerAdvanceParticipant((_snapshot, batch) => {
      unregister();
      batch.stage(rejector, 1, {});
    }, 'physics');

    expect(() => driver.flush(15)).toThrow(/repeat frontier rejected/iu);
    expect([value.get(), controller.handle.currentTime.get()]).toEqual([0, 0]);
    expect(events).toEqual([]);

    traces.length = 0;
    driver.flush(15);
    expect([value.get(), controller.handle.currentTime.get()]).toEqual([0, 15]);
    expect(events).toEqual(['iteration']);
    expect(traces.filter(record => record.kind === 'animation-stepper'))
      .toEqual([
        expect.objectContaining({ appliedSteps: 1 }),
        expect.objectContaining({ appliedSteps: 0 }),
      ]);
    restoreTrace();
  });

  it('does not publish unresolved terminal discovery from a rejected sample', () => {
    let rejectTerminal = true;
    const value = signal(0, {
      equals: (previous, next) => {
        if (next === 1 && rejectTerminal) {
          rejectTerminal = false;
          throw new Error('terminal discovery rejected');
        }
        return Object.is(previous, next);
      },
    });
    const failures: unknown[] = [];
    const controller = playback(drive(value, stepper({
      debugName: 'transactional terminal',
      stepMilliseconds: 10,
      initial: current => current,
      step: state => state + 1,
      read: state => state,
      done: state => state === 1,
    })), { onError: error => failures.push(error) });
    controller.handle.play();
    driver.flush(0);

    expect(() => driver.flush(10)).toThrow(/terminal discovery rejected/iu);
    controller.handle.finish();
    driver.flush(10);

    expect(failures).toHaveLength(1);
    expect((failures[0] as Error).message).toMatch(
      /transactional terminal.*terminal time.*finish/iu,
    );
    expect([value.get(), controller.handle.currentTime.get(), controller.handle.status.get()])
      .toEqual([1, 10, 'finished']);
  });

  it('retries rejected authorization from the old position and redelivers crossed milestones', () => {
    const value = signal(0, { debugName: 'authorization retry output' });
    const events: string[] = [];
    const controller = playback(sequence(
      wait(5),
      marker('committed marker'),
      drive(value, tween({ from: 0, to: 20, duration: 15 })),
    ), { onEvent: event => events.push(event.marker ?? event.type) });
    controller.handle.play();
    driver.flush(0);

    const unauthorizedWriter = Object.freeze({});
    let unregister = () => {};
    unregister = registerAdvanceParticipant((_snapshot, batch) => {
      unregister();
      batch.stage(value, 999, unauthorizedWriter);
    }, 'physics');

    expect(() => driver.flush(10)).toThrow(/does not own the active lease/iu);
    expect([value.get(), controller.handle.currentTime.get(), controller.handle.status.get()])
      .toEqual([0, 0, 'running']);
    expect(events).toEqual(['start']);
    expect(writerLeaseSnapshot().active).toBe(1);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(1);

    driver.flush(20);
    expect([value.get(), controller.handle.currentTime.get(), controller.handle.status.get()])
      .toEqual([20, 20, 'finished']);
    expect(events).toEqual(['start', 'committed marker', 'finish']);
    expect(writerLeaseSnapshot().active).toBe(0);
  });

  it('retains the run and retries an explicit cancellation rejected by Commit', () => {
    const value = signal(0, { debugName: 'cancel retry output' });
    const events: string[] = [];
    const controller = playback(
      drive(value, tween({ from: 0, to: 10, duration: 100 })),
      { onEvent: event => events.push(event.type) },
    );
    controller.handle.play();
    driver.flush(0);

    const unauthorizedWriter = Object.freeze({});
    let unregister = () => {};
    unregister = registerAdvanceParticipant((_snapshot, batch) => {
      unregister();
      batch.stage(value, 999, unauthorizedWriter);
    }, 'physics');
    controller.handle.cancel();

    expect(() => driver.flush(10)).toThrow(/does not own the active lease/iu);
    expect(controller.handle.status.get()).toBe('running');
    expect(events).toEqual(['start']);
    expect(writerLeaseSnapshot().active).toBe(1);
    expect(driver.pendingHostFrames).toBe(1);

    driver.flush(20);
    expect(controller.handle.status.get()).toBe('cancelled');
    expect(events).toEqual(['start', 'cancel']);
    expect(writerLeaseSnapshot().active).toBe(0);
  });

  it('restores registration and retries a pause rejected by Commit', () => {
    const value = signal(0, { debugName: 'pause retry output' });
    const controller = playback(
      drive(value, tween({ from: 0, to: 10, duration: 100 })),
    );
    controller.handle.play();
    driver.flush(0);

    const unauthorizedWriter = Object.freeze({});
    let unregister = () => {};
    unregister = registerAdvanceParticipant((_snapshot, batch) => {
      unregister();
      batch.stage(value, 999, unauthorizedWriter);
    }, 'physics');
    controller.handle.pause();

    expect(() => driver.flush(10)).toThrow(/does not own the active lease/iu);
    expect(controller.handle.status.get()).toBe('running');
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(1);
    expect(driver.pendingHostFrames).toBe(1);

    driver.flush(20);
    expect(controller.handle.status.get()).toBe('paused');
    expect(controller.handle.currentTime.get()).toBe(0);
    expect(value.get()).toBe(0);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
    expect(writerLeaseSnapshot().active).toBe(1);
  });

  it('restores a paused run and retries resume when Commit rejects it', () => {
    const value = signal(0, { debugName: 'resume retry output' });
    const controller = playback(
      drive(value, tween({ from: 0, to: 10, duration: 100 })),
    );
    controller.handle.play();
    driver.flush(0);
    controller.handle.pause();
    driver.flush(1);

    const unauthorizedWriter = Object.freeze({});
    controller.handle.resume();
    let unregister = () => {};
    queueBeginCommand(() => {
      unregister = registerAdvanceParticipant((_snapshot, batch) => {
        unregister();
        batch.stage(value, 999, unauthorizedWriter);
      }, 'physics');
    });

    expect(() => driver.flush(10)).toThrow(/does not own the active lease/iu);
    expect([value.get(), controller.handle.currentTime.get(), controller.handle.status.get()])
      .toEqual([0, 0, 'paused']);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
    expect(driver.pendingHostFrames).toBe(1);

    driver.flush(20);
    expect(controller.handle.status.get()).toBe('running');
    expect(controller.handle.currentTime.get()).toBe(0);
    driver.flush(30);
    expect(value.get()).toBe(1);
  });

  it('finalizes playback when an observer throws after Commit has mutated values', () => {
    const value = signal(0);
    const events: string[] = [];
    const before = writerLeaseSnapshot();
    const controller = playback(
      drive(value, tween({ from: 0, to: 10, duration: 10 })),
      { onEvent: event => events.push(event.type) },
    );
    controller.handle.play();
    driver.flush(0);
    const observer = () => {
      throw new Error('committed observer failed');
    };
    signalObserversForTest(getSignalNode(value)).add(observer);

    expect(() => driver.flush(10)).toThrow(/observer notifications failed/iu);
    signalObserversForTest(getSignalNode(value)).delete(observer);
    expect([value.get(), controller.handle.currentTime.get(), controller.handle.status.get()])
      .toEqual([10, 10, 'finished']);
    expect(events).toEqual(['start', 'finish']);
    expect(writerLeaseSnapshot().active).toBe(before.active);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
    expect(driver.pendingHostFrames).toBe(0);
  });

  it('keeps an existing lease on error and cancels it in order when replacement is requested', () => {
    const value = signal(0, { debugName: 'shared playback output' });
    const events: string[] = [];
    const conflicts: unknown[] = [];
    const first = playback(
      drive(value, tween({ to: 10, duration: 100 })),
      { debugName: 'first', onEvent: event => events.push(`first:${event.type}`) },
    );
    const second = playback(
      drive(value, tween({ to: 20, duration: 100 })),
      {
        debugName: 'second',
        onEvent: event => events.push(`second:${event.type}`),
        onError: error => conflicts.push(error),
      },
    );
    first.handle.play();
    driver.flush(0);
    driver.flush(20);
    expect(value.get()).toBe(2);

    second.handle.play();
    driver.flush(30);
    expect((conflicts[0] as Error).message).toMatch(/shared playback output.*first/iu);
    expect(first.handle.status.get()).toBe('running');
    expect(second.handle.status.get()).toBe('cancelled');

    second.handle.play({ conflict: 'replace' });
    driver.flush(40);
    expect(first.handle.status.get()).toBe('cancelled');
    expect(second.handle.status.get()).toBe('running');
    expect(value.get()).toBe(3);
    expect(events).toEqual([
      'first:start',
      'first:cancel',
      'second:start',
    ]);
  });

  it('discards a playback output when its controller is disposed from its own sampler', () => {
    const value = signal(0);
    let controller!: AnimationPlaybackController;
    controller = playback(drive(value, defineAnimation({
      duration: 100,
      sample: ({ localTime }) => {
        if (localTime > 0) controller.dispose();
        return localTime > 0 ? 101 : 99;
      },
    })));
    controller.handle.play();
    driver.flush(0);
    expect(value.get()).toBe(99);

    driver.flush(10);
    expect(value.get()).toBe(99);
    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(20);
    expect(controller.handle.status.get()).toBe('disposed');
  });

  it('makes a disposed controller and all already queued commands inert', () => {
    const value = signal(0);
    const before = animationPlaybackSnapshot();
    const controller = playback(drive(value, tween({ to: 10, duration: 100 })));
    controller.handle.play();
    controller.dispose();

    expect(controller.handle.status.get()).toBe('disposed');
    expect(driver.pendingHostFrames).toBe(0);
    controller.handle.play();
    controller.handle.pause();
    controller.handle.resume();
    controller.handle.cancel();
    controller.handle.finish();
    controller.handle.seek(Number.NaN);
    controller.handle.reverse();
    controller.handle.setPlaybackRate(0);
    expect(driver.pendingHostFrames).toBe(0);
    expect(value.get()).toBe(0);
    expect(animationPlaybackSnapshot()).toMatchObject({
      activePlaybacks: before.activePlaybacks,
      queuedCommands: before.queuedCommands,
    });
  });

  it('keeps command records immutable and accepts only the latest queued play generation', () => {
    const value = signal(0);
    const records: PibblSchedulerTraceRecord[] = [];
    const restoreTrace = installSchedulerTraceCollectorForTest(record => records.push(record));
    const controller = playback(drive(value, tween({ to: 10, duration: 100 })));

    controller.handle.play();
    controller.handle.pause();
    controller.handle.play();
    controller.handle.reverse();
    driver.flush(0);

    const commands = records.filter(record => record.kind === 'animation-command');
    expect(commands.map(record => record.command)).toEqual(['play', 'reverse']);
    expect(commands.every(Object.isFrozen)).toBe(true);
    expect(controller.handle.status.get()).toBe('finished');
    expect(controller.handle.currentTime.get()).toBe(0);
    expect(snapshotRealmScheduler().pendingHostFrames).toBe(0);
    restoreTrace();
  });

  it('traces only outputs actually staged by the sampled program path', () => {
    const active = signal(0, { debugName: 'active trace output' });
    const future = signal(0, { debugName: 'future trace output' });
    const records: PibblSchedulerTraceRecord[] = [];
    const restoreTrace = installSchedulerTraceCollectorForTest(record => records.push(record));
    const controller = playback(sequence(
      drive(active, tween({ to: 10, duration: 100 })),
      drive(future, tween({ to: 10, duration: 100 })),
    ));

    controller.handle.play();
    driver.flush(0);

    expect(records).toContainEqual(expect.objectContaining({
      kind: 'animation-write',
      target: 'active trace output',
      outcome: 'equality-suppressed',
    }));
    expect(records).not.toContainEqual(expect.objectContaining({
      kind: 'animation-write',
      target: 'future trace output',
    }));
    restoreTrace();
  });

  it.each([
    {
      point: 'Begin command',
      throwsAt: (record: PibblSchedulerTraceRecord) =>
        record.kind === 'animation-command',
    },
    {
      point: 'Begin start milestone',
      throwsAt: (record: PibblSchedulerTraceRecord) =>
        record.kind === 'animation-milestone' && record.event === 'start',
    },
    {
      point: 'Advance sample',
      throwsAt: (record: PibblSchedulerTraceRecord) =>
        record.kind === 'animation-sample',
    },
    {
      point: 'Complete write',
      throwsAt: (record: PibblSchedulerTraceRecord) =>
        record.kind === 'animation-write',
    },
  ])('isolates a trace collector exception at $point', ({ throwsAt }) => {
    const value = signal(0);
    const events: string[] = [];
    const before = writerLeaseSnapshot();
    const controller = playback(
      drive(value, tween({ from: 0, to: 10, duration: 10 })),
      { onEvent: event => events.push(event.type) },
    );
    const restoreTrace = installSchedulerTraceCollectorForTest(record => {
      if (throwsAt(record)) throw new Error('trace collector exploded');
    });

    expect(() => {
      controller.handle.play();
      driver.flush(0);
      driver.flush(10);
    }).not.toThrow();
    expect(value.get()).toBe(10);
    expect(controller.handle.status.get()).toBe('finished');
    expect(events).toEqual(['start', 'finish']);
    expect(writerLeaseSnapshot().active).toBe(before.active);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
    restoreTrace();
  });

  it('isolates trace collector exceptions from Advance marker and stepper facts', () => {
    const markerValue = signal(0);
    const markerEvents: string[] = [];
    const markerController = playback(sequence(
      marker('trace marker'),
      drive(markerValue, tween({ from: 0, to: 10, duration: 10 })),
    ), { onEvent: event => markerEvents.push(event.marker ?? event.type) });
    let restoreTrace = installSchedulerTraceCollectorForTest(record => {
      if (record.kind === 'animation-milestone' && record.event === 'marker') {
        throw new Error('marker trace exploded');
      }
    });
    expect(() => {
      markerController.handle.play();
      driver.flush(0);
      driver.flush(10);
    }).not.toThrow();
    expect(markerValue.get()).toBe(10);
    expect(markerController.handle.status.get()).toBe('finished');
    expect(markerEvents).toEqual(['start', 'trace marker', 'finish']);
    restoreTrace();

    const stepped = signal(0);
    const stepperEvents: string[] = [];
    const stepperController = playback(drive(stepped, stepper({
      stepMilliseconds: 10,
      initial: current => current,
      step: state => state + 1,
      read: state => state,
      done: state => state >= 1,
    })), { onEvent: event => stepperEvents.push(event.type) });
    restoreTrace = installSchedulerTraceCollectorForTest(record => {
      if (record.kind === 'animation-stepper') {
        throw new Error('stepper trace exploded');
      }
    });
    expect(() => {
      stepperController.handle.play();
      driver.flush(20);
      if (stepperController.handle.status.get() !== 'finished') driver.flush(30);
    }).not.toThrow();
    expect(stepped.get()).toBe(1);
    expect(stepperController.handle.status.get()).toBe('finished');
    expect(stepperEvents).toEqual(['start', 'finish']);
    restoreTrace();
  });

  it('isolates a trace collector exception from evaluator error cleanup and callbacks', () => {
    const value = signal(0);
    const events: string[] = [];
    const errors: unknown[] = [];
    const before = writerLeaseSnapshot();
    const controller = playback(drive(value, defineAnimation({
      duration: 100,
      sample: ({ localTime }) => {
        if (localTime >= 10) throw new Error('sampler exploded');
        return 1;
      },
    })), {
      onEvent: event => events.push(event.type),
      onError: error => errors.push(error),
    });
    const restoreTrace = installSchedulerTraceCollectorForTest(record => {
      if (record.kind === 'animation-error') throw new Error('error trace exploded');
    });

    expect(() => {
      controller.handle.play();
      driver.flush(0);
      driver.flush(10);
    }).not.toThrow();
    expect(value.get()).toBe(1);
    expect(controller.handle.status.get()).toBe('cancelled');
    expect(events).toEqual(['start', 'cancel']);
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toMatch(/sampler exploded/iu);
    expect(writerLeaseSnapshot().active).toBe(before.active);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
    restoreTrace();
  });
});

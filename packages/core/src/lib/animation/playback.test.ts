import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  computed,
  crc,
  createElement,
  defineAnimation,
  repeat,
  sequence,
  signal,
  spring,
  stepper,
  track,
  tween,
  wait,
  type CRCAnimationProgram,
  type CRCNode,
} from '../../index';
import { clearSharedState } from '../global-state';
import { getSignalNode } from '../signals/graph';
import {
  queueFrameCompletion,
  registerAdvanceParticipant,
} from '../scheduler/realm-scheduler';
import {
  installSchedulerDriverForTest,
  installSchedulerTraceCollectorForTest,
  ManualSchedulerDriver,
  snapshotRealmScheduler,
  type CRCSchedulerTraceRecord,
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
const roots = new Set<ReturnType<typeof crc>>();

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
  program: CRCAnimationProgram,
  options: Parameters<typeof createAnimationPlaybackController>[1] = {},
): AnimationPlaybackController {
  const controller = createAnimationPlaybackController(program, options);
  controllers.add(controller);
  return controller;
}

function root(node: CRCNode) {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const controller = crc(canvas, node);
  roots.add(controller);
  return controller;
}

describe('scheduler-integrated animation playback', () => {
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

    firstController = playback(track(firstValue, defineAnimation({
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
    secondController = playback(track(secondValue, defineAnimation({
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
    getSignalNode(firstValue).observers.add(() => order.push('commit:1'));
    getSignalNode(secondValue).observers.add(() => order.push('commit:2'));

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
    const controller = playback(track(value, tween({ to: 10, duration: 100 })));

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
    const controller = playback(track(output, defineAnimation({
      duration: 100,
      sample: ({ localTime }) => ({ value: localTime / 100 }),
    })), { onError: error => failures.push(error) });
    controller.handle.play();
    driver.flush(0);

    controller.adopt(track(output, tween({
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

  it('pauses without a jump, retains leases, and resumes from a fresh anchor', () => {
    const value = signal(0);
    const before = writerLeaseSnapshot();
    const controller = playback(track(value, tween({ to: 10, duration: 100 })));

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

  it('seeks fresh idle, cancelled, and finished handles into a paused run', () => {
    const value = signal(0);
    const controller = playback(track(value, tween({ to: 10, duration: 100 })));

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
    const controller = playback(track(value, tween({ from: 0, to: 10, duration: 100 })));

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

  it('starts a fresh finite seekable program in reverse from its resolved terminal', () => {
    const value = signal(0);
    const controller = playback(
      track(value, tween({ from: 0, to: 10, duration: 100 })),
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
    const controller = playback(track(value, spring({
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
      track(value, tween({ to: 10, duration: 100 })),
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
    const first = playback(track(firstValue, tween({ to: 10, duration: 100 })));
    first.handle.play();
    driver.flush(0);
    first.handle.pause();
    driver.flush(10);

    first.handle.cancel();
    first.handle.resume();
    driver.flush(20);
    expect(first.handle.status.get()).toBe('cancelled');

    const secondValue = signal(0);
    const second = playback(track(secondValue, tween({ to: 10, duration: 100 })));
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
    const stateful = playback(track(value, stepper({
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

  it('samples seekable definitions directly after dropped frames and clamps stepper work with trace evidence', () => {
    const tweened = signal(0);
    const tweenController = playback(
      track(tweened, tween({ from: 0, to: 100, duration: 1_000 })),
    );
    tweenController.handle.play();
    driver.flush(0);
    driver.flush(16);
    expect(tweened.get()).toBe(1.6);
    driver.flush(1_000);
    expect(tweened.get()).toBe(100);

    const stepped = signal(0);
    const traces: CRCSchedulerTraceRecord[] = [];
    const restoreTrace = installSchedulerTraceCollectorForTest(record => traces.push(record));
    const stepperController = playback(track(stepped, stepper({
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
    advanceController = playback(track(advanceValue, defineAnimation({
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
    const renderController = playback(track(renderValue, tween({ to: 10, duration: 100 })));
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
      track(completeValue, tween({ to: 10, duration: 100 })),
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
    });
    queueFrameCompletion(() => calls.push('complete'));

    driver.flush(1);
    expect(calls).toEqual(['advance', 'complete']);
    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(2);
    expect(calls).toEqual(['advance', 'complete', 'late-complete']);
  });

  it('cancels only a failing playback, discards its frame writes, and completes unrelated work', () => {
    const failed = signal(0);
    const healthy = signal(0);
    const errors: unknown[] = [];
    const failedController = playback(track(failed, defineAnimation({
      duration: 100,
      sample: ({ localTime }) => {
        if (localTime >= 10) throw new Error('sample exploded');
        return 5;
      },
    })), { onError: error => errors.push(error) });
    const healthyController = playback(track(healthy, tween({ to: 10, duration: 100 })));
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

  it('keeps an existing lease on error and cancels it in order when replacement is requested', () => {
    const value = signal(0, { debugName: 'shared playback output' });
    const events: string[] = [];
    const conflicts: unknown[] = [];
    const first = playback(
      track(value, tween({ to: 10, duration: 100 })),
      { debugName: 'first', onEvent: event => events.push(`first:${event.type}`) },
    );
    const second = playback(
      track(value, tween({ to: 20, duration: 100 })),
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
    controller = playback(track(value, defineAnimation({
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
    const controller = playback(track(value, tween({ to: 10, duration: 100 })));
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
    const records: CRCSchedulerTraceRecord[] = [];
    const restoreTrace = installSchedulerTraceCollectorForTest(record => records.push(record));
    const controller = playback(track(value, tween({ to: 10, duration: 100 })));

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
    const records: CRCSchedulerTraceRecord[] = [];
    const restoreTrace = installSchedulerTraceCollectorForTest(record => records.push(record));
    const controller = playback(sequence(
      track(active, tween({ to: 10, duration: 100 })),
      track(future, tween({ to: 10, duration: 100 })),
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
});

import {
  pibbl,
  usePlayback,
  createElement,
  defineAnimation,
  signal,
  stepper,
  drive,
  tween,
  type PibblController,
  type PibblNode,
  type PibblPlayback,
} from '@pibbl/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  animationPlaybackSnapshot,
  type AnimationPlaybackSnapshot,
} from '../src/lib/animation/playback';
import { animationEvaluationOwnershipSnapshot } from '../src/lib/animation/evaluate';
import { writerLeaseSnapshot } from '../src/lib/animation/writer-leases';
import { clearSharedState } from '../src/lib/global-state';
import { signalGraphSnapshot } from '../src/lib/signals/graph';
import {
  installSchedulerDriverForTest,
  installSchedulerTraceCollectorForTest,
  ManualSchedulerDriver,
  snapshotRealmScheduler,
  type PibblSchedulerTraceRecord,
} from '../src/lib/scheduler/testing';
import type { RealmSchedulerSnapshot } from '../src/lib/scheduler/types';

interface AnimationOwnershipCounters extends AnimationPlaybackSnapshot {
  readonly activeStepperStates: number;
  readonly acquiredStepperStates: number;
  readonly releasedStepperStates: number;
}

interface ExactSchedulerOwnershipSnapshot extends RealmSchedulerSnapshot {
  readonly createdBeginCommands: number;
  readonly releasedBeginCommands: number;
  readonly createdCompletionCallbacks: number;
  readonly releasedCompletionCallbacks: number;
}

interface ExactSignalGraphOwnershipSnapshot extends ReturnType<
  typeof signalGraphSnapshot
> {
  readonly createdRendererEdges: number;
  readonly releasedRendererEdges: number;
}

const controllers = new Set<PibblController>();
let driver: ManualSchedulerDriver;
let restoreDriver: () => void;

beforeEach(() => {
  document.body.replaceChildren();
  driver = new ManualSchedulerDriver();
  restoreDriver = installSchedulerDriverForTest(driver);
});

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  clearSharedState();
  restoreDriver();
  document.body.replaceChildren();
});

describe('animation lifecycle ownership', () => {
  it('balances one stepper run through autoplay, controls, replacement, and owner removal', () => {
    const baseline = animationOwnershipSnapshot();
    const schedulerBaseline = exactSchedulerSnapshot();
    const graphBaseline = exactSignalGraphSnapshot();
    const output = signal(0, { debugName: 'owned animation output' });
    const events: string[] = [];
    const trace: PibblSchedulerTraceRecord[] = [];
    const restoreTrace = installSchedulerTraceCollectorForTest(record => {
      trace.push(record);
    });
    let stepping!: PibblPlayback;
    let replacement!: PibblPlayback;

    function Owner(): PibblNode {
      stepping = usePlayback(drive(output, stepper({
        stepMilliseconds: 10,
        maxElapsedMilliseconds: 40,
        initial: current => current,
        step: state => state + 1,
        read: state => state,
        debugName: 'owned stepper',
      })), {
        autoplay: true,
        debugName: 'stepping owner',
        onEvent: event => events.push(`stepping:${event.type}`),
      });
      replacement = usePlayback(drive(output, tween({
        from: 0,
        to: 100,
        duration: 100,
        debugName: 'replacement tween',
      })), {
        debugName: 'replacement owner',
        onEvent: event => events.push(`replacement:${event.type}`),
      });
      output.get();
      stepping.status.get();
      stepping.currentTime.get();
      return undefined;
    }

    const canvas = createCanvas();
    const controller = mount(canvas, createElement(Owner, {}));
    driver.flush(-1);
    expect(animationOwnershipSnapshot()).toMatchObject({
      activePlaybacks: baseline.activePlaybacks,
      activeWriterLeases: baseline.activeWriterLeases,
      activeStepperStates: baseline.activeStepperStates,
      queuedCommands: baseline.queuedCommands + 1,
      queuedMilestones: baseline.queuedMilestones,
    });

    driver.flush(0);
    expect(animationOwnershipSnapshot()).toMatchObject({
      activePlaybacks: baseline.activePlaybacks + 1,
      activeWriterLeases: baseline.activeWriterLeases + 1,
      activeStepperStates: baseline.activeStepperStates + 1,
      queuedCommands: baseline.queuedCommands,
      queuedMilestones: baseline.queuedMilestones,
    });
    expect(events).toEqual(['stepping:start']);
    expect(snapshotRealmScheduler()).toMatchObject({
      registeredRoots: schedulerBaseline.registeredRoots + 1,
      registeredAdvanceParticipants: 1,
      queuedBeginCommands: 0,
      pendingHostFrames: 1,
    });

    stepping.pause();
    expect(animationOwnershipSnapshot().queuedCommands).toBe(
      baseline.queuedCommands + 1,
    );
    driver.flush(10);
    expect(stepping.status.get()).toBe('paused');
    expect(animationOwnershipSnapshot()).toMatchObject({
      activePlaybacks: baseline.activePlaybacks + 1,
      activeWriterLeases: baseline.activeWriterLeases + 1,
      activeStepperStates: baseline.activeStepperStates + 1,
      queuedCommands: baseline.queuedCommands,
      queuedMilestones: baseline.queuedMilestones,
    });
    expect(snapshotRealmScheduler()).toMatchObject({
      registeredAdvanceParticipants: 0,
      pendingHostFrames: 0,
    });

    stepping.seek(30);
    stepping.reverse();
    expect(snapshotRealmScheduler().queuedBeginCommands).toBe(2);
    driver.flush(20);
    expect(stepping.status.get()).toBe('paused');
    expect(stepping.currentTime.get()).toBe(30);
    expect(output.get()).toBe(3);
    expect(animationOwnershipSnapshot().activeStepperStates).toBe(
      baseline.activeStepperStates + 1,
    );

    replacement.play({ conflict: 'replace' });
    driver.flush(40);
    expect(stepping.status.get()).toBe('cancelled');
    expect(replacement.status.get()).toBe('running');
    expect(animationOwnershipSnapshot()).toMatchObject({
      activePlaybacks: baseline.activePlaybacks + 1,
      activeWriterLeases: baseline.activeWriterLeases + 1,
      activeStepperStates: baseline.activeStepperStates,
      queuedCommands: baseline.queuedCommands,
      queuedMilestones: baseline.queuedMilestones,
    });
    expect(events).toEqual([
      'stepping:start',
      'stepping:cancel',
      'replacement:start',
    ]);

    pibbl(canvas, undefined);
    driver.flush(50);
    expect(animationOwnershipSnapshot()).toMatchObject({
      activePlaybacks: baseline.activePlaybacks,
      activeWriterLeases: baseline.activeWriterLeases,
      activeStepperStates: baseline.activeStepperStates,
      queuedCommands: baseline.queuedCommands,
      queuedMilestones: baseline.queuedMilestones,
      createdPlaybacks: baseline.createdPlaybacks + 2,
      releasedPlaybacks: baseline.releasedPlaybacks + 2,
      acquiredWriterLeases: baseline.acquiredWriterLeases + 2,
      releasedWriterLeases: baseline.releasedWriterLeases + 2,
      acquiredStepperStates: baseline.acquiredStepperStates + 2,
      releasedStepperStates: baseline.releasedStepperStates + 2,
    });
    expect(exactSignalGraphSnapshot()).toMatchObject({
      rendererConsumers: graphBaseline.rendererConsumers,
      rendererEdges: graphBaseline.rendererEdges,
      pendingComputedValidations: 0,
      createdRendererConsumers: graphBaseline.createdRendererConsumers + 1,
      releasedRendererConsumers: graphBaseline.releasedRendererConsumers + 1,
      createdRendererEdges: graphBaseline.createdRendererEdges + 3,
      releasedRendererEdges: graphBaseline.releasedRendererEdges + 3,
    });
    expect(snapshotRealmScheduler()).toMatchObject({
      queuedBeginCommands: 2,
      pendingHostFrames: 1,
    });
    driver.flush(51);

    controller.dispose();
    controllers.delete(controller);
    expectReleasedAnimationState(baseline);
    expect(exactSchedulerSnapshot()).toMatchObject({
      registeredRoots: schedulerBaseline.registeredRoots,
      createdRootRegistrations: schedulerBaseline.createdRootRegistrations + 1,
      releasedRootRegistrations: schedulerBaseline.releasedRootRegistrations + 1,
      createdBeginCommands: schedulerBaseline.createdBeginCommands + 7,
      releasedBeginCommands: schedulerBaseline.releasedBeginCommands + 7,
      createdCompletionCallbacks:
        schedulerBaseline.createdCompletionCallbacks + 23,
      releasedCompletionCallbacks:
        schedulerBaseline.releasedCompletionCallbacks + 23,
      pendingHostFrames: 0,
    });
    expect(
      trace.filter(record => record.kind === 'animation-command').map(record =>
        record.command
      ),
    ).toEqual(['play', 'pause', 'seek', 'reverse', 'play']);
    restoreTrace();
  });

  it('releases failure, abort, disposal, and fresh-remount generations exactly', () => {
    const baseline = animationOwnershipSnapshot();
    const schedulerBaseline = exactSchedulerSnapshot();
    const graphBaseline = exactSignalGraphSnapshot();
    const failedOutput = signal(0, { debugName: 'failed output' });
    const errors: unknown[] = [];
    let failing!: PibblPlayback;

    function FailingOwner(): PibblNode {
      failing = usePlayback(drive(failedOutput, defineAnimation({
        duration: 100,
        sample: ({ localTime }) => {
          if (localTime >= 10) throw new Error('owned sampler failed');
          return 1;
        },
      })), {
        autoplay: true,
        onError: error => errors.push(error),
      });
      failedOutput.get();
      return undefined;
    }

    const failureCanvas = createCanvas();
    const failureRoot = mount(failureCanvas, createElement(FailingOwner, {}));
    driver.flush(-1);
    driver.flush(0);
    driver.flush(10);
    expect((errors[0] as Error).message).toBe('owned sampler failed');
    expect(failing.status.get()).toBe('cancelled');
    expectReleasedAnimationState(baseline);

    const rootFailureOutput = signal(0);
    let brokenPlayback!: PibblPlayback;
    function BrokenOwner(): PibblNode {
      brokenPlayback = usePlayback(drive(rootFailureOutput, tween({
        from: 0,
        to: 10,
        duration: 100,
      })), { autoplay: true });
      if (rootFailureOutput.get() > 0) throw new Error('animated root failed');
      return undefined;
    }

    const brokenCanvas = createCanvas();
    const brokenRoot = mount(brokenCanvas, createElement(BrokenOwner, {}));
    driver.flush(20);
    driver.flush(30);
    expect(() => driver.flush(40)).toThrow('animated root failed');
    expectReleasedAnimationStateWithoutDeferredDisposal(baseline);
    if (driver.pendingHostFrames > 0) driver.flush(41);
    expect(brokenPlayback.status.get()).toBe('disposed');
    expectReleasedAnimationState(baseline);

    const abortController = new AbortController();
    const abortedOutput = signal(0);
    function AbortedOwner(): PibblNode {
      usePlayback(drive(abortedOutput, tween({
        from: 0,
        to: 10,
        duration: 100,
      })), { autoplay: true });
      abortedOutput.get();
      return undefined;
    }
    const abortedRoot = mount(
      createCanvas(),
      createElement(AbortedOwner, {}),
      abortController.signal,
    );
    driver.flush(50);
    driver.flush(60);
    abortController.abort();
    controllers.delete(abortedRoot);
    expectReleasedAnimationState(baseline);

    failureRoot.dispose();
    brokenRoot.dispose();
    controllers.delete(failureRoot);
    controllers.delete(brokenRoot);

    const remountCanvas = createCanvas();
    for (let cycle = 0; cycle < 5; cycle += 1) {
      const output = signal(0);
      function FreshOwner(): PibblNode {
        usePlayback(drive(output, tween({
          from: 0,
          to: 1,
          duration: 100,
        })), { autoplay: true });
        output.get();
        return undefined;
      }
      const fresh = mount(remountCanvas, createElement(FreshOwner, {}));
      driver.flush(70 + cycle * 2);
      driver.flush(71 + cycle * 2);
      fresh.dispose();
      controllers.delete(fresh);
      expectReleasedAnimationState(baseline);
    }

    expect(exactSignalGraphSnapshot()).toMatchObject({
      rendererConsumers: graphBaseline.rendererConsumers,
      rendererEdges: graphBaseline.rendererEdges,
      pendingComputedValidations: 0,
      createdRendererConsumers: graphBaseline.createdRendererConsumers + 8,
      releasedRendererConsumers: graphBaseline.releasedRendererConsumers + 8,
      createdRendererEdges: graphBaseline.createdRendererEdges + 8,
      releasedRendererEdges: graphBaseline.releasedRendererEdges + 8,
    });
    expect(exactSchedulerSnapshot()).toMatchObject({
      registeredRoots: schedulerBaseline.registeredRoots,
      registeredAdvanceParticipants: 0,
      completionCallbacks: 0,
      queuedBeginCommands: 0,
      pendingHostFrames: 0,
      createdRootRegistrations: schedulerBaseline.createdRootRegistrations + 8,
      releasedRootRegistrations: schedulerBaseline.releasedRootRegistrations + 8,
      createdBeginCommands: schedulerBaseline.createdBeginCommands + 9,
      releasedBeginCommands: schedulerBaseline.releasedBeginCommands + 9,
      createdCompletionCallbacks: schedulerBaseline.createdCompletionCallbacks + 48,
      releasedCompletionCallbacks:
        schedulerBaseline.releasedCompletionCallbacks + 48,
    });
    const final = animationOwnershipSnapshot();
    expect(final.createdPlaybacks - baseline.createdPlaybacks).toBe(8);
    expect(final.releasedPlaybacks - baseline.releasedPlaybacks).toBe(8);
    expect(final.acquiredWriterLeases - baseline.acquiredWriterLeases).toBe(8);
    expect(final.releasedWriterLeases - baseline.releasedWriterLeases).toBe(8);
  });
});

function animationOwnershipSnapshot(): AnimationOwnershipCounters & {
  readonly activeWriterLeases: number;
  readonly acquiredWriterLeases: number;
  readonly releasedWriterLeases: number;
} {
  const playback = animationPlaybackSnapshot();
  const steppers = animationEvaluationOwnershipSnapshot();
  const leases = writerLeaseSnapshot();
  return {
    ...playback,
    ...steppers,
    activeWriterLeases: leases.active,
    acquiredWriterLeases: leases.acquired,
    releasedWriterLeases: leases.released,
  };
}

function expectReleasedAnimationState(baseline: ReturnType<
  typeof animationOwnershipSnapshot
>): void {
  expectReleasedAnimationStateWithoutDeferredDisposal(baseline);
  expect(snapshotRealmScheduler()).toMatchObject({
    completionCallbacks: 0,
    queuedBeginCommands: 0,
    pendingHostFrames: 0,
  });
}

function expectReleasedAnimationStateWithoutDeferredDisposal(baseline: ReturnType<
  typeof animationOwnershipSnapshot
>): void {
  expect(animationOwnershipSnapshot()).toMatchObject({
    activePlaybacks: baseline.activePlaybacks,
    activeWriterLeases: baseline.activeWriterLeases,
    activeStepperStates: baseline.activeStepperStates,
    queuedCommands: baseline.queuedCommands,
    queuedMilestones: baseline.queuedMilestones,
  });
  expect(snapshotRealmScheduler()).toMatchObject({
    registeredAdvanceParticipants: 0,
    completionCallbacks: 0,
  });
}

function exactSchedulerSnapshot(): ExactSchedulerOwnershipSnapshot {
  const snapshot = snapshotRealmScheduler() as Partial<
    ExactSchedulerOwnershipSnapshot
  >;
  expect(
    snapshot.createdBeginCommands,
    'The scheduler must count every acquired Begin command.',
  ).toBeTypeOf('number');
  expect(snapshot.releasedBeginCommands).toBeTypeOf('number');
  expect(snapshot.createdCompletionCallbacks).toBeTypeOf('number');
  expect(snapshot.releasedCompletionCallbacks).toBeTypeOf('number');
  return snapshot as ExactSchedulerOwnershipSnapshot;
}

function exactSignalGraphSnapshot(): ExactSignalGraphOwnershipSnapshot {
  const snapshot = signalGraphSnapshot() as Partial<
    ExactSignalGraphOwnershipSnapshot
  >;
  expect(
    snapshot.createdRendererEdges,
    'The signal graph must count every acquired renderer edge.',
  ).toBeTypeOf('number');
  expect(snapshot.releasedRendererEdges).toBeTypeOf('number');
  return snapshot as ExactSignalGraphOwnershipSnapshot;
}

function mount(
  canvas: HTMLCanvasElement,
  node: PibblNode,
  abortSignal?: AbortSignal,
): PibblController {
  const controller = pibbl(canvas, node, abortSignal === undefined ? undefined : {
    signal: abortSignal,
  });
  controllers.add(controller);
  return controller;
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  canvas.style.cssText = 'display:block;width:8px;height:8px';
  document.body.appendChild(canvas);
  return canvas;
}

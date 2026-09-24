import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  crcInternalCurrentFrame,
  crcInternalCurrentRenderOwner,
  crcInternalRequestRendererWork,
  type CRCInternalRenderOwner,
} from '@crc/core/internal';
import {
  crc,
  usePlayback,
  defineAnimation,
  marker,
  parallel,
  repeat,
  sequence,
  signal,
  track,
  tween,
  wait,
  type CRCAnimationProgram,
  type CRCPlayback,
  type CRCPlaybackEvent,
  type CRCPlaybackOptions,
} from '../../index.js';
import { clearSharedState, getCRCInstance } from '../global-state.js';
import { animationPlaybackSnapshot } from '../animation/playback.js';
import { writerLeaseSnapshot } from '../animation/writer-leases.js';
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
  snapshotRealmScheduler,
} from '../scheduler/testing.js';

let driver: ManualSchedulerDriver;
let restoreDriver: () => void;
const roots = new Set<ReturnType<typeof crc>>();

beforeEach(() => {
  document.body.replaceChildren();
  driver = new ManualSchedulerDriver();
  restoreDriver = installSchedulerDriverForTest(driver);
});

afterEach(() => {
  for (const root of roots) root.dispose();
  roots.clear();
  clearSharedState();
  restoreDriver();
  document.body.replaceChildren();
});

function mount(node: Parameters<typeof crc>[1]): ReturnType<typeof crc> {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const controller = crc(canvas, node);
  roots.add(controller);
  return controller;
}

describe('usePlayback', () => {
  it('resolves signal-valued programs, option objects, and direct option fields at the hook owner', () => {
    const output = signal(0);
    const events: string[] = [];
    const program = signal<CRCAnimationProgram>(
      track(output, tween({ to: 10, duration: 100 })),
    );
    const onEvent = signal<(event: CRCPlaybackEvent) => void>(
      event => events.push(`first:${event.type}`),
    );
    const options = signal({ onEvent });
    let handle!: CRCPlayback;
    function Probe() {
      handle = usePlayback(program, options);
    }

    roots.add(mount(<Probe />));
    driver.flush(-1);
    handle.play();
    driver.flush(0);
    driver.flush(100);

    expect(output.get()).toBe(10);
    expect(events).toEqual(['first:start', 'first:finish']);

    program.set(track(output, tween({ from: 10, to: 20, duration: 100 })));
    onEvent.set(event => events.push(`second:${event.type}`));
    driver.flush(101);
    handle.play();
    driver.flush(110);
    driver.flush(210);

    expect(output.get()).toBe(20);
    expect(events).toEqual([
      'first:start',
      'first:finish',
      'second:start',
      'second:finish',
    ]);
  });

  it('returns one frozen handle for a mounted hook slot across fresh programs', () => {
    const output = signal(0);
    const handles: CRCPlayback[] = [];
    function Probe({ to }: { to: number }) {
      handles.push(usePlayback(track(output, tween({ to, duration: 100 }))));
    }

    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const controller = crc(canvas, <Probe to={10} />);
    roots.add(controller);
    driver.flush(0);
    crc(canvas, <Probe to={20} />);
    driver.flush(1);

    expect(handles).toHaveLength(2);
    expect(handles[1]).toBe(handles[0]);
    expect(Object.isFrozen(handles[0])).toBe(true);
    expect(handles[0].status.get()).toBe('idle');
    expect(handles[0].currentTime.get()).toBe(0);
  });

  it('keeps an active program snapshot and adopts the latest successful program for the next run', () => {
    const output = signal(0);
    let handle!: CRCPlayback;
    function Probe({ to }: { to: number }) {
      handle = usePlayback(track(output, tween({ to, duration: 100 })));
    }

    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    roots.add(crc(canvas, <Probe to={10} />));
    driver.flush(-10);

    handle.play();
    driver.flush(0);
    driver.flush(50);
    expect(output.get()).toBe(5);

    crc(canvas, <Probe to={20} />);
    driver.flush(60);
    driver.flush(100);
    expect(output.get()).toBe(10);
    expect(handle.status.get()).toBe('finished');

    handle.play();
    driver.flush(110);
    driver.flush(160);
    expect(output.get()).toBe(15);
  });

  it('delivers active-run milestones through the latest successfully rendered callback', () => {
    const output = signal(0);
    const events: string[] = [];
    let handle!: CRCPlayback;
    function Probe({ callback }: { callback: string }) {
      handle = usePlayback(
        track(output, tween({ to: 10, duration: 100 })),
        { onEvent: event => events.push(`${callback}:${event.type}`) },
      );
    }

    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    roots.add(crc(canvas, <Probe callback="first" />));
    driver.flush(-10);
    handle.play();
    driver.flush(0);
    expect(events).toEqual(['first:start']);

    crc(canvas, <Probe callback="latest" />);
    driver.flush(50);
    driver.flush(100);
    expect(events).toEqual(['first:start', 'latest:finish']);
  });

  it('snapshots caller-owned options during render before transaction completion', () => {
    const output = signal(0);
    const events: string[] = [];
    const options = {
      onEvent: (event: Parameters<NonNullable<CRCPlaybackOptions['onEvent']>>[0]) =>
        events.push(`rendered:${event.type}`),
    };
    let handle!: CRCPlayback;
    function Probe() {
      handle = usePlayback(
        track(output, tween({ to: 10, duration: 100 })),
        options,
      );
      options.onEvent = event => events.push(`mutated:${event.type}`);
    }

    roots.add(mount(<Probe />));
    driver.flush(-1);
    handle.play();
    driver.flush(0);

    expect(events).toEqual(['rendered:start']);
  });

  it('does not adopt a program or callback from a failed root render transaction', () => {
    const output = signal(0);
    const events: string[] = [];
    let handle!: CRCPlayback;
    let owner!: CRCInternalRenderOwner;
    let failComposition = false;
    const workKey = {};
    function Probe({ to, callback }: { to: number; callback: string }) {
      handle = usePlayback(
        track(output, tween({ from: 0, to, duration: 100 })),
        { onEvent: event => events.push(`${callback}:${event.type}`) },
      );
      owner ??= crcInternalCurrentRenderOwner();
    }

    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    roots.add(crc(canvas, <Probe to={10} callback="first" />));
    driver.flush(0);
    crcInternalRequestRendererWork(owner, {
      key: workKey,
      kind: 'compose',
      run: () => {
        if (failComposition) throw new Error('expected composition failure');
      },
    });

    failComposition = true;
    crc(canvas, <Probe to={20} callback="failed" />);
    expect(() => driver.flush(10)).toThrow(/expected composition failure/iu);

    handle.play();
    expect(() => driver.flush(20)).toThrow(/expected composition failure/iu);
    expect(events).toEqual(['first:start']);

    failComposition = false;
    driver.flush(120);
    expect(output.get()).toBe(10);
    expect(events).toEqual(['first:start', 'failed:finish']);
  });

  for (const invalidCandidate of ['program', 'onEvent'] as const) {
    it(`fails closed during render for an update-time invalid ${invalidCandidate} candidate`, () => {
      const output = signal(0);
      const validProgram = track(
        output,
        tween({ from: 0, to: 10, duration: 100 }),
      );
      const beforePlayback = animationPlaybackSnapshot();
      const beforeLeases = writerLeaseSnapshot();
      const events: string[] = [];
      let handle!: CRCPlayback;
      function Probe({ invalid }: { invalid: boolean }) {
        const program = invalid && invalidCandidate === 'program' ?
          {} as CRCAnimationProgram : validProgram;
        const options = invalid && invalidCandidate === 'onEvent' ? {
          onEvent: 1 as unknown as CRCPlaybackOptions['onEvent'],
        } : {
          onEvent: (event: Parameters<
            NonNullable<CRCPlaybackOptions['onEvent']>
          >[0]) => events.push(event.type),
        };
        handle = usePlayback(program, options);
      }

      const canvas = document.createElement('canvas');
      document.body.appendChild(canvas);
      roots.add(crc(canvas, <Probe invalid={false} />));
      driver.flush(-1);
      handle.play();
      driver.flush(0);
      expect(events).toEqual(['start']);
      expect(animationPlaybackSnapshot().activePlaybacks)
        .toBe(beforePlayback.activePlaybacks + 1);
      expect(writerLeaseSnapshot().active).toBe(beforeLeases.active + 1);

      crc(canvas, <Probe invalid />);
      expect(() => driver.flush(10)).toThrow(
        invalidCandidate === 'program' ?
          /expected a CRC animation program/iu :
          /onEvent must be a function/iu,
      );

      expect(getCRCInstance(canvas).refs.size).toBe(0);
      expect(animationPlaybackSnapshot()).toMatchObject({
        activePlaybacks: beforePlayback.activePlaybacks,
        createdPlaybacks: beforePlayback.createdPlaybacks + 1,
        releasedPlaybacks: beforePlayback.releasedPlaybacks + 1,
        queuedCommands: 0,
        queuedMilestones: 0,
      });
      expect(writerLeaseSnapshot().active).toBe(beforeLeases.active);
      expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
      expect(driver.pendingHostFrames).toBe(1);

      driver.flush(11);
      expect(handle.status.get()).toBe('disposed');
      handle.play();
      handle.pause();
      handle.resume();
      handle.cancel();
      handle.finish();
      handle.seek(Number.POSITIVE_INFINITY);
      handle.reverse();
      handle.setPlaybackRate(0);
      expect(driver.pendingHostFrames).toBe(0);
      expect(events).toEqual(['start']);
    });
  }

  it('queues autoplay once after mount succeeds and never restarts for later program identities', () => {
    const output = signal(0);
    const events: string[] = [];
    let handle!: CRCPlayback;
    function Probe({ to }: { to: number }) {
      handle = usePlayback(track(output, tween({ to, duration: 100 })), {
        autoplay: true,
        onEvent: event => events.push(event.type),
      });
    }

    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    roots.add(crc(canvas, <Probe to={10} />));
    driver.flush(0);

    expect(handle.status.get()).toBe('idle');
    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(10);
    expect(handle.status.get()).toBe('running');
    expect(events).toEqual(['start']);

    crc(canvas, <Probe to={20} />);
    driver.flush(50);
    driver.flush(110);
    expect(handle.status.get()).toBe('finished');
    expect(events).toEqual(['start', 'finish']);
    expect(driver.pendingHostFrames).toBe(0);
  });

  it('waits for a failed mounting transaction to retry successfully before autoplay', () => {
    const output = signal(0);
    let handle!: CRCPlayback;
    let owner!: CRCInternalRenderOwner;
    let failComposition = false;
    const workKey = {};
    function Child() {
      handle = usePlayback(track(output, tween({ to: 10, duration: 100 })), {
        autoplay: true,
      });
    }
    function Root({ include }: { include: boolean }) {
      owner ??= crcInternalCurrentRenderOwner();
      return include ? <Child /> : undefined;
    }

    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    roots.add(crc(canvas, <Root include={false} />));
    driver.flush(0);
    crcInternalRequestRendererWork(owner, {
      key: workKey,
      kind: 'compose',
      run: () => {
        if (failComposition) throw new Error('mount transaction failed');
      },
    });

    failComposition = true;
    crc(canvas, <Root include />);
    expect(() => driver.flush(10)).toThrow(/mount transaction failed/iu);
    expect(handle.status.get()).toBe('idle');

    failComposition = false;
    driver.flush(20);
    expect(handle.status.get()).toBe('idle');
    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(30);
    expect(handle.status.get()).toBe('running');
  });

  it('does not treat a later autoplay option as a mount request', () => {
    const output = signal(0);
    let handle!: CRCPlayback;
    function Probe({ autoplay }: { autoplay: boolean }) {
      handle = usePlayback(track(output, tween({ to: 10, duration: 100 })), {
        autoplay,
      });
    }

    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    roots.add(crc(canvas, <Probe autoplay={false} />));
    driver.flush(0);
    expect(driver.pendingHostFrames).toBe(0);

    crc(canvas, <Probe autoplay />);
    driver.flush(10);
    expect(handle.status.get()).toBe('idle');
    expect(driver.pendingHostFrames).toBe(0);
  });

  for (const state of ['scheduled', 'running', 'paused'] as const) {
    it(`releases ${state} ownership on removal and leaves the saved handle inert`, () => {
      const output = signal(0);
      const beforePlayback = animationPlaybackSnapshot();
      const beforeLeases = writerLeaseSnapshot();
      let handle!: CRCPlayback;
      function Probe() {
        handle = usePlayback(track(output, tween({ to: 10, duration: 100 })));
      }

      const canvas = document.createElement('canvas');
      document.body.appendChild(canvas);
      roots.add(crc(canvas, <Probe />));
      driver.flush(0);
      handle.play();
      if (state !== 'scheduled') driver.flush(10);
      if (state === 'paused') {
        handle.pause();
        driver.flush(20);
      }

      crc(canvas, undefined);
      driver.flush(state === 'scheduled' ? 10 : 30);

      expect(animationPlaybackSnapshot()).toMatchObject({
        activePlaybacks: beforePlayback.activePlaybacks,
        createdPlaybacks: beforePlayback.createdPlaybacks + 1,
        releasedPlaybacks: beforePlayback.releasedPlaybacks + 1,
        queuedCommands: 0,
        queuedMilestones: 0,
      });
      expect(writerLeaseSnapshot().active).toBe(beforeLeases.active);
      expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);

      if (driver.pendingHostFrames > 0) driver.flush(31);
      expect(handle.status.get()).toBe('disposed');
      handle.play();
      handle.pause();
      handle.resume();
      handle.cancel();
      handle.finish();
      handle.seek(Number.POSITIVE_INFINITY);
      handle.reverse();
      handle.setPlaybackRate(0);
      expect(driver.pendingHostFrames).toBe(0);
    });
  }

  it('discards milestones queued before the owning component is removed in Render', () => {
    const events: string[] = [];
    const before = animationPlaybackSnapshot();
    let handle!: CRCPlayback;
    function Probe() {
      handle = usePlayback(sequence(wait(10), marker('removed')), {
        onEvent: event => events.push(event.marker ?? event.type),
      });
    }

    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    roots.add(crc(canvas, <Probe />));
    driver.flush(0);
    handle.play();
    driver.flush(10);
    expect(events).toEqual(['start']);
    events.length = 0;

    crc(canvas, undefined);
    driver.flush(20);

    expect(events).toEqual([]);
    expect(animationPlaybackSnapshot()).toMatchObject({
      activePlaybacks: before.activePlaybacks,
      createdPlaybacks: before.createdPlaybacks + 1,
      releasedPlaybacks: before.releasedPlaybacks + 1,
      queuedMilestones: 0,
    });
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
    driver.flush(21);
    expect(handle.status.get()).toBe('disposed');
  });

  it('publishes exact milestones after rendering their committed values', () => {
    const output = signal(0);
    const renders: Array<{
      frameId: number;
      logicalTime: number;
      output: number;
      currentTime: number;
      status: string;
    }> = [];
    const deliveries: Array<{
      event: Parameters<NonNullable<CRCPlaybackOptions['onEvent']>>[0];
      rendered: (typeof renders)[number];
    }> = [];
    let handle!: CRCPlayback;
    function Probe() {
      const playback = usePlayback(sequence(
        track(output, tween({ from: 0, to: 10, duration: 100 })),
        repeat(sequence(wait(50), marker('arrived'), wait(50)), {
          iterations: 2,
        }),
      ), {
        onEvent: event => deliveries.push({
          event,
          rendered: renders.at(-1)!,
        }),
      });
      handle = playback;
      const frame = crcInternalCurrentFrame();
      renders.push({
        frameId: frame.frameId,
        logicalTime: frame.logicalTime,
        output: output.get(),
        currentTime: playback.currentTime.get(),
        status: playback.status.get(),
      });
    }

    roots.add(mount(<Probe />));
    driver.flush(-1);
    handle.play();
    for (const time of [0, 100, 150, 200, 250, 300]) driver.flush(time);

    const renderedAt = (logicalTime: number) =>
      renders.findLast(render => render.logicalTime === logicalTime)!;
    expect(deliveries.map(({ event }) => event)).toEqual([
      {
        type: 'start',
        logicalTime: 0,
        frameId: renderedAt(0).frameId,
        programPath: [],
        iteration: 0,
      },
      {
        type: 'marker',
        logicalTime: 150,
        frameId: renderedAt(150).frameId,
        programPath: [1, 0, 1],
        iteration: 0,
        marker: 'arrived',
      },
      {
        type: 'iteration',
        logicalTime: 200,
        frameId: renderedAt(200).frameId,
        programPath: [1],
        iteration: 1,
      },
      {
        type: 'marker',
        logicalTime: 250,
        frameId: renderedAt(250).frameId,
        programPath: [1, 0, 1],
        iteration: 1,
        marker: 'arrived',
      },
      {
        type: 'finish',
        logicalTime: 300,
        frameId: renderedAt(300).frameId,
        programPath: [],
        iteration: 0,
      },
    ]);
    expect(deliveries.map(({ rendered }) => ({
      logicalTime: rendered.logicalTime,
      output: rendered.output,
      currentTime: rendered.currentTime,
      status: rendered.status,
    }))).toEqual([
      { logicalTime: 0, output: 0, currentTime: 0, status: 'running' },
      { logicalTime: 150, output: 10, currentTime: 150, status: 'running' },
      { logicalTime: 200, output: 10, currentTime: 200, status: 'running' },
      { logicalTime: 250, output: 10, currentTime: 250, status: 'running' },
      { logicalTime: 300, output: 10, currentTime: 300, status: 'finished' },
    ]);
    expect(deliveries.every(({ event }) =>
      Object.isFrozen(event) && Object.isFrozen(event.programPath),
    )).toBe(true);
  });

  it('orders same-time source milestones within playback registration order', () => {
    const events: string[] = [];
    let first!: CRCPlayback;
    let second!: CRCPlayback;
    function Probe() {
      first = usePlayback(sequence(
        wait(10),
        marker('first-a'),
        marker('first-b'),
      ), { onEvent: event => events.push(event.marker ?? `first:${event.type}`) });
      second = usePlayback(sequence(
        wait(10),
        marker('second-a'),
        marker('second-b'),
      ), { onEvent: event => events.push(event.marker ?? `second:${event.type}`) });
    }

    roots.add(mount(<Probe />));
    driver.flush(-1);
    first.play();
    second.play();
    driver.flush(0);
    events.length = 0;
    driver.flush(10);

    expect(events).toEqual([
      'first-a',
      'first-b',
      'first:finish',
      'second-a',
      'second-b',
      'second:finish',
    ]);
  });

  it('defers signal writes and playback commands from milestone handlers', () => {
    const output = signal(0);
    const handlerWrite = signal(0);
    const renders: Array<{ output: number; handlerWrite: number; status: string }> = [];
    const callbackSnapshots: typeof renders = [];
    let handle!: CRCPlayback;
    function Probe() {
      const playback = usePlayback(
        track(output, tween({ from: 0, to: 10, duration: 100 })),
        { onEvent: event => {
          if (event.type !== 'start') return;
          callbackSnapshots.push(renders.at(-1)!);
          handlerWrite.set(1);
          playback.pause();
        } },
      );
      handle = playback;
      renders.push({
        output: output.get(),
        handlerWrite: handlerWrite.get(),
        status: playback.status.get(),
      });
    }

    roots.add(mount(<Probe />));
    driver.flush(-1);
    handle.play();
    driver.flush(0);

    expect(callbackSnapshots).toEqual([
      { output: 0, handlerWrite: 0, status: 'running' },
    ]);
    expect(renders.at(-1)).toEqual({
      output: 0,
      handlerWrite: 0,
      status: 'running',
    });
    expect(driver.pendingHostFrames).toBe(1);

    driver.flush(1);
    expect(renders.at(-1)).toEqual({
      output: 0,
      handlerWrite: 1,
      status: 'paused',
    });
  });

  it('discards every staged write from a failing sampler and keeps unrelated roots running', () => {
    const firstFailedOutput = signal(0);
    const secondFailedOutput = signal(0);
    const healthyOutput = signal(0);
    const errors: unknown[] = [];
    const healthyRenders: number[] = [];
    let failed!: CRCPlayback;
    let healthy!: CRCPlayback;
    function FailingRoot() {
      failed = usePlayback(parallel(
        track(firstFailedOutput, defineAnimation({
          duration: 100,
          sample: ({ localTime }) => localTime + 1,
        })),
        track(secondFailedOutput, defineAnimation({
          duration: 100,
          sample: ({ localTime }) => {
            if (localTime >= 10) throw new Error('sampler exploded');
            return 1;
          },
        })),
      ), { onError: error => errors.push(error) });
      firstFailedOutput.get();
      secondFailedOutput.get();
      failed.status.get();
    }
    function HealthyRoot() {
      healthy = usePlayback(
        track(healthyOutput, tween({ from: 0, to: 10, duration: 100 })),
      );
      healthyRenders.push(healthyOutput.get());
      healthy.status.get();
    }

    roots.add(mount(<FailingRoot />));
    roots.add(mount(<HealthyRoot />));
    driver.flush(-1);
    failed.play();
    healthy.play();
    driver.flush(0);
    expect([firstFailedOutput.get(), secondFailedOutput.get()]).toEqual([1, 1]);

    driver.flush(10);

    expect([firstFailedOutput.get(), secondFailedOutput.get()]).toEqual([1, 1]);
    expect(failed.status.get()).toBe('cancelled');
    expect(healthy.status.get()).toBe('running');
    expect(healthyOutput.get()).toBe(1);
    expect(healthyRenders.at(-1)).toBe(1);
    expect((errors[0] as Error).message).toMatch(/sampler exploded/iu);
  });

  it('continues later milestones and playbacks before reporting an onEvent failure', () => {
    const events: string[] = [];
    let failing!: CRCPlayback;
    let healthy!: CRCPlayback;
    function Probe() {
      failing = usePlayback(sequence(
        wait(10),
        marker('first'),
        marker('later'),
      ), { onEvent: event => {
        events.push(`failing:${event.marker ?? event.type}`);
        if (event.marker === 'first') throw new Error('onEvent exploded');
      } });
      healthy = usePlayback(sequence(wait(10), marker('healthy')), {
        onEvent: event => events.push(`healthy:${event.marker ?? event.type}`),
      });
    }

    roots.add(mount(<Probe />));
    driver.flush(-1);
    failing.play();
    healthy.play();
    driver.flush(0);
    events.length = 0;

    expect(() => driver.flush(10)).toThrow(/onEvent exploded/iu);
    expect(events).toEqual([
      'failing:first',
      'failing:later',
      'failing:finish',
      'healthy:healthy',
      'healthy:finish',
    ]);
    expect(failing.status.get()).toBe('finished');
    expect(healthy.status.get()).toBe('finished');
    expect(snapshotRealmScheduler().phase).toBe('idle');
  });

  it('finishes cancellation and unrelated Complete work before reporting an onError failure', () => {
    const events: string[] = [];
    const failedOutput = signal(0);
    let failing!: CRCPlayback;
    let healthy!: CRCPlayback;
    function Probe() {
      failing = usePlayback(track(failedOutput, defineAnimation({
        duration: 100,
        sample: ({ localTime }) => {
          if (localTime >= 10) throw new Error('definition exploded');
          return 1;
        },
      })), {
        onEvent: event => events.push(`failing:${event.type}`),
        onError: error => {
          events.push(`onError:${(error as Error).message}`);
          throw new Error('onError exploded');
        },
      });
      healthy = usePlayback(sequence(wait(10), marker('healthy')), {
        onEvent: event => events.push(`healthy:${event.marker ?? event.type}`),
      });
    }

    roots.add(mount(<Probe />));
    driver.flush(-1);
    failing.play();
    healthy.play();
    driver.flush(0);
    events.length = 0;

    expect(() => driver.flush(10)).toThrow(/onError exploded/iu);
    expect(events).toEqual([
      'failing:cancel',
      'onError:definition exploded',
      'healthy:healthy',
      'healthy:finish',
    ]);
    expect(failing.status.get()).toBe('cancelled');
    expect(healthy.status.get()).toBe('finished');
    expect(writerLeaseSnapshot().active).toBe(0);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
  });
});

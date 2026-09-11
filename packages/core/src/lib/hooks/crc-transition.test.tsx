import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import {
  crcInternalCurrentRenderOwner,
  crcInternalRequestRendererWork,
  type CRCInternalRenderOwner,
} from '@crc/core/internal';
import {
  crc,
  crcTransition,
  signal,
  type Signal,
} from '../../index.js';
import { animationPlaybackSnapshot } from '../animation/playback.js';
import { createSpringRecord, sampleSpring } from '../animation/spring.js';
import { executeRender } from '../execute-render.js';
import { clearSharedState, getCRCInstance } from '../global-state.js';
import { signalGraphSnapshot } from '../signals/graph.js';
import { writerLeaseSnapshot } from '../animation/writer-leases.js';
import {
  installSchedulerDriverForTest,
  installSchedulerTraceCollectorForTest,
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

function mount(node: Parameters<typeof crc>[1]): {
  readonly canvas: HTMLCanvasElement;
  readonly controller: ReturnType<typeof crc>;
} {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const controller = crc(canvas, node);
  roots.add(controller);
  return { canvas, controller };
}

describe('crcTransition mount behavior', () => {
  it('presents an omitted initial target with stable readonly identity and no entrance work', () => {
    const values: number[] = [];
    const outputs: Signal<number>[] = [];
    function Probe({ target }: { target: number }) {
      const output = crcTransition(target, { type: 'tween', duration: 100 });
      outputs.push(output);
      values.push(output.get());
    }

    const beforePlaybacks = animationPlaybackSnapshot();
    const beforeLeases = writerLeaseSnapshot();
    const { canvas } = mount(<Probe target={10} />);
    driver.flush(0);

    expect(values).toEqual([10]);
    expect('set' in outputs[0]).toBe(false);
    expect(driver.pendingHostFrames).toBe(0);
    expect(animationPlaybackSnapshot()).toEqual(beforePlaybacks);
    expect(writerLeaseSnapshot()).toEqual(beforeLeases);

    crc(canvas, <Probe target={10} />);
    driver.flush(1);
    expect(outputs[1]).toBe(outputs[0]);
    expect(values).toEqual([10, 10]);
    expect(driver.pendingHostFrames).toBe(0);
  });

  it('presents an explicit initial value and queues entrance only after mount succeeds', () => {
    const values: number[] = [];
    let output!: Signal<number>;
    function Probe() {
      output = crcTransition(10, {
        type: 'tween',
        duration: 100,
        initial: 0,
      });
      values.push(output.get());
    }

    mount(<Probe />);
    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(0);

    expect(values).toEqual([0]);
    expect(output.get()).toBe(0);
    expect(driver.pendingHostFrames).toBe(1);
    expect(animationPlaybackSnapshot().activePlaybacks).toBe(0);
    expect(writerLeaseSnapshot().active).toBe(0);

    driver.flush(10);
    expect(animationPlaybackSnapshot().activePlaybacks).toBe(1);
    expect(writerLeaseSnapshot().active).toBe(1);
    expect(output.get()).toBe(0);
  });

  it('uses configured equality for the initial and later target comparisons', () => {
    const beforePlaybacks = animationPlaybackSnapshot();
    let output!: Signal<number>;
    function Probe({ target }: { target: number }) {
      output = crcTransition(target, {
        type: 'tween',
        duration: 100,
        initial: 1.2,
        equals: (previous, next) => Math.floor(previous) === Math.floor(next),
      });
      output.get();
    }

    const { canvas } = mount(<Probe target={1.8} />);
    driver.flush(0);
    expect(output.get()).toBe(1.2);
    expect(driver.pendingHostFrames).toBe(0);

    crc(canvas, <Probe target={1.9} />);
    driver.flush(10);
    expect(output.get()).toBe(1.2);
    expect(driver.pendingHostFrames).toBe(0);
    expect(animationPlaybackSnapshot().createdPlaybacks)
      .toBe(beforePlaybacks.createdPlaybacks);
  });
});

describe('crcTransition retargeting', () => {
  it('restarts a tween at full duration from the last committed presented value', () => {
    let output!: Signal<number>;
    function Probe({ target }: { target: number }) {
      output = crcTransition(target, {
        type: 'tween',
        duration: 100,
        initial: 0,
      });
      output.get();
    }

    const { canvas } = mount(<Probe target={10} />);
    driver.flush(0);
    driver.flush(10);
    driver.flush(60);
    expect(output.get()).toBe(5);

    crc(canvas, <Probe target={20} />);
    driver.flush(70);
    expect(output.get()).toBe(6);
    driver.flush(80);
    expect(output.get()).toBe(6);
    driver.flush(130);

    expect(output.get()).toBe(13);
  });

  it('coalesces successful target changes before Begin to one latest retarget', () => {
    let output!: Signal<number>;
    function Probe({ target }: { target: number }) {
      output = crcTransition(target, { type: 'tween', duration: 100 });
      output.get();
    }

    const { canvas } = mount(<Probe target={0} />);
    driver.flush(0);
    executeRender(canvas, 1, <Probe target={10} />);
    executeRender(canvas, 2, <Probe target={20} />);
    executeRender(canvas, 3, <Probe target={30} />);

    expect(snapshotRealmScheduler().queuedBeginCommands).toBe(1);
    expect(animationPlaybackSnapshot().queuedCommands).toBe(1);
    driver.flush(10);
    expect(output.get()).toBe(0);
    driver.flush(60);
    expect(output.get()).toBe(15);
  });

  it('validates changed options during render even when the target is equal', () => {
    function Probe({ duration }: { duration: number }) {
      crcTransition(10, { type: 'tween', duration }).get();
    }

    const { canvas } = mount(<Probe duration={100} />);
    driver.flush(0);
    crc(canvas, <Probe duration={Number.NaN} />);

    expect(() => driver.flush(10)).toThrow(/duration must be finite/iu);
    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(11);
    expect(snapshotRealmScheduler().queuedBeginCommands).toBe(0);
    expect(animationPlaybackSnapshot().activePlaybacks).toBe(0);
    expect(writerLeaseSnapshot().active).toBe(0);
  });

  it('carries the last committed analytic spring velocity into a retarget', () => {
    const springOptions = {
      type: 'spring' as const,
      stiffness: 100,
      damping: 1,
      restSpeed: 0.001,
      restDelta: 0.001,
      maxDuration: 2_000,
      initial: 0,
    };
    let output!: Signal<number>;
    function Probe({ target }: { target: number }) {
      output = crcTransition(target, springOptions);
      output.get();
    }

    const { canvas } = mount(<Probe target={100} />);
    driver.flush(0);
    driver.flush(10);
    driver.flush(110);
    crc(canvas, <Probe target={0} />);
    driver.flush(120);
    const committed = output.get();
    driver.flush(130);
    driver.flush(140);

    const zeroVelocity = sampleSpring(createSpringRecord({
      from: committed,
      to: 0,
      stiffness: springOptions.stiffness,
      damping: springOptions.damping,
      restSpeed: springOptions.restSpeed,
      restDelta: springOptions.restDelta,
      maxDuration: springOptions.maxDuration,
      initialVelocity: 0,
    }), 0.01).position;
    expect(zeroVelocity).toBeLessThan(committed);
    expect(output.get()).toBeGreaterThan(committed);
    expect(output.get()).toBeGreaterThan(zeroVelocity);
  });

  it('uses successful option-only changes for the next target without restarting early', () => {
    let output!: Signal<number>;
    function Probe({ duration, target }: { duration: number; target: number }) {
      output = crcTransition(target, { type: 'tween', duration });
      output.get();
    }

    const { canvas } = mount(<Probe duration={100} target={0} />);
    driver.flush(0);
    executeRender(canvas, 1, <Probe duration={200} target={0} />);
    expect(driver.pendingHostFrames).toBe(0);
    executeRender(canvas, 2, <Probe duration={200} target={20} />);
    expect(snapshotRealmScheduler().queuedBeginCommands).toBe(1);

    driver.flush(10);
    driver.flush(110);
    expect(output.get()).toBe(10);
  });

  it('adopts an option-only debug name for active-run diagnostics without restarting', () => {
    const sampleNames: Array<string | undefined> = [];
    const restoreTrace = installSchedulerTraceCollectorForTest(record => {
      if (record.kind === 'animation-sample') sampleNames.push(record.debugName);
    });
    function Probe({ debugName }: { debugName: string }) {
      crcTransition(10, {
        type: 'tween',
        duration: 100,
        initial: 0,
        debugName,
      }).get();
    }

    try {
      const { canvas } = mount(<Probe debugName="first" />);
      driver.flush(0);
      driver.flush(10);
      sampleNames.length = 0;
      crc(canvas, <Probe debugName="latest" />);
      driver.flush(20);
      sampleNames.length = 0;
      driver.flush(30);

      expect(sampleNames).toEqual(['latest']);
      expect(animationPlaybackSnapshot().createdPlaybacks).toBeGreaterThan(0);
    } finally {
      restoreTrace();
    }
  });

  it('adopts no target from a failed shared root transaction', () => {
    let output!: Signal<number>;
    let owner!: CRCInternalRenderOwner;
    let failComposition = false;
    const workKey = {};
    function Probe({ target }: { target: number }) {
      output = crcTransition(target, { type: 'tween', duration: 100 });
      output.get();
      owner ??= crcInternalCurrentRenderOwner();
    }

    const { canvas } = mount(<Probe target={0} />);
    driver.flush(0);
    crcInternalRequestRendererWork(owner, {
      key: workKey,
      kind: 'compose',
      run: () => {
        if (failComposition) throw new Error('expected composition failure');
      },
    });

    failComposition = true;
    crc(canvas, <Probe target={10} />);
    expect(() => driver.flush(10)).toThrow(/expected composition failure/iu);
    expect(output.get()).toBe(0);
    expect(animationPlaybackSnapshot().queuedCommands).toBe(0);

    failComposition = false;
    crc(canvas, <Probe target={0} />);
    driver.flush(20);
    expect(output.get()).toBe(0);
    expect(driver.pendingHostFrames).toBe(0);
    expect(animationPlaybackSnapshot().activePlaybacks).toBe(0);
  });

  it('evaluates throwing target equality during Render and fails closed once', () => {
    const failure = new Error('transition equality failed');
    let equalityCalls = 0;
    let output!: Signal<number>;
    function Probe({ fail, target }: { fail: boolean; target: number }) {
      output = crcTransition(target, {
        type: 'tween',
        duration: 100,
        equals: fail ? () => {
          equalityCalls++;
          throw failure;
        } : Object.is,
      });
      output.get();
    }

    const { canvas } = mount(<Probe fail={false} target={0} />);
    driver.flush(0);
    const staleOutput = output;
    crc(canvas, <Probe fail target={10} />);

    expect(() => driver.flush(10)).toThrow(failure);
    expect(equalityCalls).toBe(1);
    expect(getCRCInstance(canvas).refs.size).toBe(0);
    expect(animationPlaybackSnapshot().activePlaybacks).toBe(0);
    expect(animationPlaybackSnapshot().queuedCommands).toBe(0);
    expect(writerLeaseSnapshot().active).toBe(0);
    driver.flush(11);
    expect(staleOutput.get()).toBe(0);
    expect(equalityCalls).toBe(1);
    expect(driver.pendingHostFrames).toBe(0);
  });

  it('runs target equality under the Render signal-write guard', () => {
    const external = signal(0);
    function Probe({ target, write }: { target: number; write: boolean }) {
      crcTransition(target, {
        type: 'tween',
        duration: 100,
        equals: write ? () => {
          external.set(1);
          return false;
        } : Object.is,
      }).get();
    }

    const { canvas } = mount(<Probe target={0} write={false} />);
    driver.flush(0);
    crc(canvas, <Probe target={10} write />);

    expect(() => driver.flush(10)).toThrow('CRC render');
    expect(external.get()).toBe(0);
    expect(getCRCInstance(canvas).refs.size).toBe(0);
    driver.flush(11);
  });

  it('keeps one signal identity across failed omitted and explicit initial mount retries', () => {
    let owner!: CRCInternalRenderOwner;
    let failComposition = false;
    const values: number[] = [];
    const outputs: Signal<number>[] = [];
    const workKey = {};
    function Child({ initial, target }: { initial?: number; target: number }) {
      const output = initial === undefined ?
        crcTransition(target, { type: 'tween', duration: 100 }) :
        crcTransition(target, { type: 'tween', duration: 100, initial });
      outputs.push(output);
      values.push(output.get());
    }
    function Root({
      include,
      initial,
      target,
    }: { include: boolean; initial?: number; target: number }) {
      owner ??= crcInternalCurrentRenderOwner();
      return include ? <Child initial={initial} target={target} /> : undefined;
    }

    const { canvas } = mount(<Root include={false} target={0} />);
    driver.flush(0);
    crcInternalRequestRendererWork(owner, {
      key: workKey,
      kind: 'compose',
      run: () => {
        if (failComposition) throw new Error('mount transaction failed');
      },
    });

    failComposition = true;
    crc(canvas, <Root include target={10} />);
    expect(() => driver.flush(10)).toThrow(/mount transaction failed/iu);
    crc(canvas, <Root include initial={3} target={20} />);
    expect(() => driver.flush(20)).toThrow(/mount transaction failed/iu);
    failComposition = false;
    crc(canvas, <Root include target={30} />);
    driver.flush(30);

    expect(values).toEqual([10, 3, 30]);
    expect(outputs[1]).toBe(outputs[0]);
    expect(outputs[2]).toBe(outputs[0]);
    expect(animationPlaybackSnapshot().activePlaybacks).toBe(0);
    expect(animationPlaybackSnapshot().queuedCommands).toBe(0);
    expect(writerLeaseSnapshot().active).toBe(0);
    expect(driver.pendingHostFrames).toBe(0);
  });
});

describe('crcTransition public types and lifecycle', () => {
  it('returns readonly signals, keeps spring numeric, and supports generic tween interpolation', () => {
    const tweenTransition = () => crcTransition(
      { x: 10 },
      {
        type: 'tween',
        duration: 100,
        initial: { x: 0 },
        interpolate: (from, to, progress) => ({
          x: from.x + (to.x - from.x) * progress,
        }),
      },
    );
    const springTransition = () => crcTransition(10, { type: 'spring' });

    expectTypeOf(tweenTransition).returns.toEqualTypeOf<Signal<{ x: number }>>();
    expectTypeOf(springTransition).returns.toEqualTypeOf<Signal<number>>();
    const invalidTypeExamples = () => {
      // @ts-expect-error spring transitions accept only numeric targets
      crcTransition('ten', { type: 'spring' });
      const readonly = crcTransition(1, { type: 'spring' });
      // @ts-expect-error transition outputs deliberately expose no write method
      readonly.set(2);
    };
    expectTypeOf(invalidTypeExamples).toBeFunction();
  });

  for (const state of ['queued', 'running'] as const) {
    it(`releases ${state} transition work and leaves a saved signal inert`, () => {
      const beforePlayback = animationPlaybackSnapshot();
      const beforeLeases = writerLeaseSnapshot();
      const beforeGraph = signalGraphSnapshot();
      let output!: Signal<number>;
      function Probe() {
        output = crcTransition(10, {
          type: 'tween',
          duration: 100,
          initial: 0,
        });
        output.get();
      }

      const { canvas } = mount(<Probe />);
      driver.flush(0);
      if (state === 'queued') {
        executeRender(canvas, 1, undefined);
      } else {
        driver.flush(10);
        crc(canvas, undefined);
        driver.flush(20);
      }
      if (driver.pendingHostFrames > 0) driver.flush(21);
      const retained = output.get();

      expect(animationPlaybackSnapshot()).toMatchObject({
        activePlaybacks: beforePlayback.activePlaybacks,
        queuedCommands: 0,
        queuedMilestones: 0,
      });
      expect(writerLeaseSnapshot().active).toBe(beforeLeases.active);
      expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
      expect(signalGraphSnapshot()).toMatchObject({
        rendererConsumers: beforeGraph.rendererConsumers,
        rendererEdges: beforeGraph.rendererEdges,
      });
      expect(output.get()).toBe(retained);
      expect(driver.pendingHostFrames).toBe(0);
    });
  }
});

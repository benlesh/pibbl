import { describe, expect, it } from 'vitest';
import {
  parallel,
  sequence,
  repeat,
  marker,
  signal,
  stepper,
  track,
  wait,
} from '../../index';
import { createSignalCommitBatch } from '../signals/graph';
import {
  activateProgram,
  evaluateProgram,
  finishProgram,
  getProgramActivationRecord,
  releaseProgramActivation,
  seekProgram,
  type ProgramActivation,
  type ProgramEvaluationResult,
} from './evaluate';

const writer = Object.freeze({ name: 'stepper test writer' });

function advance(
  activation: ProgramActivation,
  previousTime: number | undefined,
  time: number,
  frameId: number,
): ProgramEvaluationResult {
  return evaluateProgram(activation, {
    previousTime,
    time,
    direction: 'forward',
    frameId,
    writer,
    batch: createSignalCommitBatch(),
  });
}

function seek(
  activation: ProgramActivation,
  previousTime: number | undefined,
  time: number,
  direction: 'forward' | 'reverse',
  frameId: number,
): ProgramEvaluationResult {
  return seekProgram(activation, {
    previousTime,
    time,
    direction,
    frameId,
    writer,
    batch: createSignalCommitBatch(),
  });
}

describe('stateful fixed-step animation evaluation', () => {
  it('clamps each host contribution, retains its remainder, and reads once after whole steps', () => {
    const output = signal({ position: 0, velocity: 1 });
    const stepCounts: number[] = [];
    let reads = 0;
    const program = track(output, stepper({
      stepMilliseconds: 10,
      maxElapsedMilliseconds: 100,
      initial: (current: { position: number; velocity: number }) => current,
      step: state => {
        stepCounts.push(1);
        return {
          position: state.position + state.velocity * 10,
          velocity: state.velocity,
        };
      },
      read: state => {
        reads++;
        return state;
      },
    }));
    const activation = activateProgram(program, {});
    const frames = [
      { previous: 0, time: 6, steps: 0, remainder: 6, clamped: 6, discarded: 0 },
      { previous: 6, time: 15, steps: 1, remainder: 5, clamped: 9, discarded: 0 },
      { previous: 15, time: 50, steps: 4, remainder: 0, clamped: 35, discarded: 0 },
      { previous: 50, time: 300, steps: 10, remainder: 0, clamped: 100, discarded: 150 },
    ];

    for (const [index, frame] of frames.entries()) {
      const result = advance(activation, frame.previous, frame.time, index + 1);
      expect(result.steppers).toEqual([expect.objectContaining({
        appliedSteps: frame.steps,
        retainedRemainderMilliseconds: frame.remainder,
        clampedElapsedMilliseconds: frame.clamped,
        discardedElapsedMilliseconds: frame.discarded,
      })]);
      expect(Object.isFrozen(result.steppers)).toBe(true);
      expect(Object.isFrozen(result.steppers[0])).toBe(true);
    }

    expect(stepCounts).toHaveLength(15);
    expect(reads).toBe(4);
    expect(getProgramActivationRecord(activation).activeSteppers).toEqual([
      expect.objectContaining({
        wholeSteps: 15,
        retainedRemainderMilliseconds: 0,
        appliedElapsedMilliseconds: 150,
        discardedElapsedMilliseconds: 150,
      }),
    ]);
  });

  it('owns one activation state per run and initializes once per active track instance', () => {
    const output = signal(0);
    let initials = 0;
    const definition = stepper({
      stepMilliseconds: 10,
      initial: (current: number) => {
        initials++;
        return { value: current };
      },
      step: state => ({ value: state.value + 1 }),
      read: state => state.value,
    });
    const program = track(output, definition);
    const first = activateProgram(program, {});
    const second = activateProgram(program, {});

    expect(advance(first, 0, 20, 1).batch.read(output)).toBe(2);
    expect(advance(second, 0, 10, 2).batch.read(output)).toBe(1);
    expect(advance(first, 20, 30, 3).batch.read(output)).toBe(3);
    expect(initials).toBe(2);
    expect(getProgramActivationRecord(first).activeSteppers[0]?.wholeSteps).toBe(3);
    expect(getProgramActivationRecord(second).activeSteppers[0]?.wholeSteps).toBe(1);
  });

  it('discovers done at an exact step and releases permanently completed state', () => {
    const output = signal(0);
    let reads = 0;
    const program = sequence(
      track(output, stepper({
        stepMilliseconds: 10,
        initial: (current: number) => current,
        step: state => state + 1,
        read: state => {
          reads++;
          return state;
        },
        done: state => state === 3,
      })),
      wait(20),
    );
    const activation = activateProgram(program, {});

    const result = advance(activation, 0, 50, 1);

    expect(result.batch.read(output)).toBe(3);
    expect(result.terminal).toEqual({
      duration: 50,
      atStart: false,
      atEnd: true,
      reached: true,
    });
    expect(result.steppers).toEqual([expect.objectContaining({
      appliedSteps: 3,
      terminal: { step: 3, time: 30 },
    })]);
    expect(reads).toBe(1);
    expect(getProgramActivationRecord(activation).activeSteppers).toEqual([]);
    expect(getProgramActivationRecord(activation).terminalSteppers).toEqual([]);
    expect(getProgramActivationRecord(activation).terminalDuration).toBe(50);
  });

  it('keys repeated state by immutable path and occurrence and releases every terminal record', () => {
    const output = signal(0);
    let initials = 0;
    const program = repeat(track(output, stepper({
      stepMilliseconds: 10,
      initial: (current: number) => {
        initials++;
        return { value: current, steps: 0 };
      },
      step: state => ({ value: state.value + 1, steps: state.steps + 1 }),
      read: state => state.value,
      done: state => state.steps === 1,
    })), { iterations: 2 });
    const activation = activateProgram(program, {});

    const result = advance(activation, 0, 20, 1);

    expect(result.batch.read(output)).toBe(2);
    expect(initials).toBe(2);
    const record = getProgramActivationRecord(activation);
    expect(record.activeSteppers).toEqual([]);
    expect(record.terminalSteppers).toEqual([]);
    expect(record.terminalDuration).toBe(20);
  });

  it.each(['initial', 'step', 'read', 'done'] as const)(
    'guards and contextually cancels a run when %s fails',
    callbackName => {
      const output = signal(0, { debugName: 'position' });
      const sideEffect = signal(0);
      let shouldFail = callbackName !== 'step';
      function invoke<T>(name: typeof callbackName, value: T): T {
        if (name === callbackName && shouldFail) {
          sideEffect.set(1);
        }
        return value;
      }
      const program = track(output, stepper({
        debugName: 'dangerous integration',
        stepMilliseconds: 10,
        initial: (current: number) => invoke('initial', current),
        step: state => invoke('step', state + 1),
        read: state => invoke('read', state),
        done: state => invoke('done', state >= 10),
      }));
      const activation = activateProgram(program, {});
      if (callbackName === 'step') {
        advance(activation, 0, 0, 1);
        shouldFail = true;
      }
      const batch = createSignalCommitBatch();
      const callerWriter = {};
      batch.stage(output, 99, callerWriter);

      expect(() => evaluateProgram(activation, {
        previousTime: 0,
        time: 10,
        direction: 'forward',
        frameId: 2,
        writer,
        batch,
      })).toThrow(new RegExp(
        `stepper.*dangerous integration.*${callbackName}.*path.*\\[\\].*frame 2.*local time`,
        'iu',
      ));

      expect(sideEffect.get()).toBe(0);
      expect(output.get()).toBe(0);
      expect(batch.read(output)).toBe(99);
      expect(getProgramActivationRecord(activation).activeSteppers).toEqual([]);
    },
  );

  it('releases every state and invalidates the activation when its run is released', () => {
    const output = signal(0);
    const activation = activateProgram(track(output, stepper({
      stepMilliseconds: 10,
      initial: (current: number) => current,
      step: state => state + 1,
      read: state => state,
    })), {});
    advance(activation, 0, 10, 1);
    expect(getProgramActivationRecord(activation).activeSteppers).toHaveLength(1);

    releaseProgramActivation(activation);

    expect(() => getProgramActivationRecord(activation)).toThrow('activation');
    expect(() => advance(activation, 10, 20, 2)).toThrow('activation');
  });

  it.each([
    {
      name: 'an infinite quotient',
      stepMilliseconds: Number.MIN_VALUE,
      elapsed: 1,
    },
    {
      name: 'a finite unsafe-integer quotient',
      stepMilliseconds: 1,
      elapsed: Number.MAX_SAFE_INTEGER + 1,
    },
  ])('rejects $name transactionally before advance or seek stepping', ({
    stepMilliseconds,
    elapsed,
  }) => {
    for (const mode of ['advance', 'seek'] as const) {
      const output = signal(0);
      let steps = 0;
      let reads = 0;
      const definition = stepper({
        debugName: 'unsafe quotient',
        stepMilliseconds,
        maxElapsedMilliseconds: elapsed,
        initial: (current: number) => current,
        step: state => {
          steps++;
          return state + 1;
        },
        read: state => {
          reads++;
          return state;
        },
        done: state => state === 1,
      });
      const activation = activateProgram(track(output, definition), {});
      const batch = createSignalCommitBatch();
      const callerWriter = {};
      batch.stage(output, 99, callerWriter);
      const evaluate = mode === 'advance' ? evaluateProgram : seekProgram;

      expect(() => evaluate(activation, {
        previousTime: 0,
        time: elapsed,
        direction: 'forward',
        frameId: 7,
        writer,
        batch,
      })).toThrow(/stepper.*unsafe quotient.*whole-step count.*safe.*path.*frame 7/iu);

      expect(steps).toBe(0);
      expect(reads).toBe(0);
      expect(output.get()).toBe(0);
      expect(batch.read(output)).toBe(99);
      expect(getProgramActivationRecord(activation).activeSteppers).toEqual([]);
      expect(getProgramActivationRecord(activation).terminalSteppers).toEqual([]);
    }
  });

  it('keeps infinite normal-repeat state, terminal facts, traces, and work bounded', () => {
    const output = signal(0);
    let steps = 0;
    const activation = activateProgram(repeat(track(output, stepper({
      stepMilliseconds: 10,
      initial: (current: number) => ({ value: current, steps: 0 }),
      step: state => {
        steps++;
        return { value: state.value + 1, steps: state.steps + 1 };
      },
      read: state => state.value,
      done: state => state.steps === 1,
    })), { iterations: Number.POSITIVE_INFINITY }), {});

    for (let frame = 1; frame <= 100; frame++) {
      const beforeSteps = steps;
      const result = advance(activation, (frame - 1) * 10, frame * 10, frame);
      const snapshot = getProgramActivationRecord(activation);
      expect(result.batch.read(output)).toBe(frame);
      expect(steps - beforeSteps).toBeLessThanOrEqual(1);
      expect(result.steppers.length).toBeLessThanOrEqual(2);
      expect(snapshot.activeSteppers.length).toBeLessThanOrEqual(1);
      expect(snapshot.terminalSteppers.length).toBeLessThanOrEqual(1);
    }
  });

  it('shares one clamped contribution across repeated occurrences of one track path', () => {
    const output = signal(0);
    let steps = 0;
    const activation = activateProgram(repeat(track(output, stepper({
      stepMilliseconds: 10,
      maxElapsedMilliseconds: 100,
      initial: (current: number) => ({ value: current, steps: 0 }),
      step: state => {
        steps++;
        return { value: state.value + 1, steps: state.steps + 1 };
      },
      read: state => state.value,
      done: state => state.steps === 1,
    })), { iterations: Number.POSITIVE_INFINITY }), {});

    const result = advance(activation, 0, 10_000, 1);

    expect(steps).toBe(10);
    expect(result.batch.read(output)).toBe(10);
    expect(result.steppers.length).toBeLessThanOrEqual(11);
    expect(result.steppers.reduce(
      (total, trace) => total + trace.clampedElapsedMilliseconds,
      0,
    )).toBe(100);
    expect(result.steppers.reduce(
      (total, trace) => total + trace.discardedElapsedMilliseconds,
      0,
    )).toBe(9_900);
    expect(result.steppers.filter(
      trace => trace.discardedElapsedMilliseconds > 0,
    )).toHaveLength(1);
    expect(getProgramActivationRecord(activation).activeSteppers).toHaveLength(1);
    expect(getProgramActivationRecord(activation).terminalSteppers).toEqual([]);
  });

  it('bounds nested finite repeat crossings by the shared track-path budget', () => {
    const output = signal(0);
    let steps = 0;
    const definition = stepper({
      stepMilliseconds: 10,
      maxElapsedMilliseconds: 100,
      initial: (current: number) => ({ value: current, steps: 0 }),
      step: state => {
        steps++;
        return { value: state.value + 1, steps: state.steps + 1 };
      },
      read: state => state.value,
      done: state => state.steps === 1,
    });
    const activation = activateProgram(repeat(
      repeat(track(output, definition), { iterations: 2 }),
      { iterations: 20 },
    ), {});

    const result = advance(activation, 0, 10_000, 1);

    expect(steps).toBe(10);
    expect(result.batch.read(output)).toBe(10);
    expect(result.terminal.atEnd).toBe(false);
    expect(result.steppers.length).toBeLessThanOrEqual(11);
  });

  it('gives distinct stepper track paths independent frame budgets', () => {
    const one = signal(0);
    const two = signal(0);
    const steps = [0, 0];
    const branch = (output: ReturnType<typeof signal<number>>, index: number) =>
      repeat(track(output, stepper({
        stepMilliseconds: 10,
        maxElapsedMilliseconds: 100,
        initial: (current: number) => ({ value: current, steps: 0 }),
        step: state => {
          steps[index]!++;
          return { value: state.value + 1, steps: state.steps + 1 };
        },
        read: state => state.value,
        done: state => state.steps === 1,
      })), { iterations: Number.POSITIVE_INFINITY });
    const activation = activateProgram(parallel(branch(one, 0), branch(two, 1)), {});

    const result = advance(activation, 0, 10_000, 1);

    expect(steps).toEqual([10, 10]);
    expect(result.batch.read(one)).toBe(10);
    expect(result.batch.read(two)).toBe(10);
    expect(result.steppers.reduce(
      (total, trace) => total + trace.discardedElapsedMilliseconds,
      0,
    )).toBe(19_800);
    expect(result.steppers.filter(
      trace => trace.discardedElapsedMilliseconds > 0,
    )).toHaveLength(2);
  });

  it('reports an initial clamp discard once when a bare stepper terminates early', () => {
    const output = signal(0);
    const activation = activateProgram(track(output, stepper({
      stepMilliseconds: 10,
      maxElapsedMilliseconds: 100,
      initial: (current: number) => current,
      step: state => state + 1,
      read: state => state,
      done: state => state === 3,
    })), {});

    const result = advance(activation, 0, 250, 1);

    expect(result.batch.read(output)).toBe(3);
    expect(result.steppers).toEqual([expect.objectContaining({
      appliedSteps: 3,
      clampedElapsedMilliseconds: 30,
      discardedElapsedMilliseconds: 150,
      terminal: { step: 3, time: 30 },
    })]);
  });

  it('reports one initial clamp discard when a finite repeat terminates early', () => {
    const output = signal(0);
    const activation = activateProgram(repeat(track(output, stepper({
      stepMilliseconds: 10,
      maxElapsedMilliseconds: 100,
      initial: (current: number) => ({ value: current, steps: 0 }),
      step: state => ({ value: state.value + 1, steps: state.steps + 1 }),
      read: state => state.value,
      done: state => state.steps === 1,
    })), { iterations: 3 }), {});

    const result = advance(activation, 0, 250, 1);

    expect(result.batch.read(output)).toBe(3);
    expect(result.steppers.reduce(
      (total, trace) => total + trace.clampedElapsedMilliseconds,
      0,
    )).toBe(30);
    expect(result.steppers.reduce(
      (total, trace) => total + trace.discardedElapsedMilliseconds,
      0,
    )).toBe(150);
    expect(result.steppers.filter(
      trace => trace.discardedElapsedMilliseconds > 0,
    )).toHaveLength(1);
  });

  it('reports one early-terminal clamp discard for each distinct track path', () => {
    const one = signal(0);
    const two = signal(0);
    const branch = (output: ReturnType<typeof signal<number>>) =>
      track(output, stepper({
        stepMilliseconds: 10,
        maxElapsedMilliseconds: 100,
        initial: (current: number) => current,
        step: state => state + 1,
        read: state => state,
        done: state => state === 3,
      }));
    const activation = activateProgram(parallel(branch(one), branch(two)), {});

    const result = advance(activation, 0, 250, 1);

    expect(result.batch.read(one)).toBe(3);
    expect(result.batch.read(two)).toBe(3);
    expect(result.steppers.map(trace => ({
      path: trace.programPath,
      clamped: trace.clampedElapsedMilliseconds,
      discarded: trace.discardedElapsedMilliseconds,
    }))).toEqual([
      { path: [0], clamped: 30, discarded: 150 },
      { path: [1], clamped: 30, discarded: 150 },
    ]);
  });

  it('releases finite sequence and parallel state across multiple outputs and done-at-initial', () => {
    const instant = signal(5);
    const one = signal(0);
    const two = signal(0);
    const activation = activateProgram(sequence(
      track(instant, stepper({
        stepMilliseconds: 10,
        initial: (current: number) => ({ value: current, done: true }),
        step: state => state,
        read: state => state.value,
        done: state => state.done,
      })),
      parallel(
        track(one, stepper({
          stepMilliseconds: 10,
          initial: (current: number) => ({ value: current, steps: 0 }),
          step: state => ({ value: state.value + 1, steps: state.steps + 1 }),
          read: state => state.value,
          done: state => state.steps === 1,
        })),
        track(two, stepper({
          stepMilliseconds: 10,
          initial: (current: number) => ({ value: current, steps: 0 }),
          step: state => ({ value: state.value + 1, steps: state.steps + 1 }),
          read: state => state.value,
          done: state => state.steps === 2,
        })),
      ),
    ), {});

    const result = advance(activation, 0, 20, 1);

    expect(result.batch.read(instant)).toBe(5);
    expect(result.batch.read(one)).toBe(1);
    expect(result.batch.read(two)).toBe(2);
    expect(result.terminal).toEqual({
      duration: 20,
      atStart: false,
      atEnd: true,
      reached: true,
    });
    expect(result.steppers.map(trace => ({
      path: trace.programPath,
      terminal: trace.terminal,
    }))).toEqual([
      { path: [0], terminal: { step: 0, time: 0 } },
      { path: [1, 0], terminal: { step: 1, time: 10 } },
      { path: [1, 1], terminal: { step: 2, time: 20 } },
    ]);
    expect(getProgramActivationRecord(activation).activeSteppers).toEqual([]);
    expect(getProgramActivationRecord(activation).terminalSteppers).toEqual([]);
  });
});

describe('zero-duration stateful occurrence budget', () => {
  function instantIncrement(
    output: ReturnType<typeof signal<number>>,
    counters: { initials: number; dones: number; reads: number },
  ) {
    return track(output, stepper({
      debugName: 'instant increment',
      stepMilliseconds: 10,
      initial: (current: number) => {
        counters.initials++;
        return current + 1;
      },
      step: state => state,
      read: state => {
        counters.reads++;
        return state;
      },
      done: state => {
        counters.dones++;
        return state > 0;
      },
    }));
  }

  it.each([
    ['ordinary advance', advance],
    ['direct replay seek', (
      activation: ProgramActivation,
      previousTime: number | undefined,
      time: number,
      frameId: number,
    ) => seek(activation, previousTime, time, 'forward', frameId)],
  ] as const)('permits the exact 512-occurrence boundary during %s', (_, evaluate) => {
    const output = signal(0);
    const counters = { initials: 0, dones: 0, reads: 0 };
    const activation = activateProgram(repeat(
      instantIncrement(output, counters),
      { iterations: 512 },
    ), {});

    const result = evaluate(activation, undefined, 0, 1);

    expect(result.batch.read(output)).toBe(512);
    expect(result.steppers).toHaveLength(512);
    expect(result.milestones).toHaveLength(511);
    expect(counters).toEqual({ initials: 512, dones: 512, reads: 512 });
    expect(result.terminal).toEqual({
      duration: 0,
      atStart: true,
      atEnd: true,
      reached: true,
    });
  });

  it('shares the budget across nested repeats and preserves zero-time source order', () => {
    const output = signal(0);
    const counters = { initials: 0, dones: 0, reads: 0 };
    const activation = activateProgram(repeat(
      repeat(sequence(
        instantIncrement(output, counters),
        marker('instant boundary'),
      ), { iterations: 2 }),
      { iterations: 2 },
    ), {});

    const result = advance(activation, undefined, 0, 1);

    expect(result.batch.read(output)).toBe(4);
    expect(counters).toEqual({ initials: 4, dones: 4, reads: 4 });
    expect(result.milestones.map(event => [
      event.kind,
      event.kind === 'marker' ? event.marker : event.iteration,
      event.programPath,
    ])).toEqual([
      ['marker', 'instant boundary', [0, 0, 1]],
      ['iteration', 1, [0]],
      ['marker', 'instant boundary', [0, 0, 1]],
      ['iteration', 1, []],
      ['marker', 'instant boundary', [0, 0, 1]],
      ['iteration', 1, [0]],
      ['marker', 'instant boundary', [0, 0, 1]],
    ]);
  });

  it.each([
    ['ordinary advance', evaluateProgram],
    ['direct replay seek', seekProgram],
  ] as const)('rejects the 513th zero-time occurrence atomically during %s', (_, evaluate) => {
    const output = signal(0);
    const counters = { initials: 0, dones: 0, reads: 0 };
    const activation = activateProgram(repeat(
      instantIncrement(output, counters),
      { iterations: 513 },
    ), {});
    const batch = createSignalCommitBatch();
    const callerWriter = {};
    batch.stage(output, 91, callerWriter);

    expect(() => evaluate(activation, {
      previousTime: undefined,
      time: 0,
      direction: 'forward',
      frameId: 7,
      writer,
      batch,
    })).toThrow(/zero-duration.*512.*instant increment.*path.*frame 7/iu);

    expect(counters).toEqual({ initials: 512, dones: 512, reads: 512 });
    expect(output.get()).toBe(0);
    expect(batch.read(output)).toBe(91);
    expect(getProgramActivationRecord(activation).activeSteppers).toEqual([]);
    expect(getProgramActivationRecord(activation).terminalSteppers).toEqual([]);
  });

  it('shares the rejection boundary across nested repeat nodes', () => {
    const output = signal(0);
    const counters = { initials: 0, dones: 0, reads: 0 };
    const activation = activateProgram(repeat(
      repeat(instantIncrement(output, counters), { iterations: 171 }),
      { iterations: 3 },
    ), {});

    expect(() => advance(activation, undefined, 0, 9)).toThrow(
      /zero-duration.*512.*instant increment.*path.*frame 9/iu,
    );

    expect(counters).toEqual({ initials: 512, dones: 512, reads: 512 });
    expect(output.get()).toBe(0);
    expect(getProgramActivationRecord(activation).activeSteppers).toEqual([]);
    expect(getProgramActivationRecord(activation).terminalSteppers).toEqual([]);
  });

  it('shares one limit across parallel branches and rejects huge finite repeats promptly', () => {
    const one = signal(0);
    const two = signal(0);
    let callbackAttempts = 0;
    const counters = [
      { initials: 0, dones: 0, reads: 0 },
      { initials: 0, dones: 0, reads: 0 },
    ];
    const guardedInstant = (output: ReturnType<typeof signal<number>>, index: number) =>
      track(output, stepper({
        debugName: `guarded instant ${index}`,
        stepMilliseconds: 10,
        initial: (current: number) => {
          callbackAttempts++;
          if (callbackAttempts > 512) throw new Error('budget failed to stop traversal');
          counters[index]!.initials++;
          return current + 1;
        },
        step: state => state,
        read: state => {
          counters[index]!.reads++;
          return state;
        },
        done: () => {
          counters[index]!.dones++;
          return true;
        },
      }));
    const activation = activateProgram(parallel(
      repeat(guardedInstant(one, 0), { iterations: 300 }),
      repeat(guardedInstant(two, 1), { iterations: 1_000_000_000 }),
    ), {});
    const batch = createSignalCommitBatch();
    const callerWriter = {};
    batch.stage(one, 81, callerWriter);
    batch.stage(two, 82, callerWriter);

    expect(() => evaluateProgram(activation, {
      previousTime: undefined,
      time: 0,
      direction: 'forward',
      frameId: 8,
      writer,
      batch,
    })).toThrow(/zero-duration.*512.*guarded instant 1.*path.*frame 8/iu);

    expect(callbackAttempts).toBe(512);
    expect(counters[0]).toEqual({ initials: 300, dones: 300, reads: 300 });
    expect(counters[1]).toEqual({ initials: 212, dones: 212, reads: 212 });
    expect(batch.read(one)).toBe(81);
    expect(batch.read(two)).toBe(82);
    expect(getProgramActivationRecord(activation).activeSteppers).toEqual([]);
    expect(getProgramActivationRecord(activation).terminalSteppers).toEqual([]);
  });

  it('continues to reject an infinite zero-duration stateful repeat promptly', () => {
    const output = signal(0);
    const counters = { initials: 0, dones: 0, reads: 0 };
    const activation = activateProgram(repeat(
      instantIncrement(output, counters),
      { iterations: Number.POSITIVE_INFINITY },
    ), {});

    expect(() => advance(activation, undefined, 0, 1)).toThrow(
      /infinite repeat with zero duration/iu,
    );
    expect(counters).toEqual({ initials: 1, dones: 1, reads: 1 });
    expect(getProgramActivationRecord(activation).activeSteppers).toEqual([]);
    expect(getProgramActivationRecord(activation).terminalSteppers).toEqual([]);
  });
});

describe('stateful fixed-step replay', () => {
  it('resets backward and forward seeks and matches a fresh fixed-step replay', () => {
    const output = signal(0);
    const program = track(output, stepper({
      stepMilliseconds: 10,
      initial: (current: number) => ({ value: current }),
      step: state => ({ value: state.value + 0.1 }),
      read: state => state.value,
    }));
    const activation = activateProgram(program, {});

    expect(seek(activation, 0, 35, 'forward', 1).batch.read(output)).toBeCloseTo(0.3, 12);
    const backward = seek(activation, 35, 15, 'reverse', 2);
    expect(backward.batch.read(output)).toBeCloseTo(0.1, 12);
    expect(backward.steppers[0]).toMatchObject({
      appliedSteps: 1,
      retainedRemainderMilliseconds: 5,
      clampedElapsedMilliseconds: 15,
      discardedElapsedMilliseconds: 0,
    });
    const forward = seek(activation, 15, 45, 'forward', 3);
    const fresh = seek(activateProgram(program, {}), 0, 45, 'forward', 4);
    expect(forward.batch.read(output)).toBeCloseTo(0.4, 12);
    expect(forward.batch.read(output)).toBeCloseTo(fresh.batch.read(output), 12);
  });

  it('replays direct target time without applying the host-gap clamp', () => {
    const output = signal(0);
    const activation = activateProgram(track(output, stepper({
      stepMilliseconds: 10,
      maxElapsedMilliseconds: 20,
      initial: (current: number) => current,
      step: state => state + 1,
      read: state => state,
    })), {});

    const result = seek(activation, 0, 100, 'forward', 1);

    expect(result.batch.read(output)).toBe(10);
    expect(result.steppers).toEqual([expect.objectContaining({
      appliedSteps: 10,
      clampedElapsedMilliseconds: 100,
      discardedElapsedMilliseconds: 0,
    })]);
  });

  it('rejects reverse-from-idle and finish until done reveals a terminal endpoint', () => {
    const output = signal(0);
    const activation = activateProgram(track(output, stepper({
      stepMilliseconds: 10,
      initial: (current: number) => current,
      step: state => state + 1,
      read: state => state,
      done: state => state === 3,
    })), {});

    expect(() => seek(activation, undefined, 0, 'reverse', 1)).toThrow(
      /terminal.*not.*discovered/iu,
    );
    expect(() => finishProgram(activation, {
      previousTime: 0,
      frameId: 2,
      writer,
      batch: createSignalCommitBatch(),
    })).toThrow(/terminal.*not.*discovered/iu);

    expect(advance(activation, 0, 30, 3).terminal.duration).toBe(30);

    const reversed = seek(activation, undefined, 30, 'reverse', 4);
    expect(reversed.batch.read(output)).toBe(3);
    const finished = finishProgram(activation, {
      previousTime: 0,
      frameId: 5,
      writer,
      batch: createSignalCommitBatch(),
    });
    expect(finished.batch.read(output)).toBe(3);
    expect(finished.terminal.atEnd).toBe(true);
  });

  it('replays normal stepper repeat occurrences at exact boundaries', () => {
    const createProgram = (output: ReturnType<typeof signal<number>>) =>
      repeat(track(output, stepper({
        stepMilliseconds: 10,
        initial: (current: number) => ({ value: current, steps: 0 }),
        step: state => ({ value: state.value + 1, steps: state.steps + 1 }),
        read: state => state.value,
        done: state => state.steps === 2,
      })), { iterations: 2, direction: 'normal' });
    const times = [0, 10, 20, 30, 40];
    const values = [0, 1, 2, 3, 4];

    for (const [index, time] of times.entries()) {
      const output = signal(0);
      const result = seek(
        activateProgram(createProgram(output), {}),
        0,
        time,
        'forward',
        index + 1,
      );
      expect(result.batch.read(output), `seek normal at ${time}`).toBe(values[index]);
      if (time === 40) expect(result.terminal.duration).toBe(40);
    }

    const output = signal(0);
    const activation = activateProgram(createProgram(output), {});
    for (const [index, time] of times.entries()) {
      const result = advance(
        activation,
        index === 0 ? 0 : times[index - 1],
        time,
        index + 10,
      );
      expect(result.batch.read(output), `advance normal at ${time}`).toBe(values[index]);
      if (time === 40) {
        expect(result.terminal.duration).toBe(40);
        expect(getProgramActivationRecord(activation).activeSteppers).toEqual([]);
        expect(getProgramActivationRecord(activation).terminalSteppers).toEqual([]);
      }
    }
  });

  it.each(['reverse', 'alternate-reverse'] as const)(
    'rejects a fresh unresolved %s occurrence without invoking callbacks',
    direction => {
      const output = signal(0);
      const calls = { initial: 0, step: 0, read: 0, done: 0 };
      const activation = activateProgram(repeat(track(output, stepper({
        debugName: 'unresolved reverse',
        stepMilliseconds: 10,
        initial: (current: number) => {
          calls.initial++;
          return current;
        },
        step: state => {
          calls.step++;
          return state + 1;
        },
        read: state => {
          calls.read++;
          return state;
        },
        done: state => {
          calls.done++;
          return state === 2;
        },
      })), { iterations: 2, direction }), {});
      const batch = createSignalCommitBatch();
      const callerWriter = {};
      batch.stage(output, 77, callerWriter);

      expect(() => seekProgram(activation, {
        previousTime: 0,
        time: 0,
        direction: 'forward',
        frameId: 3,
        writer,
        batch,
      })).toThrow(/unresolved reverse.*endpoint.*activation input.*path/iu);

      expect(calls).toEqual({ initial: 0, step: 0, read: 0, done: 0 });
      expect(output.get()).toBe(0);
      expect(batch.read(output)).toBe(77);
      expect(getProgramActivationRecord(activation).activeSteppers).toEqual([]);
    },
  );

  it('rejects a statically infinite reversed stepper before every callback', () => {
    const output = signal(0);
    let callbacks = 0;
    const activation = activateProgram(repeat(track(output, stepper({
      debugName: 'infinite reverse',
      stepMilliseconds: Number.MAX_VALUE,
      initial: (current: number) => {
        callbacks++;
        return current;
      },
      step: state => {
        callbacks++;
        return state + 1;
      },
      read: state => {
        callbacks++;
        return state;
      },
    })), { iterations: 2, direction: 'reverse' }), {});

    expect(() => advance(activation, 0, 0, 1)).toThrow(
      /infinite reverse.*finite endpoint.*path/iu,
    );
    expect(callbacks).toBe(0);
  });

  it('rejects an unresolved never-done reverse without searching callbacks', () => {
    const output = signal(0);
    let callbacks = 0;
    const activation = activateProgram(repeat(track(output, stepper({
      debugName: 'never done reverse',
      stepMilliseconds: Number.MAX_VALUE,
      initial: (current: number) => {
        callbacks++;
        return current;
      },
      step: state => {
        callbacks++;
        return state + 1;
      },
      read: state => {
        callbacks++;
        return state;
      },
      done: () => {
        callbacks++;
        return false;
      },
    })), { iterations: 2, direction: 'reverse' }), {});

    expect(() => advance(activation, 0, 0, 1)).toThrow(
      /never done reverse.*endpoint.*activation input.*path/iu,
    );
    expect(callbacks).toBe(0);
  });

  it('reuses a forward endpoint only when the reversed occurrence has the exact input', () => {
    const createProgram = (output: ReturnType<typeof signal<number>>) =>
      repeat(track(output, stepper({
        stepMilliseconds: 10,
        initial: (current: number) => ({ initial: current, value: current, steps: 0 }),
        step: state => ({
          ...state,
          value: state.steps === 0 ? state.initial + 1 : state.initial,
          steps: state.steps + 1,
        }),
        read: state => state.value,
        done: state => state.steps === 2,
      })), { iterations: 2, direction: 'alternate' });

    for (const [index, expected] of [0, 1, 0, 1, 0].entries()) {
      const output = signal(0);
      expect(seek(
        activateProgram(createProgram(output), {}),
        0,
        index * 10,
        'forward',
        index + 20,
      ).batch.read(output)).toBe(expected);
    }

    const output = signal(0);
    const activation = activateProgram(createProgram(output), {});
    for (const [index, expected] of [0, 1, 0, 1, 0].entries()) {
      const time = index * 10;
      expect(advance(activation, Math.max(0, time - 10), time, index + 1)
        .batch.read(output)).toBe(expected);
    }
  });

  it('rejects an alternate reverse occurrence when the forward endpoint input changed', () => {
    const output = signal(0);
    const activation = activateProgram(repeat(track(output, stepper({
      debugName: 'changed alternate input',
      stepMilliseconds: 10,
      initial: (current: number) => ({ value: current, steps: 0 }),
      step: state => ({ value: state.value + 1, steps: state.steps + 1 }),
      read: state => state.value,
      done: state => state.steps === 2,
    })), { iterations: 2, direction: 'alternate' }), {});
    const batch = createSignalCommitBatch();
    const callerWriter = {};
    batch.stage(output, 88, callerWriter);

    expect(() => evaluateProgram(activation, {
      previousTime: 0,
      time: 20,
      direction: 'forward',
      frameId: 4,
      writer,
      batch,
    })).toThrow(/changed alternate input.*endpoint.*activation input.*path/iu);

    expect(output.get()).toBe(0);
    expect(batch.read(output)).toBe(88);
    expect(getProgramActivationRecord(activation).activeSteppers).toEqual([]);
  });

  it('rolls back cached reversed-occurrence replay when a callback fails', () => {
    const output = signal(0);
    let shouldFail = false;
    const activation = activateProgram(repeat(track(output, stepper({
      debugName: 'reversed failure',
      stepMilliseconds: 10,
      initial: (current: number) => ({ initial: current, value: current, steps: 0 }),
      step: state => {
        if (shouldFail) throw new Error('replay failed');
        return {
          ...state,
          value: state.steps === 0 ? state.initial + 1 : state.initial,
          steps: state.steps + 1,
        };
      },
      read: state => state.value,
      done: state => state.steps === 2,
    })), { iterations: 2, direction: 'alternate' }), {});
    advance(activation, 0, 20, 8);
    shouldFail = true;
    const batch = createSignalCommitBatch();
    const callerWriter = {};
    batch.stage(output, 91, callerWriter);

    expect(() => evaluateProgram(activation, {
      previousTime: 20,
      time: 30,
      direction: 'forward',
      frameId: 9,
      writer,
      batch,
    })).toThrow(/reversed failure.*step.*replay failed/iu);

    expect(output.get()).toBe(0);
    expect(batch.read(output)).toBe(91);
    expect(getProgramActivationRecord(activation).activeSteppers).toEqual([]);
    expect(getProgramActivationRecord(activation).terminalSteppers).toEqual([]);
  });
});

describe('stateful repeat milestones', () => {
  function oneStepRepeat(
    output: ReturnType<typeof signal<number>>,
    options: { direction?: 'normal' | 'alternate'; maxElapsedMilliseconds?: number } = {},
  ) {
    return repeat(track(output, stepper({
      stepMilliseconds: 10,
      maxElapsedMilliseconds: options.maxElapsedMilliseconds ?? 100,
      initial: (current: number) => ({ initial: current, value: current, steps: 0 }),
      step: state => ({
        ...state,
        value: options.direction === 'alternate' ? state.initial : state.value + 1,
        steps: state.steps + 1,
      }),
      read: state => state.value,
      done: state => state.steps === 1,
    })), {
      iterations: Number.POSITIVE_INFINITY,
      direction: options.direction ?? 'normal',
    });
  }

  it('reports every crossed normal boundary without retaining occurrence history', () => {
    const output = signal(0);
    const activation = activateProgram(oneStepRepeat(output), {});

    const result = advance(activation, 0, 40, 1);

    expect(result.milestones.map(event => [event.kind, event.programTime, event.iteration]))
      .toEqual([
        ['iteration', 10, 1],
        ['iteration', 20, 2],
        ['iteration', 30, 3],
        ['iteration', 40, 4],
      ]);
  });

  it('does not report repeat boundaries from discarded host-gap time', () => {
    const output = signal(0);
    const activation = activateProgram(oneStepRepeat(output, {
      maxElapsedMilliseconds: 100,
    }), {});

    const result = advance(activation, 0, 10_000, 1);

    expect(result.milestones.map(event => event.programTime)).toEqual([
      10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
    ]);
  });

  it('preserves nested marker and iteration source order at tied boundaries', () => {
    const output = signal(0);
    const child = sequence(
      track(output, stepper({
        stepMilliseconds: 10,
        initial: (current: number) => ({ value: current, steps: 0 }),
        step: state => ({ value: state.value + 1, steps: state.steps + 1 }),
        read: state => state.value,
        done: state => state.steps === 1,
      })),
      marker('first'),
      marker('second'),
    );
    const activation = activateProgram(repeat(child, {
      iterations: Number.POSITIVE_INFINITY,
    }), {});

    const result = advance(activation, 0, 20, 1);

    expect(result.milestones.map(event => [
      event.kind,
      event.kind === 'marker' ? event.marker : event.iteration,
      event.programTime,
    ])).toEqual([
      ['marker', 'first', 10],
      ['marker', 'second', 10],
      ['iteration', 1, 10],
      ['marker', 'first', 20],
      ['marker', 'second', 20],
      ['iteration', 2, 20],
    ]);
  });

  it('reports alternate boundaries when the exact-input endpoint is reusable', () => {
    const output = signal(0);
    const activation = activateProgram(oneStepRepeat(output, {
      direction: 'alternate',
    }), {});

    const result = advance(activation, 0, 40, 1);

    expect(result.milestones.map(event => event.programTime)).toEqual([10, 20, 30, 40]);
  });

  it('reports stateful repeat boundaries in reverse traversal order', () => {
    const output = signal(0);
    const activation = activateProgram(oneStepRepeat(output), {});
    advance(activation, 0, 40, 1);

    const result = seek(activation, 40, 10, 'reverse', 2);

    expect(result.milestones.map(event => [event.programTime, event.iteration])).toEqual([
      [30, 3],
      [20, 2],
      [10, 1],
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  sequence,
  repeat,
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
    expect(getProgramActivationRecord(activation).terminalSteppers).toEqual([
      expect.objectContaining({
        programPath: [0],
        terminalStep: 3,
        terminalTime: 30,
      }),
    ]);
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
    expect(record.terminalSteppers.map(stepperRecord => ({
      path: stepperRecord.programPath,
      repeats: stepperRecord.repeatIterations,
    }))).toEqual([
      { path: [0], repeats: [0] },
      { path: [0], repeats: [1] },
    ]);
    expect(record.terminalSteppers.every(stepperRecord =>
      Object.isFrozen(stepperRecord) && Object.isFrozen(stepperRecord.programPath) &&
      Object.isFrozen(stepperRecord.repeatIterations),
    )).toBe(true);
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
});

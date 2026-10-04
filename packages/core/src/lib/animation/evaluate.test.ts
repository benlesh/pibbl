import repeatMilestones from './repeat-milestones.fixture.json';
import { describe, expect, it, vi } from 'vitest';
import {
  defineAnimation,
  keyframes,
  marker,
  parallel,
  repeat,
  sequence,
  signal,
  spring,
  stepper,
  track,
  tween,
  wait,
  type CRCAnimationProgram,
  type WritableSignal,
} from '../../index';
import {
  createSignalCommitBatch,
  getSignalNode,
  signalGraphSnapshot,
} from '../signals/graph';
import {
  activateProgram,
  adoptProgramActivationFork,
  evaluateProgram,
  forkProgramActivation,
  getProgramActivationRecord,
  releaseProgramActivation,
  seekProgram,
  type ProgramEvaluationResult,
} from './evaluate';

const writer = Object.freeze({ name: 'test writer' });

function evaluateAt(
  activation: ReturnType<typeof activateProgram>,
  time: number,
  previousTime: number | undefined = undefined,
  direction: 'forward' | 'reverse' = 'forward',
  frameId = 1,
): ProgramEvaluationResult {
  const batch = createSignalCommitBatch();
  return evaluateProgram(activation, {
    previousTime,
    time,
    direction,
    frameId,
    writer,
    batch,
  });
}

function committedValueAt<T>(
  program: CRCAnimationProgram,
  output: WritableSignal<T>,
  time: number,
): T {
  const result = evaluateAt(activateProgram(program, {}), time);
  result.batch.commit();
  return output.get();
}

describe('seekable animation program evaluation', () => {
  it('captures sequential omitted starts from transaction-local staged values', () => {
    const x = signal(0);
    const program = sequence(
      track(x, tween({ to: 10, duration: 100 })),
      track(x, tween({ to: 30, duration: 100 })),
    );
    const registration = {};
    const activation = activateProgram(program, registration);
    let invalidations = 0;
    getSignalNode(x).observers.add(() => invalidations++);
    const before = signalGraphSnapshot().signalCommitNotifications;

    const result = evaluateAt(activation, 150, 0);

    expect(result.batch.read(x)).toBe(20);
    expect(x.get()).toBe(0);
    expect(getProgramActivationRecord(activation)).toMatchObject({
      program,
      registration,
    });
    expect(getProgramActivationRecord(activation).originalValues.get(x)).toBe(0);
    const activationRecord = getProgramActivationRecord(activation);
    expect(Object.isFrozen(activation)).toBe(true);
    expect(Object.isFrozen(activationRecord)).toBe(true);
    expect(() => (activationRecord.originalValues as Map<unknown, unknown>).clear())
      .toThrow(TypeError);
    expect(activationRecord.trackStarts.every(start =>
      Object.isFrozen(start) && Object.isFrozen(start.programPath) &&
      Object.isFrozen(start.repeatIterations),
    )).toBe(true);
    expect(activationRecord.trackStarts.map(start => ({
      path: start.programPath,
      initialValue: start.initialValue,
    }))).toEqual([
      { path: [0], initialValue: 0 },
      { path: [1], initialValue: 10 },
    ]);

    result.batch.commit();

    expect(x.get()).toBe(20);
    expect(invalidations).toBe(1);
    expect(signalGraphSnapshot().signalCommitNotifications - before).toBe(1);
  });

  it('rebuilds direct seeks from the original run snapshot instead of public mutations', () => {
    const x = signal(0);
    const program = sequence(
      track(x, tween({ to: 10, duration: 100 })),
      track(x, tween({ to: 30, duration: 100 })),
    );
    const activation = activateProgram(program, {});
    const first = evaluateAt(activation, 150, 0);
    first.batch.commit();
    expect(x.get()).toBe(20);

    x.set(90);
    const seekBatch = createSignalCommitBatch();
    const sought = seekProgram(activation, {
      previousTime: 150,
      time: 50,
      direction: 'reverse',
      frameId: 2,
      writer,
      batch: seekBatch,
    });

    expect(sought.batch.read(x)).toBe(5);
    expect(x.get()).toBe(90);
    expect(getProgramActivationRecord(activation).trackStarts).toEqual([
      expect.objectContaining({ programPath: [0], initialValue: 0 }),
    ]);
  });

  it('samples sequence, parallel, wait, empty groups, and zero-duration boundaries', () => {
    const sequenceCases = [
      { time: 0, want: 0 },
      { time: 50, want: 5 },
      { time: 100, want: 10 },
      { time: 125, want: 10 },
      { time: 150, want: 10 },
      { time: 200, want: 20 },
      { time: 250, want: 30 },
    ];
    for (const { time, want } of sequenceCases) {
      const x = signal(-1);
      const program = sequence(
        track(x, tween({ from: 0, to: 10, duration: 100 })),
        wait(50),
        track(x, tween({ from: 10, to: 30, duration: 100 })),
      );
      expect(committedValueAt(program, x, time)).toBe(want);
    }

    const long = signal(0);
    const short = signal(0);
    const parallelProgram = parallel(
      track(long, tween({ from: 0, to: 10, duration: 100 })),
      track(short, tween({ from: 0, to: 20, duration: 50 })),
    );
    const parallelResult = evaluateAt(activateProgram(parallelProgram, {}), 75);
    expect(parallelResult.batch.read(long)).toBe(7.5);
    expect(parallelResult.batch.read(short)).toBe(20);
    expect(parallelResult.terminal).toEqual({
      duration: 100,
      atStart: false,
      atEnd: false,
      reached: false,
    });

    const zero = signal(1);
    const zeroResult = evaluateAt(activateProgram(
      track(zero, tween({ to: 9, duration: 0 })),
      {},
    ), 0);
    expect(zeroResult.batch.read(zero)).toBe(9);
    expect(zeroResult.terminal).toEqual({
      duration: 0,
      atStart: true,
      atEnd: true,
      reached: true,
    });

    for (const empty of [sequence(), parallel()]) {
      expect(evaluateAt(activateProgram(empty, {}), 0).terminal).toEqual({
        duration: 0,
        atStart: true,
        atEnd: true,
        reached: true,
      });
    }
  });

  it('uses an omitted spring start to resolve following sequence timing', () => {
    const x = signal(10);
    const program = sequence(
      track(x, spring({ to: 10 })),
      track(x, tween({ to: 20, duration: 100 })),
    );
    const activation = activateProgram(program, {});
    expect(getProgramActivationRecord(activation).trackStarts).toEqual([]);

    const result = evaluateAt(activation, 50);

    expect(result.batch.read(x)).toBe(15);
    expect(result.terminal.duration).toBe(100);
  });

  it('fails closed when an omitted spring shifts parallel same-output writers into overlap', () => {
    const y = signal(10, { debugName: 'duration source' });
    const x = signal(0, { debugName: 'shared output' });
    const program = parallel(
      sequence(
        track(y, spring({ to: 10 })),
        track(x, tween({ from: 0, to: 100, duration: 100 })),
      ),
      sequence(
        wait(50),
        track(x, tween({ from: 0, to: 200, duration: 100 })),
      ),
    );

    expect(() => activateProgram(program, {})).toThrow(
      /activation-dependent.*writer.*shared output/iu,
    );
    expect(x.get()).toBe(0);
    expect(y.get()).toBe(10);
  });

  it('fails activation when a resolved repeat period makes writer instances touch', () => {
    const y = signal(10, { debugName: 'repeat duration source' });
    const x = signal(0, { debugName: 'repeated output' });
    const program = repeat(sequence(
      track(y, spring({ to: 10 })),
      track(x, tween({ from: 0, to: 100, duration: 100 })),
    ), { iterations: 2 });
    const callerWriter = {};
    const callerBatch = createSignalCommitBatch();
    callerBatch.stage(x, 73, callerWriter);
    const graphBefore = signalGraphSnapshot();

    expect(() => activateProgram(program, {})).toThrow(
      /activation-dependent.*writer.*repeated output/iu,
    );

    expect(callerBatch.read(x)).toBe(73);
    expect(x.get()).toBe(0);
    expect(y.get()).toBe(10);
    expect(signalGraphSnapshot()).toEqual(graphBefore);
  });

  it('accepts activation-dependent same-output writers that remain provably separated', () => {
    const x = signal(0, { debugName: 'separated output' });
    const program = parallel(
      track(x, spring({ to: 10 })),
      sequence(
        wait(10_001),
        track(x, tween({ from: 10, to: 20, duration: 100 })),
      ),
    );

    const activation = activateProgram(program, {});

    expect(getProgramActivationRecord(activation).originalValues.get(x)).toBe(0);
    expect(getProgramActivationRecord(activation).trackStarts).toEqual([]);
  });

  it('accepts large activation-dependent repeats when writer instances stay separated', () => {
    const y = signal(10, { debugName: 'large repeat duration source' });
    const x = signal(0, { debugName: 'large repeated output' });
    const program = repeat(sequence(
      track(y, spring({ to: 10 })),
      track(x, tween({ from: 0, to: 1, duration: 1 })),
      wait(100),
    ), { iterations: 600 });

    const activation = activateProgram(program, {});

    expect(getProgramActivationRecord(activation).trackStarts).toEqual([]);
  });

  it('directly selects a static repeat terminal without visiting prior iterations', () => {
    const output = signal(0);
    let samples = 0;
    const program = repeat(sequence(
      track(output, tween({
        from: 0,
        to: 1,
        duration: 0.5,
        easing: progress => {
          samples++;
          return progress;
        },
      })),
      wait(0.5),
    ), { iterations: 1e308 });
    const activation = activateProgram(program, {});
    const batch = createSignalCommitBatch();

    const result = seekProgram(activation, {
      previousTime: 1e308,
      time: 1e308,
      direction: 'forward',
      frameId: 1,
      writer,
      batch,
    });

    expect(result.batch.read(output)).toBe(1);
    expect(result.terminal.duration).toBe(1e308);
    expect(samples).toBe(1);
  });

  it('resolves huge zero-duration no-write repeats without visiting occurrences', () => {
    const directions = [
      'normal',
      'reverse',
      'alternate',
      'alternate-reverse',
    ] as const;
    const children = [
      { name: 'wait', program: wait(0) },
      { name: 'empty sequence', program: sequence() },
      { name: 'marker', program: marker('instant') },
    ];

    for (const { name, program: child } of children) {
      for (const repeatDirection of directions) {
        for (const traversalDirection of ['forward', 'reverse'] as const) {
          const program = repeat(child, {
            iterations: 1e308,
            direction: repeatDirection,
          });
          const batch = createSignalCommitBatch();
          const result = seekProgram(activateProgram(program, {}), {
            previousTime: 0,
            time: 0,
            direction: traversalDirection,
            frameId: 1,
            writer,
            batch,
          });

          expect(result.terminal, `${name}/${repeatDirection}/${traversalDirection}`).toEqual({
            duration: 0,
            atStart: true,
            atEnd: true,
            reached: true,
          });
          expect(result.milestones).toEqual([]);
        }
      }
    }
  });

  it('bounds first-sample milestones for zero-duration repeats without dropping accepted events', () => {
    const accepted = evaluateAt(
      activateProgram(repeat(marker('instant'), { iterations: 512 }), {}),
      0,
    );

    expect(accepted.milestones).toHaveLength(1_023);
    expect(accepted.milestones.filter(event => event.kind === 'marker')).toHaveLength(512);
    expect(accepted.milestones.filter(event => event.kind === 'iteration')).toHaveLength(511);
    expect(accepted.milestones.slice(0, 4).map(event => [
      event.kind,
      event.kind === 'marker' ? event.marker : event.iteration,
    ])).toEqual([
      ['marker', 'instant'],
      ['iteration', 1],
      ['marker', 'instant'],
      ['iteration', 2],
    ]);
    expect(accepted.milestones.at(-1)).toMatchObject({
      kind: 'marker',
      marker: 'instant',
      iteration: 511,
    });

    expect(() => evaluateAt(
      activateProgram(repeat(marker('instant'), { iterations: 513 }), {}),
      0,
      undefined,
      'forward',
      7,
    )).toThrow(/zero-duration.*512.*marker.*path.*repeat iterations \[512\].*frame 7/iu);

    expect(() => evaluateAt(
      activateProgram(repeat(marker('instant'), { iterations: 1e308 }), {}),
      0,
      undefined,
      'forward',
      8,
    )).toThrow(/zero-duration.*512.*marker.*path.*repeat iterations \[512\].*frame 8/iu);
  });

  it('samples only the owning zero-duration writer occurrence in every repeat direction', () => {
    for (const direction of [
      'normal',
      'reverse',
      'alternate',
      'alternate-reverse',
    ] as const) {
      const output = signal(1);
      let samples = 0;
      const program = repeat(track(output, tween({
        from: 1,
        to: 9,
        duration: 0,
        easing: progress => {
          samples++;
          return progress;
        },
      })), { iterations: 1, direction });

      const result = seekProgram(activateProgram(program, {}), {
        previousTime: 0,
        time: 0,
        direction: 'forward',
        frameId: 2,
        writer,
        batch: createSignalCommitBatch(),
      });

      expect(result.batch.read(output)).toBe(9);
      expect(result.terminal).toEqual({
        duration: 0,
        atStart: true,
        atEnd: true,
        reached: true,
      });
      expect(result.milestones).toEqual([]);
      expect(samples).toBe(1);
    }
  });

  it('maps all finite repeat directions at boundaries with zero-based iterations', () => {
    const cases = [
      { direction: 'normal' as const, time: 0, want: 0 },
      { direction: 'normal' as const, time: 25, want: 5 },
      { direction: 'normal' as const, time: 100, want: 0 },
      { direction: 'reverse' as const, time: 0, want: 10 },
      { direction: 'reverse' as const, time: 75, want: 5 },
      { direction: 'reverse' as const, time: 100, want: 10 },
      { direction: 'alternate' as const, time: 100, want: 10 },
      { direction: 'alternate' as const, time: 175, want: 5 },
      { direction: 'alternate' as const, time: 200, want: 0 },
      { direction: 'alternate-reverse' as const, time: 100, want: 0 },
      { direction: 'alternate-reverse' as const, time: 125, want: 5 },
      { direction: 'alternate-reverse' as const, time: 200, want: 10 },
    ];

    for (const { direction, time, want } of cases) {
      const x = signal(-1);
      const child = sequence(
        track(x, tween({ from: 0, to: 10, duration: 50 })),
        wait(50),
      );
      const program = repeat(child, { iterations: 3, direction });
      expect(committedValueAt(program, x, time)).toBe(want);
    }

    const boundaryProgram = repeat(sequence(wait(100), marker('turn')), {
      iterations: 3,
      direction: 'alternate-reverse',
    });
    const milestones = evaluateAt(
      activateProgram(boundaryProgram, {}),
      300,
      0,
    ).milestones;
    expect(milestones.filter(event => event.kind === 'iteration').map(event => ({
      time: event.programTime,
      iteration: event.iteration,
    }))).toEqual([
      { time: 100, iteration: 1 },
      { time: 200, iteration: 2 },
    ]);
  });

  it('samples every repeat direction at start, interiors, boundaries, and final endpoint', () => {
    const cases = [
      {
        direction: 'normal' as const,
        values: [0, 5, 10, 0, 5, 10, 0, 5, 10, 10],
      },
      {
        direction: 'reverse' as const,
        values: [10, 10, 5, 10, 10, 5, 10, 10, 5, 0],
      },
      {
        direction: 'alternate' as const,
        values: [0, 5, 10, 10, 10, 5, 0, 5, 10, 10],
      },
      {
        direction: 'alternate-reverse' as const,
        values: [10, 10, 5, 0, 5, 10, 10, 10, 5, 0],
      },
    ];
    const times = [0, 25, 75, 100, 125, 175, 200, 225, 275, 300];

    for (const { direction, values } of cases) {
      for (let index = 0; index < times.length; index++) {
        const output = signal(-1);
        const child = sequence(
          track(output, tween({ from: 0, to: 10, duration: 50 })),
          wait(50),
        );
        const program = repeat(child, { iterations: 3, direction });
        expect(committedValueAt(program, output, times[index]!)).toBe(values[index]);
      }
    }
  });

  it('keeps nested omitted starts distinct by outer and inner repeat iteration', () => {
    const output = signal(0);
    const increment = defineAnimation<number>({
      duration: 10,
      sample: ({ initialValue, progress }) => initialValue + 10 * progress,
    });
    const program = repeat(repeat(sequence(
      track(output, increment),
      wait(1),
    ), { iterations: 2 }), { iterations: 2 });
    const activation = activateProgram(program, {});

    const result = evaluateAt(activation, 44);

    expect(result.batch.read(output)).toBe(40);
    expect(getProgramActivationRecord(activation).trackStarts.map(start => ({
      path: start.programPath,
      iterations: start.repeatIterations,
      initialValue: start.initialValue,
    }))).toEqual([
      { path: [0, 0, 0], iterations: [0, 0], initialValue: 0 },
      { path: [0, 0, 0], iterations: [0, 1], initialValue: 10 },
      { path: [0, 0, 0], iterations: [1, 0], initialValue: 20 },
      { path: [0, 0, 0], iterations: [1, 1], initialValue: 30 },
    ]);
  });

  it('orders crossed markers and repeat boundaries by traversal then source order', () => {
    const registration = {};
    const program = sequence(
      marker('origin'),
      wait(100),
      parallel(marker('left'), marker('right')),
      repeat(sequence(wait(50), marker('tick'), wait(50)), { iterations: 3 }),
    );
    const activation = activateProgram(program, registration);
    const forward = evaluateAt(activation, 360, 0, 'forward', 8);

    expect(forward.milestones.map(event => ({
      kind: event.kind,
      marker: event.kind === 'marker' ? event.marker : undefined,
      time: event.programTime,
      path: event.programPath,
      iteration: event.iteration,
    }))).toEqual([
      { kind: 'marker', marker: 'left', time: 100, path: [2, 0], iteration: 0 },
      { kind: 'marker', marker: 'right', time: 100, path: [2, 1], iteration: 0 },
      { kind: 'marker', marker: 'tick', time: 150, path: [3, 0, 1], iteration: 0 },
      { kind: 'iteration', marker: undefined, time: 200, path: [3], iteration: 1 },
      { kind: 'marker', marker: 'tick', time: 250, path: [3, 0, 1], iteration: 1 },
      { kind: 'iteration', marker: undefined, time: 300, path: [3], iteration: 2 },
      { kind: 'marker', marker: 'tick', time: 350, path: [3, 0, 1], iteration: 2 },
    ]);
    expect(forward.milestones.every(event =>
      Object.isFrozen(event) && Object.isFrozen(event.programPath) &&
      event.frameId === 8 && event.registration === registration,
    )).toBe(true);

    const reverse = evaluateAt(activation, 0, 360, 'reverse', 9);
    expect(reverse.milestones.map(event =>
      `${event.programTime}:${event.kind === 'marker' ? event.marker : event.iteration}`,
    )).toEqual([
      '350:tick',
      '300:2',
      '250:tick',
      '200:1',
      '150:tick',
      '100:left',
      '100:right',
      '0:origin',
    ]);
  });

  it('makes direct seeks match forward advances across seekable definition kinds', () => {
    function fixture() {
      const tweened = signal(2);
      const framed = signal(0);
      const sprung = signal(0);
      const repeated = signal(0);
      const program = parallel(
        sequence(wait(10), track(tweened, tween({ to: 12, duration: 100 }))),
        track(framed, keyframes({ values: [0, 20, 10], duration: 100 })),
        track(sprung, spring({ to: 10 })),
        repeat(sequence(
          track(repeated, tween({ from: 0, to: 6, duration: 20 })),
          wait(10),
          marker('cycle'),
        ), { iterations: 4, direction: 'alternate' }),
      );
      return { outputs: [tweened, framed, sprung, repeated] as const, program };
    }

    const advanced = fixture();
    const advancedActivation = activateProgram(advanced.program, {});
    let previous: number | undefined;
    for (const time of [0, 7, 16, 33, 70]) {
      const result = evaluateAt(advancedActivation, time, previous);
      result.batch.commit();
      previous = time;
    }

    const sought = fixture();
    const soughtActivation = activateProgram(sought.program, {});
    const seekBatch = createSignalCommitBatch();
    seekProgram(soughtActivation, {
      previousTime: 0,
      time: 70,
      direction: 'forward',
      frameId: 5,
      writer,
      batch: seekBatch,
    }).batch.commit();

    expect(sought.outputs.map(output => output.get())).toEqual(
      advanced.outputs.map(output => output.get()),
    );
  });

  it('samples a direct seek destination once while returning milestone data only', () => {
    const output = signal(2);
    let samples = 0;
    const program = sequence(
      marker('begin'),
      track(output, defineAnimation({
        duration: 100,
        sample: ({ initialValue, progress }) => {
          samples++;
          return initialValue + 10 * progress;
        },
      })),
    );
    const batch = createSignalCommitBatch();

    const result = seekProgram(activateProgram(program, {}), {
      previousTime: 0,
      time: 50,
      direction: 'forward',
      frameId: 1,
      writer,
      batch,
    });

    expect(result.batch.read(output)).toBe(7);
    expect(samples).toBe(1);
    expect(result.milestones).toEqual([]);
  });

  it('samples reverse advance and seek only at the requested destination', () => {
    function fixture(throwAtTerminal: boolean) {
      const output = signal(0);
      const samples: number[] = [];
      const program = track(output, defineAnimation({
        duration: 100,
        sample: ({ progress }) => {
          samples.push(progress);
          if (throwAtTerminal && progress === 1) throw new Error('terminal only');
          return progress * 10;
        },
      }));
      return { activation: activateProgram(program, {}), output, samples };
    }

    const advanced = fixture(false);
    const advancedBatch = createSignalCommitBatch();
    const advancedResult = evaluateProgram(advanced.activation, {
      previousTime: 100,
      time: 50,
      direction: 'reverse',
      frameId: 2,
      writer,
      batch: advancedBatch,
    });
    expect(advancedResult.batch.read(advanced.output)).toBe(5);
    expect(advanced.samples).toEqual([0.5]);

    const sought = fixture(true);
    const seekBatch = createSignalCommitBatch();
    const seekResult = seekProgram(sought.activation, {
      previousTime: 100,
      time: 50,
      direction: 'reverse',
      frameId: 3,
      writer,
      batch: seekBatch,
    });
    expect(seekResult.batch.read(sought.output)).toBe(5);
    expect(sought.samples).toEqual([0.5]);
  });

  it('discovers a dynamically timed reversed repeat without terminal custom sampling', () => {
    function fixture(throwAtTerminal: boolean) {
      const durationSource = signal(10);
      const output = signal(0);
      const samples: number[] = [];
      const program = repeat(sequence(
        track(durationSource, spring({ to: 10 })),
        track(output, defineAnimation({
          duration: 100,
          sample: ({ progress }) => {
            samples.push(progress);
            if (throwAtTerminal && progress === 1) throw new Error('old terminal only');
            return progress * 10;
          },
        })),
      ), { iterations: 1, direction: 'reverse' });
      return { activation: activateProgram(program, {}), output, samples };
    }

    const advanced = fixture(false);
    const advancedResult = evaluateAt(advanced.activation, 50, 100, 'reverse');
    expect(advancedResult.batch.read(advanced.output)).toBe(5);
    expect(advanced.samples).toEqual([0.5]);
    expect(advancedResult.terminal.duration).toBe(100);

    const sought = fixture(true);
    const seekBatch = createSignalCommitBatch();
    const seekResult = seekProgram(sought.activation, {
      previousTime: 100,
      time: 50,
      direction: 'reverse',
      frameId: 4,
      writer,
      batch: seekBatch,
    });
    expect(seekResult.batch.read(sought.output)).toBe(5);
    expect(sought.samples).toEqual([0.5]);
    expect(seekResult.terminal.duration).toBe(100);
  });

  it('discovers fresh reverse milestones and duration across omitted-start springs', () => {
    const first = signal(0);
    const second = signal(0);
    const program = sequence(
      track(first, spring({ to: 10, damping: 0, maxDuration: 100 })),
      marker('first'),
      track(second, spring({ to: 20, damping: 0, maxDuration: 200 })),
      marker('second'),
    );
    const activation = activateProgram(program, {});
    const batch = createSignalCommitBatch();

    const result = seekProgram(activation, {
      previousTime: 20_000,
      time: 0,
      direction: 'reverse',
      frameId: 5,
      writer,
      batch,
    });

    expect(result.milestones.map(event => ({
      kind: event.kind,
      marker: event.kind === 'marker' ? event.marker : undefined,
      time: event.programTime,
      path: event.programPath,
    }))).toEqual([
      { kind: 'marker', marker: 'second', time: 300, path: [3] },
      { kind: 'marker', marker: 'first', time: 100, path: [1] },
    ]);
    expect(result.terminal).toEqual({
      duration: 300,
      atStart: true,
      atEnd: false,
      reached: true,
    });
    expect(getProgramActivationRecord(activation).trackStarts.map(start => ({
      path: start.programPath,
      initialValue: start.initialValue,
      duration: start.duration,
    }))).toEqual([
      { path: [0], initialValue: 0, duration: 100 },
    ]);
  });

  it('carries callback-free terminal values through static definitions during discovery', () => {
    const output = signal(0);
    const samples: number[] = [];
    const program = sequence(
      track(output, defineAnimation({
        duration: 10,
        sample: ({ progress }) => {
          samples.push(progress);
          return progress * 5;
        },
      })),
      track(output, spring({ from: 0, to: 10, damping: 0, maxDuration: 100 })),
      track(output, spring({ to: 10 })),
      marker('done'),
    );
    const activation = activateProgram(program, {});
    const batch = createSignalCommitBatch();

    const result = seekProgram(activation, {
      previousTime: 1_000,
      time: 0,
      direction: 'reverse',
      frameId: 6,
      writer,
      batch,
    });

    expect(samples).toEqual([0]);
    expect(result.milestones.map(event => ({
      marker: event.kind === 'marker' ? event.marker : undefined,
      time: event.programTime,
    }))).toEqual([{ marker: 'done', time: 110 }]);
    expect(result.terminal.duration).toBe(110);
  });

  it.each(['custom', 'eased', 'interpolated'] as const)(
    'carries a %s terminal into an omitted spring without duplicate destination sampling',
    kind => {
      function fixture() {
        const output = signal(0);
        let calls = 0;
        const first = kind === 'custom' ? defineAnimation<number>({
          duration: 10,
          sample: ({ progress }) => {
            calls++;
            return progress * 10;
          },
        }) : kind === 'eased' ? tween({
          from: 0,
          to: 10,
          duration: 10,
          easing: progress => {
            calls++;
            return progress;
          },
        }) : tween({
          from: 0,
          to: 10,
          duration: 10,
          interpolate: (from, to, progress) => {
            calls++;
            return from + (to - from) * progress;
          },
        });
        const program = sequence(
          track(output, first),
          track(output, spring({ to: 20, damping: 0, maxDuration: 100 })),
        );
        return { output, program, calls: () => calls };
      }

      const advanced = fixture();
      const advancedActivation = activateProgram(advanced.program, {});
      evaluateAt(advancedActivation, 5).batch.clear();
      const advancedResult = evaluateAt(advancedActivation, 15, 5);

      const sought = fixture();
      const seekBatch = createSignalCommitBatch();
      const seekResult = seekProgram(activateProgram(sought.program, {}), {
        previousTime: 0,
        time: 15,
        direction: 'forward',
        frameId: 2,
        writer,
        batch: seekBatch,
      });

      const reversed = fixture();
      const reverseBatch = createSignalCommitBatch();
      const reverseResult = seekProgram(activateProgram(reversed.program, {}), {
        previousTime: 110,
        time: 15,
        direction: 'reverse',
        frameId: 3,
        writer,
        batch: reverseBatch,
      });

      expect(seekResult.batch.read(sought.output)).toBe(
        advancedResult.batch.read(advanced.output),
      );
      expect(reverseResult.batch.read(reversed.output)).toBe(
        advancedResult.batch.read(advanced.output),
      );
      expect(advanced.calls()).toBe(2);
      expect(sought.calls()).toBe(1);
      expect(reversed.calls()).toBe(1);
    },
  );

  it('selects disjoint parallel writers chronologically in either branch order', () => {
    const times = [5, 10, 10.5, 11, 11.5, 12] as const;
    const values = [5, 10, 10, 10, 15, 20] as const;

    for (const reverseBranches of [false, true]) {
      for (let index = 0; index < times.length; index++) {
        const output = signal(0);
        const early = track(output, tween({ from: 0, to: 10, duration: 10 }));
        const late = sequence(
          wait(11),
          track(output, tween({ from: 10, to: 20, duration: 1 })),
        );
        const branches = reverseBranches ? [late, early] : [early, late];
        const result = evaluateAt(
          activateProgram(parallel(...branches), {}),
          times[index]!,
        );
        expect(result.batch.read(output)).toBe(values[index]);
      }

      const output = signal(0);
      const early = track(output, tween({ from: 0, to: 10, duration: 10 }));
      const late = sequence(
        wait(11),
        track(output, tween({ from: 10, to: 20, duration: 1 })),
      );
      const branches = reverseBranches ? [late, early] : [early, late];
      const program = sequence(
        parallel(...branches),
        track(output, tween({ to: 30, duration: 10 })),
      );
      const activation = activateProgram(program, {});
      const result = evaluateAt(activation, 17);

      expect(result.batch.read(output)).toBe(25);
      expect(getProgramActivationRecord(activation).trackStarts.at(-1)).toMatchObject({
        programPath: [1],
        initialValue: 20,
      });
    }
  });

  it('rolls back caller staging and activation starts when a later sampler fails', () => {
    const first = signal(0);
    const second = signal(0);
    const program = sequence(
      track(first, tween({ to: 10, duration: 10 })),
      track(second, defineAnimation({
        duration: 10,
        sample: () => {
          throw new Error('later sample failed');
        },
      })),
    );
    const activation = activateProgram(program, {});
    evaluateAt(activation, 5).batch.clear();
    const before = getProgramActivationRecord(activation).trackStarts;
    expect(before).toEqual([
      expect.objectContaining({ programPath: [0], initialValue: 0 }),
    ]);
    const callerWriter = {};
    const batch = createSignalCommitBatch();
    batch.stage(first, 99, callerWriter);

    expect(() => evaluateProgram(activation, {
      previousTime: 0,
      time: 15,
      direction: 'forward',
      frameId: 1,
      writer,
      batch,
    })).toThrow('later sample failed');

    expect(batch.read(first)).toBe(99);
    expect(batch.read(second)).toBe(0);
    expect(first.get()).toBe(0);
    expect(second.get()).toBe(0);
    expect(getProgramActivationRecord(activation).trackStarts).toEqual(before);
  });

  it('evaluates stateful work without changing seekable transaction semantics', () => {
    const output = signal(0);
    const program = track(output, stepper({
      stepMilliseconds: 10,
      initial: (current: number) => current,
      step: state => state + 1,
      read: state => state,
    }));

    const result = evaluateAt(activateProgram(program, {}), 10, 0);

    expect(result.batch.read(output)).toBe(1);
    expect(output.get()).toBe(0);
  });

  it('keeps forked activation starts private until adoption and invalidates consumed forks', () => {
    const output = signal(0);
    const activation = activateProgram(
      track(output, tween({ to: 10, duration: 10 })),
      {},
    );
    const discarded = forkProgramActivation(activation);
    evaluateAt(discarded, 5);

    expect(getProgramActivationRecord(activation).trackStarts).toEqual([]);
    expect(getProgramActivationRecord(discarded).trackStarts).toHaveLength(1);
    releaseProgramActivation(discarded);
    expect(() => getProgramActivationRecord(discarded)).toThrow(/activation/iu);

    const committed = forkProgramActivation(activation);
    evaluateAt(committed, 5);
    adoptProgramActivationFork(activation, committed);

    expect(getProgramActivationRecord(activation).trackStarts).toHaveLength(1);
    expect(() => getProgramActivationRecord(committed)).toThrow(/activation/iu);
  });
});

describe('long-running emission timelines', () => {
  it.each([2048, 2_000_000])('deduplicates crossed milestones at %i ms without scanning historical events', (time) => {
    const activation = activateProgram(repeat(sequence(wait(1), marker('emit')), { iterations: Infinity }), {});
    let comparisons = 0;
    let constructedEvents = 0;
    const freeze = Object.freeze;
    const freezeSpy = vi.spyOn(Object, 'freeze').mockImplementation((value) => {
      if (typeof value === 'object' && value !== null && 'programTime' in value && 'sourceOrder' in value) constructedEvents++;
      return freeze(value);
    });
    const original = Array.prototype.findIndex;
    const spy = vi.spyOn(Array.prototype, 'findIndex').mockImplementation(function (this: unknown[], predicate, thisArg) {
      const timeline = typeof this[0] === 'object' && this[0] !== null && 'programTime' in this[0];
      return original.call(this, (value, index, array) => {
        if (timeline) comparisons++;
        return predicate.call(thisArg, value, index, array);
      });
    });
    try {
      const result = evaluateAt(activation, time, time - 1);
      expect(result.milestones.filter(event => event.kind === 'marker').map(event => event.programTime)).toEqual([time]);
      expect(comparisons).toBeLessThan(16384);
      expect(constructedEvents).toBeLessThan(10);
    } finally {
      spy.mockRestore();
      freezeSpy.mockRestore();
      releaseProgramActivation(activation);
    }
  });
});

it('preserves original nested fractional-repeat milestone identities and ordering', () => {
  for (const direction of ['normal', 'reverse', 'alternate', 'alternate-reverse'] as const) {
    const program = repeat(sequence(
      marker('start,[0]'),
      wait(0.25),
      repeat(sequence(marker('inner'), wait(0.25), marker('end')), { iterations: 3, direction: 'alternate' }),
      marker('end'),
    ), { iterations: 64, direction });
    const registration = {};
    for (const traversal of ['forward', 'reverse'] as const) {
      const activation = activateProgram(program, registration);
      const from = traversal === 'forward' ? 31.75 : 32.25;
      const to = traversal === 'forward' ? 32.25 : 31.75;
      try {
        const actual = evaluateAt(activation, to, from, traversal).milestones;
        const key = `${direction}:${traversal}` as keyof typeof repeatMilestones;
        // Captured from the original evaluator before interval pruning. This
        // preserves incremental reverse behavior, including same-time ties.
        expect(actual.map(event => [event.kind, event.kind === 'marker' ? event.marker : null,
          event.programTime, event.programPath, event.iteration])).toEqual(repeatMilestones[key]);
      } finally {
        releaseProgramActivation(activation);
      }
    }
  }
});

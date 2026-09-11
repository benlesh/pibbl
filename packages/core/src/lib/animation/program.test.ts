import { describe, expect, it } from 'vitest';
import {
  marker,
  parallel,
  repeat,
  sequence,
  signal,
  stepper,
  track,
  tween,
  wait,
  type CRCAnimationProgram,
  type WritableSignal,
} from '../../index';
import { getProgramRecord } from './program';

describe('immutable animation programs', () => {
  it('creates frozen nominal programs from normalized child snapshots', () => {
    const output = signal(0, { debugName: 'position' });
    const first = wait(10);
    const children = [first];
    const program = sequence(...children);
    children[0] = wait(20);

    expect(Object.isFrozen(program)).toBe(true);
    expect(getProgramRecord(program).children).toEqual([first]);
    expect(Object.isFrozen(getProgramRecord(program).children)).toBe(true);
    expect(() => (getProgramRecord(program).children as CRCAnimationProgram[]).push(wait(1)))
      .toThrow(TypeError);
    expect(() => getProgramRecord({} as typeof program)).toThrow('CRC animation program');
    expect(() => sequence({} as typeof program)).toThrow('CRC animation program');
    expect(() => track(output, {} as ReturnType<typeof tween>)).toThrow(
      'CRC animation definition',
    );
    const foreignOutput = {
      set() {}, update() {}, get() { return 0; }, asReadonly() { return { get: () => 0 }; },
    } as unknown as WritableSignal<number>;
    expect(() => track(foreignOutput,
      tween({ to: 1, duration: 1 }),
    )).toThrow('writable signal');
  });

  it('validates primitive constructors and repeat directions', () => {
    expect(() => wait(-1)).toThrow('finite and nonnegative');
    expect(() => wait(Number.POSITIVE_INFINITY)).toThrow('finite and nonnegative');
    expect(() => marker('')).toThrow('nonempty');
    expect(getProgramRecord(sequence()).duration).toEqual({ kind: 'finite', milliseconds: 0 });
    expect(getProgramRecord(parallel()).duration).toEqual({ kind: 'finite', milliseconds: 0 });

    for (const direction of [
      'normal', 'reverse', 'alternate', 'alternate-reverse',
    ] as const) {
      expect(getProgramRecord(repeat(wait(1), { iterations: 2, direction })))
        .toMatchObject({ direction });
    }
    expect(() => repeat(wait(1), { iterations: 0 })).toThrow('integer');
    expect(() => repeat(wait(1), { iterations: 1.5 })).toThrow('integer');
    expect(() => repeat(wait(1), { iterations: Number.NEGATIVE_INFINITY })).toThrow('positive infinity');
    expect(() => repeat(wait(1), { iterations: Number.NaN })).toThrow('integer');
  });

  it('classifies finite, infinite, and unresolved program durations', () => {
    const x = signal(0);
    const finiteTrack = track(x, tween({ to: 1, duration: 20 }));
    const nonterminating = track(x, stepper({ initialState: 0, step: state => state }));
    const discoverable = track(x, stepper({
      initialState: 0,
      step: state => state + 1,
      done: state => state > 0,
    }));

    expect(getProgramRecord(sequence(wait(5), finiteTrack)).duration)
      .toEqual({ kind: 'finite', milliseconds: 25 });
    expect(getProgramRecord(parallel(wait(5), finiteTrack)).duration)
      .toEqual({ kind: 'finite', milliseconds: 20 });
    expect(getProgramRecord(repeat(wait(20), { iterations: 3 })).duration)
      .toEqual({ kind: 'finite', milliseconds: 60 });
    expect(getProgramRecord(repeat(wait(1), {
      iterations: Number.POSITIVE_INFINITY,
    })).duration).toEqual({ kind: 'infinite' });
    expect(getProgramRecord(nonterminating).duration).toEqual({ kind: 'infinite' });
    expect(getProgramRecord(discoverable).duration).toEqual({ kind: 'unresolved-stepper' });
    expect(() => sequence(nonterminating, wait(1))).toThrow('infinite');
    expect(getProgramRecord(sequence(discoverable, wait(1))).duration)
      .toEqual({ kind: 'unresolved-stepper' });
  });

  it('allows sequential writers and exposes frozen finite writer spans', () => {
    const x = signal(0, { debugName: 'x' });
    const program = sequence(
      track(x, tween({ to: 10, duration: 10 })),
      track(x, tween({ to: 20, duration: 20 })),
    );
    const spans = getProgramRecord(program).writerSpans;

    expect(spans).toEqual([
      { output: x, start: 0, end: 10, path: [0] },
      { output: x, start: 10, end: 30, path: [1] },
    ]);
    expect(Object.isFrozen(spans)).toBe(true);
    expect(Object.isFrozen(spans[0]!.path)).toBe(true);
  });

  it('rejects parallel inclusive writer intersections with paths and signal debug names', () => {
    const x = signal(0, { debugName: 'x' });

    expect(() => parallel(
      track(x, tween({ to: 1, duration: 10 })),
      track(x, tween({ to: 2, duration: 10 })),
    )).toThrow(/\[0\].*\[1\].*x/u);
    expect(() => parallel(
      sequence(wait(0), track(x, tween({ to: 1, duration: 10 }))),
      sequence(wait(10), track(x, tween({ to: 2, duration: 1 }))),
    )).toThrow('overlap');

    expect(() => parallel(
      sequence(wait(0), track(x, tween({ to: 1, duration: 10 }))),
      sequence(wait(11), track(x, tween({ to: 2, duration: 1 }))),
    )).not.toThrow();
  });

  it('checks repeated writer intervals symbolically at repeat boundaries', () => {
    const x = signal(0, { debugName: 'x' });
    const separated = repeat(sequence(
      track(x, tween({ to: 1, duration: 10 })),
      wait(10),
    ), { iterations: Number.POSITIVE_INFINITY, direction: 'alternate' });

    expect(() => repeat(track(x, tween({ to: 1, duration: 10 })), {
      iterations: Number.POSITIVE_INFINITY,
    })).toThrow('overlap');
    expect(() => parallel(
      separated,
      sequence(wait(15), track(x, tween({ to: 2, duration: 1 }))),
    )).not.toThrow();
    expect(() => parallel(
      separated,
      sequence(wait(5), track(x, tween({ to: 2, duration: 1 }))),
    )).toThrow('overlap');
  });

  it('retains large finite and nested repeat writers as constant-size metadata', () => {
    const x = signal(0, { debugName: 'x' });
    const base = sequence(
      track(x, tween({ to: 1, duration: 0 })),
      wait(1),
    );
    const iterations = 100_001;
    const large = repeat(base, { iterations });
    const nested = repeat(repeat(base, { iterations: 2 }), { iterations });

    expect(getProgramRecord(large).writerSchedules).toHaveLength(1);
    expect(getProgramRecord(large).writerSpans).toHaveLength(1);
    expect(getProgramRecord(nested).writerSchedules).toHaveLength(1);
    expect(getProgramRecord(nested).writerSpans).toHaveLength(1);
    expect(getProgramRecord(nested).duration)
      .toEqual({ kind: 'finite', milliseconds: 200_002 });
  });

  it('proves large different-period finite schedules disjoint or overlapping exactly', () => {
    const x = signal(0, { debugName: 'x' });
    const iterations = 100_001;
    const evens = repeat(sequence(
      track(x, tween({ to: 1, duration: 0.5 })),
      wait(1.5),
    ), { iterations, direction: 'alternate-reverse' });
    const odds = repeat(sequence(
      wait(1),
      track(x, tween({ to: 2, duration: 0.5 })),
      wait(2.5),
    ), { iterations, direction: 'alternate' });
    const multiplesOfFour = repeat(sequence(
      track(x, tween({ to: 3, duration: 0.5 })),
      wait(3.5),
    ), { iterations, direction: 'reverse' });

    expect(() => parallel(evens, odds)).not.toThrow();
    expect(() => parallel(evens, multiplesOfFour)).toThrow('overlap');
  });

  it('proves hole-separated nested repeat frames disjoint exactly', () => {
    const x = signal(0, { debugName: 'x' });
    const lhs = repeat(sequence(
      repeat(sequence(track(x, tween({ to: 1, duration: 0 })), wait(1)), { iterations: 2 }),
      wait(10),
    ), { iterations: 2 });
    const rhs = repeat(sequence(
      wait(2),
      track(x, tween({ to: 2, duration: 0 })),
      wait(10),
    ), { iterations: 2 });
    const overlapping = repeat(sequence(
      wait(1),
      track(x, tween({ to: 3, duration: 0 })),
      wait(11),
    ), { iterations: 2 });

    expect(() => parallel(lhs, rhs)).not.toThrow();
    expect(() => parallel(lhs, overlapping)).toThrow('overlap');
  });

  it('proves different infinite periodic schedules disjoint or overlapping exactly', () => {
    const x = signal(0, { debugName: 'x' });
    const evens = repeat(sequence(
      track(x, tween({ to: 1, duration: 0.5 })),
      wait(1.5),
    ), { iterations: Number.POSITIVE_INFINITY });
    const odds = repeat(sequence(
      wait(1),
      track(x, tween({ to: 2, duration: 0.5 })),
      wait(2.5),
    ), { iterations: Number.POSITIVE_INFINITY });
    const multiplesOfFour = repeat(sequence(
      track(x, tween({ to: 3, duration: 0.5 })),
      wait(3.5),
    ), { iterations: Number.POSITIVE_INFINITY });

    expect(() => parallel(evens, odds)).not.toThrow();
    expect(() => parallel(evens, multiplesOfFour)).toThrow('overlap');
  });

  it('aligns unequal finite and mixed nested outer periods without filling holes', () => {
    const x = signal(0, { debugName: 'x' });
    const lhs = repeat(sequence(
      repeat(sequence(track(x, tween({ to: 1, duration: 0 })), wait(1)), { iterations: 2 }),
      wait(10),
    ), { iterations: 2 });
    const rhsFinite = repeat(sequence(
      wait(2),
      track(x, tween({ to: 2, duration: 0 })),
      wait(13),
    ), { iterations: 2 });
    const rhsInfinite = repeat(sequence(
      wait(2),
      track(x, tween({ to: 3, duration: 0 })),
      wait(13),
    ), { iterations: Number.POSITIVE_INFINITY });
    const overlapping = repeat(sequence(
      wait(1),
      track(x, tween({ to: 4, duration: 0 })),
      wait(14),
    ), { iterations: Number.POSITIVE_INFINITY });

    expect(() => parallel(lhs, rhsFinite)).not.toThrow();
    expect(() => parallel(lhs, rhsInfinite)).not.toThrow();
    expect(() => parallel(lhs, overlapping)).toThrow('overlap');
  });
});

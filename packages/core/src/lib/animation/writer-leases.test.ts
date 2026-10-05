import { describe, expect, it } from 'vitest';
import {
  defineAnimation,
  keyframes,
  parallel,
  repeat,
  sequence,
  signal,
  drive,
  tween,
  wait,
} from '../../index';
import { createSignalCommitBatch } from '../signals/graph';
import { evaluateProgram, getProgramActivationRecord } from './evaluate';
import {
  acquireProgramWriterLeases,
  writerLeaseSnapshot,
  type AnimationWriterLeaseOwner,
  type ProgramWriterLease,
} from './writer-leases';

function owner(
  label: string,
  registrationOrder: number,
  cancel: () => void = () => {},
): AnimationWriterLeaseOwner {
  return Object.freeze({
    token: Object.freeze({ label }),
    registrationOrder,
    debugName: label,
    cancel,
  });
}

function counterDelta(
  before: ReturnType<typeof writerLeaseSnapshot>,
  after: ReturnType<typeof writerLeaseSnapshot>,
) {
  return {
    acquired: after.acquired - before.acquired,
    released: after.released - before.released,
    duplicateReleases: after.duplicateReleases - before.duplicateReleases,
    conflicts: after.conflicts - before.conflicts,
    replacements: after.replacements - before.replacements,
  };
}

describe('animation writer leases', () => {
  it('reserves every distinct output atomically and leaves the first owner intact after conflict', () => {
    const first = signal(0, { debugName: 'first output' });
    const second = signal(0, { debugName: 'second output' });
    const before = writerLeaseSnapshot();
    const firstLease = acquireProgramWriterLeases(
      parallel(
        drive(first, tween({ to: 1, duration: 10 })),
        drive(second, tween({ to: 1, duration: 10 })),
      ),
      {},
      owner('first playback', 1),
    );

    expect(() => acquireProgramWriterLeases(
      drive(second, tween({ to: 2, duration: 10 })),
      {},
      owner('second playback', 2),
    )).toThrow(/second output.*first playback/iu);

    const conflicted = writerLeaseSnapshot();
    expect(conflicted.active).toBe(before.active + 2);
    expect(conflicted.activeOutputs).toEqual(['first output', 'second output']);
    expect(counterDelta(before, conflicted)).toEqual({
      acquired: 2,
      released: 0,
      duplicateReleases: 0,
      conflicts: 1,
      replacements: 0,
    });

    firstLease.release();
  });

  it('deduplicates sequential writers to one whole-run lease', () => {
    const output = signal(0, { debugName: 'shared output' });
    const before = writerLeaseSnapshot();
    const lease = acquireProgramWriterLeases(sequence(
      drive(output, tween({ to: 1, duration: 10 })),
      drive(output, tween({ to: 2, duration: 10 })),
    ), {}, owner('sequential playback', 1));

    expect(lease.outputs).toEqual([output]);
    expect(writerLeaseSnapshot().active).toBe(before.active + 1);

    lease.release();
    lease.release();
    expect(counterDelta(before, writerLeaseSnapshot())).toEqual({
      acquired: 1,
      released: 1,
      duplicateReleases: 1,
      conflicts: 0,
      replacements: 0,
    });
  });

  it.each(['finish', 'cancel', 'failure', 'replacement', 'disposal'])('%s releases exactly once', reason => {
    const output = signal(0, { debugName: `${reason} output` });
    const before = writerLeaseSnapshot();
    const lease = acquireProgramWriterLeases(
      drive(output, tween({ to: 1, duration: 10 })),
      {},
      owner(`${reason} playback`, 1),
    );

    lease.release();
    lease.release();

    expect(counterDelta(before, writerLeaseSnapshot())).toEqual({
      acquired: 1,
      released: 1,
      duplicateReleases: 1,
      conflicts: 0,
      replacements: 0,
    });
  });

  it('rejects public writes, authorizes the owner at Commit, and rejects a stale queued batch', () => {
    const output = signal(0, { debugName: 'leased position' });
    let oldLease: ProgramWriterLease;
    const oldOwner = owner('old playback', 1, () => oldLease.release());
    oldLease = acquireProgramWriterLeases(
      drive(output, tween({ to: 10, duration: 10 })),
      {},
      oldOwner,
    );
    let updateCalls = 0;

    expect(() => output.set(1)).toThrow(/leased position.*old playback/iu);
    expect(() => output.update(value => {
      updateCalls++;
      return value + 1;
    })).toThrow(/leased position.*old playback/iu);
    expect(updateCalls).toBe(0);

    const accepted = createSignalCommitBatch();
    accepted.stage(output, 4, oldOwner.token);
    accepted.commit();
    expect(output.get()).toBe(4);

    const stale = createSignalCommitBatch();
    stale.stage(output, 8, oldOwner.token);
    oldLease.release();
    const replacement = acquireProgramWriterLeases(
      drive(output, tween({ to: 20, duration: 10 })),
      {},
      owner('new playback', 2),
    );

    expect(() => stale.commit()).toThrow(/leased position.*new playback/iu);
    expect(stale.read(output)).toBe(4);
    expect(output.get()).toBe(4);

    replacement.release();
  });

  it('replaces each distinct conflicting run once in registration order before sampling', () => {
    const first = signal(1, { debugName: 'first replacement output' });
    const second = signal(2, { debugName: 'second replacement output' });
    const extra = signal(3, { debugName: 'extra old output' });
    const events: string[] = [];
    let earlyLease: ProgramWriterLease;
    let lateLease: ProgramWriterLease;
    const early = owner('early playback', 10, () => {
      events.push('cancel early');
      earlyLease.release();
    });
    const late = owner('late playback', 20, () => {
      events.push('cancel late');
      lateLease.release();
    });
    lateLease = acquireProgramWriterLeases(
      drive(second, tween({ to: 4, duration: 10 })),
      {},
      late,
    );
    earlyLease = acquireProgramWriterLeases(
      parallel(
        drive(first, tween({ to: 5, duration: 10 })),
        drive(extra, tween({ to: 6, duration: 10 })),
      ),
      {},
      early,
    );
    const beforeReplacement = writerLeaseSnapshot();
    const replacingOwner = owner('replacement playback', 30);
    const program = parallel(
      drive(second, defineAnimation({
        duration: 10,
        sample: ({ initialValue }) => {
          events.push(`sample second:${writerLeaseSnapshot().activeOutputs.join(',')}`);
          return initialValue + 10;
        },
      })),
      drive(first, defineAnimation({
        duration: 10,
        sample: ({ initialValue }) => {
          events.push(`sample first:${writerLeaseSnapshot().activeOutputs.join(',')}`);
          return initialValue + 10;
        },
      })),
    );

    const replacement = acquireProgramWriterLeases(program, {}, replacingOwner, {
      conflict: 'replace',
    });
    expect(events).toEqual(['cancel early', 'cancel late']);
    expect(first.get()).toBe(1);
    expect(second.get()).toBe(2);
    expect(extra.get()).toBe(3);
    expect(writerLeaseSnapshot().activeOutputs).toEqual([
      'second replacement output',
      'first replacement output',
    ]);
    expect(counterDelta(beforeReplacement, writerLeaseSnapshot())).toEqual({
      acquired: 2,
      released: 3,
      duplicateReleases: 0,
      conflicts: 0,
      replacements: 2,
    });

    const batch = createSignalCommitBatch();
    evaluateProgram(replacement.activation, {
      previousTime: undefined,
      time: 5,
      direction: 'forward',
      frameId: 1,
      writer: replacingOwner.token,
      batch,
    });
    expect(events).toEqual([
      'cancel early',
      'cancel late',
      'sample second:second replacement output,first replacement output',
      'sample first:second replacement output,first replacement output',
    ]);
    batch.commit();
    expect(first.get()).toBe(11);
    expect(second.get()).toBe(12);

    replacement.release();
  });

  it('preflights captured omitted starts before conflicts or leases can survive', () => {
    const output = signal({ value: 1 }, { debugName: 'object output' });
    let cancellationCalls = 0;
    let existingLease: ProgramWriterLease;
    const existingOwner = owner('existing playback', 1, () => {
      cancellationCalls++;
      existingLease.release();
    });
    existingLease = acquireProgramWriterLeases(
      drive(output, tween({
        from: { value: 0 },
        to: { value: 1 },
        duration: 10,
        interpolate: (from, to, progress) => ({
          value: from.value + (to.value - from.value) * progress,
        }),
      })),
      {},
      existingOwner,
    );
    const before = writerLeaseSnapshot();

    expect(() => acquireProgramWriterLeases(
      drive(output, tween({
        to: { value: 2 },
        duration: 10,
        debugName: 'invalid omitted start',
      })),
      {},
      owner('invalid replacement', 2),
      { conflict: 'replace' },
    )).toThrow(/invalid omitted start.*interpolator.*nonnumeric/iu);

    expect(cancellationCalls).toBe(0);
    expect(output.get()).toEqual({ value: 1 });
    expect(writerLeaseSnapshot()).toEqual(before);

    existingLease.release();
  });

  it('preflights, cancels without rollback, then recaptures the unchanged committed value', () => {
    const output = signal(1, { debugName: 'recaptured output' });
    const events: string[] = [];
    let previousLease: ProgramWriterLease;
    const previousOwner = owner('previous playback', 1, () => {
      events.push(`cancel:${output.get()}`);
      previousLease.release();
    });
    previousLease = acquireProgramWriterLeases(
      drive(output, tween({ to: 5, duration: 10 })),
      {},
      previousOwner,
    );
    const committed = createSignalCommitBatch();
    committed.stage(output, 3, previousOwner.token);
    committed.commit();

    const replacement = acquireProgramWriterLeases(
      drive(output, tween({ to: 9, duration: 10 })),
      {},
      owner('recapturing playback', 2),
      { conflict: 'replace' },
    );

    expect(events).toEqual(['cancel:3']);
    expect(output.get()).toBe(3);
    expect(getProgramActivationRecord(replacement.activation).originalValues.get(output))
      .toBe(3);

    replacement.release();
  });

  it('rejects a future omitted numeric tween from the preceding string terminal before replacement', () => {
    const output = signal<number | string>(0, { debugName: 'composed invalid output' });
    let cancellationCalls = 0;
    let existingLease: ProgramWriterLease;
    const existingOwner = owner('preserved playback', 1, () => {
      cancellationCalls++;
      existingLease.release();
    });
    existingLease = acquireProgramWriterLeases(
      drive(output, tween({ from: 0, to: 1, duration: 10 })),
      {},
      existingOwner,
    );
    const before = writerLeaseSnapshot();
    const program = sequence(
      drive(output, keyframes<number | string>({
        values: ['a', 'b'],
        duration: 10,
        interpolate: (from, to, progress) => progress < 1 ? from : to,
      })),
      drive(output, tween({
        to: 2,
        duration: 10,
        debugName: 'future omitted numeric',
      })),
    );

    expect(() => acquireProgramWriterLeases(
      program,
      {},
      owner('invalid composed replacement', 2),
      { conflict: 'replace' },
    )).toThrow(/future omitted numeric.*interpolator.*nonnumeric/iu);

    expect(cancellationCalls).toBe(0);
    expect(output.get()).toBe(0);
    expect(writerLeaseSnapshot()).toEqual(before);
    existingLease.release();
  });

  it('accepts a future omitted numeric tween from the preceding numeric terminal', () => {
    const output = signal<number | string>('initial', {
      debugName: 'composed valid output',
    });
    let interpolationCalls = 0;
    const program = sequence(
      drive(output, keyframes<number | string>({
        values: [0, 1],
        duration: 10,
        interpolate: (from, to, progress) => {
          interpolationCalls++;
          return progress < 1 ? from : to;
        },
      })),
      drive(output, tween({
        to: 2,
        duration: 10,
        debugName: 'valid future omitted numeric',
      })),
    );

    const lease = acquireProgramWriterLeases(
      program,
      {},
      owner('valid composed playback', 1),
    );

    expect(interpolationCalls).toBe(0);
    expect(getProgramActivationRecord(lease.activation).originalValues.get(output))
      .toBe('initial');
    lease.release();
  });

  it('propagates zero-duration sequence boundaries before validating omitted starts', () => {
    const invalid = signal<number | string>(0);
    const invalidProgram = sequence(
      drive(invalid, keyframes<number | string>({
        values: [0, 1],
        duration: 0,
        interpolate: (from, to, progress) => progress < 1 ? from : to,
      })),
      drive(invalid, keyframes<number | string>({
        values: ['before', 'after'],
        duration: 0,
        interpolate: (from, to, progress) => progress < 1 ? from : to,
      })),
      drive(invalid, tween({ to: 2, duration: 1, debugName: 'zero invalid' })),
    );
    expect(() => acquireProgramWriterLeases(
      invalidProgram,
      {},
      owner('zero invalid playback', 1),
    )).toThrow(/zero invalid.*interpolator.*nonnumeric/iu);

    const valid = signal<number | string>('initial');
    const validProgram = sequence(
      drive(valid, keyframes<number | string>({
        values: ['before', 'after'],
        duration: 0,
        interpolate: (from, to, progress) => progress < 1 ? from : to,
      })),
      drive(valid, keyframes<number | string>({
        values: [0, 1],
        duration: 0,
        interpolate: (from, to, progress) => progress < 1 ? from : to,
      })),
      drive(valid, tween({ to: 2, duration: 1, debugName: 'zero valid' })),
    );
    const lease = acquireProgramWriterLeases(
      validProgram,
      {},
      owner('zero valid playback', 2),
    );
    lease.release();
  });

  it('uses repeat direction and terminal boundaries without expanding every iteration', () => {
    const cases = [
      { direction: 'normal', iterations: 10_000, accepts: false },
      { direction: 'reverse', iterations: 10_000, accepts: true },
      { direction: 'alternate', iterations: 10_000, accepts: true },
      { direction: 'alternate', iterations: 9_999, accepts: false },
      { direction: 'alternate-reverse', iterations: 10_000, accepts: false },
      { direction: 'alternate-reverse', iterations: 9_999, accepts: true },
    ] as const;

    for (const { direction, iterations, accepts } of cases) {
      const output = signal<number | string>('initial');
      const program = sequence(
        repeat(sequence(
          drive(output, tween<number | string>({
            from: 0,
            to: 1,
            duration: 1,
          })),
          drive(output, keyframes<number | string>({
            values: ['a', 'b'],
            duration: 1,
            interpolate: (from, to, progress) => progress < 1 ? from : to,
          })),
          wait(1),
        ), { iterations, direction }),
        drive(output, tween({
          to: 2,
          duration: 1,
          debugName: `${direction} ${iterations} repeat terminal`,
        })),
      );

      if (accepts) {
        const lease = acquireProgramWriterLeases(
          program,
          {},
          owner(`${direction} ${iterations} repeat playback`, 2),
        );
        lease.release();
      } else {
        expect(() => acquireProgramWriterLeases(
          program,
          {},
          owner(`${direction} ${iterations} repeat playback`, 2),
        )).toThrow(/repeat terminal.*interpolator.*nonnumeric/iu);
      }
    }
  });

  it('uses the chronologically latest parallel terminal regardless of branch order', () => {
    for (const reverseBranches of [false, true]) {
      const output = signal<number | string>('initial');
      const early = drive(output, keyframes<number | string>({
        values: ['a', 'b'],
        duration: 10,
        interpolate: (from, to, progress) => progress < 1 ? from : to,
      }));
      const late = sequence(
        wait(11),
        drive(output, keyframes<number | string>({
          values: [0, 1],
          duration: 1,
          interpolate: (from, to, progress) => progress < 1 ? from : to,
        })),
      );
      const branches = reverseBranches ? [late, early] : [early, late];
      const program = sequence(
        parallel(...branches),
        drive(output, tween({
          to: 2,
          duration: 1,
          debugName: 'parallel future omitted numeric',
        })),
      );

      const lease = acquireProgramWriterLeases(
        program,
        {},
        owner(`parallel order ${String(reverseBranches)}`, 1),
      );
      lease.release();
    }
  });

  it('fails closed without invoking an opaque callback needed by a future omitted start', () => {
    const output = signal<number | string>(0);
    let sampleCalls = 0;
    const before = writerLeaseSnapshot();
    const program = sequence(
      drive(output, defineAnimation({
        duration: 10,
        sample: () => {
          sampleCalls++;
          return 'opaque';
        },
      })),
      drive(output, tween({
        to: 2,
        duration: 1,
        debugName: 'opaque future omitted',
      })),
    );

    expect(() => acquireProgramWriterLeases(
      program,
      {},
      owner('opaque future playback', 1),
    )).toThrow(/opaque future omitted.*callback-free/iu);
    expect(sampleCalls).toBe(0);
    expect(writerLeaseSnapshot()).toEqual(before);
  });
});

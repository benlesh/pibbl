import { describe, expect, it } from 'vitest';
import {
  defineAnimation,
  parallel,
  sequence,
  signal,
  track,
  tween,
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
        track(first, tween({ to: 1, duration: 10 })),
        track(second, tween({ to: 1, duration: 10 })),
      ),
      {},
      owner('first playback', 1),
    );

    expect(() => acquireProgramWriterLeases(
      track(second, tween({ to: 2, duration: 10 })),
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
      track(output, tween({ to: 1, duration: 10 })),
      track(output, tween({ to: 2, duration: 10 })),
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
      track(output, tween({ to: 1, duration: 10 })),
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
      track(output, tween({ to: 10, duration: 10 })),
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
      track(output, tween({ to: 20, duration: 10 })),
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
      track(second, tween({ to: 4, duration: 10 })),
      {},
      late,
    );
    earlyLease = acquireProgramWriterLeases(
      parallel(
        track(first, tween({ to: 5, duration: 10 })),
        track(extra, tween({ to: 6, duration: 10 })),
      ),
      {},
      early,
    );
    const beforeReplacement = writerLeaseSnapshot();
    const replacingOwner = owner('replacement playback', 30);
    const program = parallel(
      track(second, defineAnimation({
        duration: 10,
        sample: ({ initialValue }) => {
          events.push(`sample second:${writerLeaseSnapshot().activeOutputs.join(',')}`);
          return initialValue + 10;
        },
      })),
      track(first, defineAnimation({
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
      track(output, tween({
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
      track(output, tween({
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
      track(output, tween({ to: 5, duration: 10 })),
      {},
      previousOwner,
    );
    const committed = createSignalCommitBatch();
    committed.stage(output, 3, previousOwner.token);
    committed.commit();

    const replacement = acquireProgramWriterLeases(
      track(output, tween({ to: 9, duration: 10 })),
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
});

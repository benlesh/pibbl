import { describe, expect, it } from 'vitest';
import {
  computed,
  isSignal,
  signal,
  track,
  tween,
  untracked,
  type SignalEquals,
} from '../../index';
import {
  flushPendingComputedValidations,
  createSignalCommitBatch,
  getSignalNode,
  provisionSignalValueForRender,
  signalGraphSnapshot,
  withSignalTracking,
  withSignalWriteForbidden,
  withSignalWritePolicy,
} from './graph';
import {
  acquireProgramWriterLeases,
  type ProgramWriterLease,
} from '../animation/writer-leases';

describe('signal', () => {
  it('provides explicit reads, writes, and one cached readonly view', () => {
    const point = signal(
      { x: 1 },
      {
        debugName: 'point',
        equals: (previous, next) => previous.x === next.x,
      },
    );
    const readonlyPoint = point.asReadonly();

    expect(point.get()).toEqual({ x: 1 });
    expect(readonlyPoint).toBe(point.asReadonly());
    expect(readonlyPoint).toEqual({ get: expect.any(Function) });
    expect(isSignal(point)).toBe(true);
    expect(isSignal(readonlyPoint)).toBe(true);
    expect(isSignal({ get: () => 1 })).toBe(false);

    point.set({ x: 1 });
    expect(point.get()).toEqual({ x: 1 });
    point.update(current => ({ x: current.x + 1 }));
    expect(point.get()).toEqual({ x: 2 });
  });

  it('runs an update callback once with the current value', () => {
    const count = signal(1);
    let updateCalls = 0;

    count.update(current => {
      updateCalls++;
      return current + 1;
    });

    expect(updateCalls).toBe(1);
    expect(count.get()).toBe(2);
  });

  it('rejects a forbidden update before running its callback', () => {
    const count = signal(1);
    let updateCalls = 0;

    expect(() => withSignalWriteForbidden('writes are forbidden', () => {
      count.update(current => {
        updateCalls++;
        return current + 1;
      });
    })).toThrow('writes are forbidden');

    expect(updateCalls).toBe(0);
    expect(count.get()).toBe(1);
  });

  it('treats function values as data', () => {
    const first = () => 'first';
    const second = () => 'second';
    const value = signal(first);

    value.set(second);
    expect(value.get()).toBe(second);

    value.update(current => {
      expect(current).toBe(second);
      return first;
    });
    expect(value.get()).toBe(first);
  });

  it('uses Object.is equality by default', () => {
    const nan = signal(Number.NaN);
    const zero = signal(0);
    const nanNode = getSignalNode(nan);
    const zeroNode = getSignalNode(zero);

    nan.set(Number.NaN);
    zero.set(-0);

    expect(nan.get()).toBe(Number.NaN);
    expect(nanNode.version).toBe(0);
    expect(Object.is(zero.get(), -0)).toBe(true);
    expect(zeroNode.version).toBe(1);
  });

  it('normalizes custom options without retaining the caller options object', () => {
    const sameX: SignalEquals<{ x: number }> = (previous, next) =>
      previous.x === next.x;
    const options = { debugName: 'point', equals: sameX };
    const point = signal({ x: 1 }, options);
    const node = getSignalNode(point);

    options.debugName = 'mutated';
    options.equals = () => false;
    point.set({ x: 1 });

    expect(point.get()).toEqual({ x: 1 });
    expect(node.debugName).toBe('point');
    expect(node.version).toBe(0);
  });

  it('keeps the prior value and version when equality throws', () => {
    const boom = new Error('equality failed');
    const value = signal(1, { equals: () => { throw boom; } });
    const node = getSignalNode(value);

    expect(() => value.set(2)).toThrow(boom);
    expect(value.get()).toBe(1);
    expect(node.version).toBe(0);
  });

  it('keeps the prior value and version when an update callback throws', () => {
    const boom = new Error('update failed');
    const value = signal(1);
    const node = getSignalNode(value);

    expect(() => value.update(() => { throw boom; })).toThrow(boom);
    expect(value.get()).toBe(1);
    expect(node.version).toBe(0);
  });

  it('uses only the innermost write policy and restores policy frames', () => {
    const value = signal(0);
    const policies: string[] = [];
    const outerPolicy = () => policies.push('outer');
    const innerPolicy = () => policies.push('inner');
    const boom = new Error('inner scope failed');

    withSignalWritePolicy(outerPolicy, () => {
      value.set(1);
      withSignalWritePolicy(innerPolicy, () => value.set(2));
      value.set(3);

      expect(() => withSignalWritePolicy(innerPolicy, () => {
        throw boom;
      })).toThrow(boom);
      value.set(4);
    });
    value.set(5);

    expect(policies).toEqual(['outer', 'inner', 'outer', 'outer']);
  });

  it('notifies observers after a successful write commits', () => {
    const value = signal(1);
    const node = getSignalNode(value);
    const observations: Array<readonly [number, number]> = [];
    node.observers.add(() => {
      observations.push([node.value, node.version]);
    });

    value.set(2);

    expect(observations).toEqual([[2, 1]]);
  });

  it('does not notify observers for equal or failed writes', () => {
    const equal = signal(1);
    const equalNode = getSignalNode(equal);
    const failed = signal(1, { equals: () => { throw new Error('failed'); } });
    const failedNode = getSignalNode(failed);
    let notifications = 0;
    equalNode.observers.add(() => notifications++);
    failedNode.observers.add(() => notifications++);

    equal.set(1);
    expect(() => failed.set(2)).toThrow('failed');

    expect(notifications).toBe(0);
  });

  it('versions provisional render values for computed reads without ordinary notifications', () => {
    const value = signal(1);
    const doubled = computed(() => value.get() * 2);
    const versions: number[] = [];
    let notifications = 0;
    getSignalNode(value).observers.add(() => notifications++);

    expect(doubled.get()).toBe(2);
    const failed = provisionSignalValueForRender(value, 2);
    versions.push(getSignalNode(value).version);
    expect(value.get()).toBe(2);
    expect(doubled.get()).toBe(4);
    failed.rollback();
    versions.push(getSignalNode(value).version);
    expect(value.get()).toBe(1);
    expect(doubled.get()).toBe(2);

    const successful = provisionSignalValueForRender(value, 3);
    versions.push(getSignalNode(value).version);
    expect(doubled.get()).toBe(6);
    successful.commit();

    expect(versions).toEqual([1, 2, 3]);
    expect(value.get()).toBe(3);
    expect(notifications).toBe(0);
  });
});

describe('signal commit batches', () => {
  it('keeps staged values private until one commit and invalidates only for a changed final computed value', () => {
    const left = signal(1);
    const right = signal(2);
    let evaluations = 0;
    const total = computed(() => {
      evaluations++;
      return left.get() + right.get();
    });
    let invalidations = 0;
    const node = getSignalNode(total);
    expect(total.get()).toBe(3);
    node.observers.add(() => invalidations++);
    const detach = node.observe?.();
    if (detach === undefined) {
      throw new Error('Expected computed signals to support internal observation.');
    }

    const batch = createSignalCommitBatch();
    const writer = {};
    batch.stage(left, 2, writer);
    batch.stage(right, 1, writer);

    expect(left.get()).toBe(1);
    expect(right.get()).toBe(2);
    expect(batch.read(left)).toBe(2);
    expect(batch.read(right)).toBe(1);

    batch.commit();
    flushPendingComputedValidations();

    expect(left.get()).toBe(2);
    expect(right.get()).toBe(1);
    expect(total.get()).toBe(3);
    expect(evaluations).toBe(2);
    expect(invalidations).toBe(0);

    batch.stage(left, 3, writer);
    batch.stage(right, 2, writer);
    batch.commit();
    flushPendingComputedValidations();

    expect(total.get()).toBe(5);
    expect(invalidations).toBe(1);

    const discarded = createSignalCommitBatch();
    discarded.stage(left, 99, writer);
    discarded.discardWriter(writer);
    discarded.commit();

    expect(left.get()).toBe(3);
    detach();
  });

  it('retains first stage order while restaging an output and supports clear', () => {
    const first = signal(1);
    const second = signal(2);
    const notifications: string[] = [];
    getSignalNode(first).observers.add(() => notifications.push('first'));
    getSignalNode(second).observers.add(() => notifications.push('second'));
    const writer = {};
    const batch = createSignalCommitBatch();

    batch.stage(first, 10, writer);
    batch.stage(second, 20, writer);
    batch.stage(first, 11, writer);
    batch.commit();

    expect(first.get()).toBe(11);
    expect(second.get()).toBe(20);
    expect(notifications).toEqual(['first', 'second']);

    batch.stage(first, 99, writer);
    batch.clear();
    batch.commit();

    expect(first.get()).toBe(11);
  });

  it('rejects staged writes in a forbidden scope', () => {
    const value = signal(1);
    const batch = createSignalCommitBatch();

    expect(() => withSignalWriteForbidden('writes are forbidden', () => {
      batch.stage(value, 2, {});
    })).toThrow('writes are forbidden');

    batch.commit();
    expect(value.get()).toBe(1);
  });

  it('notifies every changed source after observer failures before reporting them', () => {
    const left = signal(1);
    const right = signal(2);
    const leftFailure = new Error('left observer failed');
    const rightFailure = new Error('right observer failed');
    const notifications: string[] = [];
    getSignalNode(left).observers.add(() => {
      notifications.push('left failed');
      throw leftFailure;
    });
    getSignalNode(left).observers.add(() => notifications.push('left later'));
    getSignalNode(right).observers.add(() => {
      notifications.push('right failed');
      throw rightFailure;
    });
    getSignalNode(right).observers.add(() => notifications.push('right later'));
    const batch = createSignalCommitBatch();
    const writer = {};
    batch.stage(left, 3, writer);
    batch.stage(right, 4, writer);

    let failure: unknown;
    try {
      batch.commit();
    } catch (error) {
      failure = error;
    }

    expect(left.get()).toBe(3);
    expect(right.get()).toBe(4);
    expect(notifications).toEqual([
      'left failed',
      'left later',
      'right failed',
      'right later',
    ]);
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toEqual([leftFailure, rightFailure]);
  });

  it('authorizes a staged writer against the exact live lease at commit time', () => {
    const value = signal(1, { debugName: 'commit-owned value' });
    const token = {};
    const lease = acquireProgramWriterLeases(
      track(value, tween({ to: 2, duration: 10 })),
      {},
      {
        token,
        registrationOrder: 1,
        debugName: 'commit owner',
        cancel: () => {},
      },
    );
    const batch = createSignalCommitBatch();
    batch.stage(value, 2, token);

    batch.commit();

    expect(value.get()).toBe(2);
    lease.release();
  });

  it('discards every staged value atomically when one writer lease is stale', () => {
    const leased = signal(1, { debugName: 'stale leased value' });
    const ordinary = signal(10, { debugName: 'ordinary value' });
    const oldToken = {};
    let oldLease: ProgramWriterLease;
    oldLease = acquireProgramWriterLeases(
      track(leased, tween({ to: 2, duration: 10 })),
      {},
      {
        token: oldToken,
        registrationOrder: 1,
        debugName: 'old owner',
        cancel: () => oldLease.release(),
      },
    );
    const batch = createSignalCommitBatch();
    batch.stage(ordinary, 20, oldToken);
    batch.stage(leased, 2, oldToken);
    oldLease.release();
    const replacement = acquireProgramWriterLeases(
      track(leased, tween({ to: 3, duration: 10 })),
      {},
      {
        token: {},
        registrationOrder: 2,
        debugName: 'replacement owner',
        cancel: () => {},
      },
    );

    expect(() => batch.commit()).toThrow(/stale leased value.*replacement owner/iu);

    expect(leased.get()).toBe(1);
    expect(ordinary.get()).toBe(10);
    expect(batch.read(leased)).toBe(1);
    expect(batch.read(ordinary)).toBe(10);
    replacement.release();
  });
});

describe('untracked', () => {
  it('returns its callback value and transparently propagates callback errors', () => {
    const value = signal(1);
    const boom = new Error('callback failed');

    expect(untracked(() => value.get() + 1)).toBe(2);
    expect(() => untracked(() => { throw boom; })).toThrow(boom);
  });

  it('collects ordinary reads with only the innermost collector', () => {
    const value = signal(1);
    const node = getSignalNode(value);
    const outerDependencies: unknown[] = [];
    const innerDependencies: unknown[] = [];

    withSignalTracking({
      addDependency: dependency => outerDependencies.push(dependency),
    }, () => withSignalTracking({
      addDependency: dependency => innerDependencies.push(dependency),
    }, () => value.get()));

    expect(outerDependencies).toEqual([]);
    expect(innerDependencies).toEqual([node]);
  });

  it('suppresses collection and restores the outer collector after return', () => {
    const value = signal(1);
    const node = getSignalNode(value);
    const dependencies: unknown[] = [];

    withSignalTracking({
      addDependency: dependency => dependencies.push(dependency),
    }, () => {
      value.get();
      untracked(() => value.get());
      value.get();
    });

    expect(dependencies).toEqual([node, node]);
  });

  it('restores the outer collector after a suppressed callback throws', () => {
    const value = signal(1);
    const node = getSignalNode(value);
    const boom = new Error('suppressed callback failed');
    const dependencies: unknown[] = [];

    withSignalTracking({
      addDependency: dependency => dependencies.push(dependency),
    }, () => {
      expect(() => untracked(() => {
        value.get();
        throw boom;
      })).toThrow(boom);
      value.get();
    });

    expect(dependencies).toEqual([node]);
  });
});

describe('computed', () => {
  it('is lazy, memoized, and prunes stale dynamic dependencies', () => {
    const chooseLeft = signal(true);
    const left = signal(2);
    const right = signal(20);
    let evaluations = 0;
    const selected = computed(() => {
      evaluations++;
      return chooseLeft.get() ? left.get() : right.get();
    });

    expect(evaluations).toBe(0);
    expect(selected.get()).toBe(2);
    expect(selected.get()).toBe(2);
    expect(evaluations).toBe(1);

    chooseLeft.set(false);
    expect(selected.get()).toBe(20);
    left.set(3);
    expect(selected.get()).toBe(20);
    expect(evaluations).toBe(2);
  });

  it('collects nested computed values and reuses their cached values', () => {
    const count = signal(2);
    let doubledEvaluations = 0;
    const doubled = computed(() => {
      doubledEvaluations++;
      return count.get() * 2;
    });
    const label = computed(() => `value: ${doubled.get()}`);

    expect(label.get()).toBe('value: 4');
    expect(label.get()).toBe('value: 4');
    expect(doubledEvaluations).toBe(1);

    count.set(3);
    expect(label.get()).toBe('value: 6');
    expect(doubledEvaluations).toBe(2);
  });

  it('uses a custom equality function to retain an equal cached result', () => {
    const source = signal({ x: 1, y: 1 });
    let evaluations = 0;
    const x = computed(() => {
      evaluations++;
      return { x: source.get().x };
    }, { equals: (previous, next) => previous.x === next.x });
    const node = getSignalNode(x);

    expect(x.get()).toEqual({ x: 1 });
    source.set({ x: 1, y: 2 });
    expect(x.get()).toEqual({ x: 1 });
    expect(evaluations).toBe(2);
    expect(node.version).toBe(1);
  });

  it('caches a thrown error object and recovers when a dependency changes', () => {
    const enabled = signal(false);
    const boom = new Error('not ready');
    let evaluations = 0;
    const value = computed(() => {
      evaluations++;
      if (!enabled.get()) {
        throw boom;
      }
      return 'ready';
    });

    const thrown: unknown[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        value.get();
      } catch (error) {
        thrown.push(error);
      }
    }
    expect(thrown[0]).toBe(boom);
    expect(thrown[1]).toBe(boom);
    expect(evaluations).toBe(1);

    enabled.set(true);
    expect(value.get()).toBe('ready');
    expect(evaluations).toBe(2);
  });

  it('retains the previous successful value and publishes the cached error when equality throws', () => {
    const source = signal(1);
    const boom = new Error('equality failed');
    const value = computed(() => source.get(), { equals: () => { throw boom; } });
    const node = getSignalNode(value);

    expect(value.get()).toBe(1);
    source.set(2);
    expect(() => value.get()).toThrow(boom);
    expect(node.value).toBe(1);
    expect(node.version).toBe(2);
  });

  it('rejects writes from a computation, including no-op writes', () => {
    const source = signal(1);
    const value = computed(() => {
      source.set(1);
      return source.get();
    });

    expect(() => value.get()).toThrow();
    expect(source.get()).toBe(1);
  });

  it('rejects writes from an equality callback without committing the write', () => {
    const source = signal(1);
    const value = computed(() => source.get(), {
      equals: (previous, next) => {
        source.set(1);
        return previous === next;
      },
    });

    expect(value.get()).toBe(1);
    source.set(2);
    expect(() => value.get()).toThrow();
    expect(source.get()).toBe(2);
  });

  it('caches one direct cycle error without retaining the closing edge', () => {
    let direct: ReturnType<typeof computed<number>>;
    direct = computed(() => direct.get(), { debugName: 'direct' });

    const firstFailure = captureFailure(() => direct.get());
    const secondFailure = captureFailure(() => direct.get());

    expect(firstFailure).toBeInstanceOf(Error);
    expect(firstFailure).not.toBeInstanceOf(RangeError);
    expect((firstFailure as Error).message).toBe(
      'CRC computed cycle: direct -> direct',
    );
    expect(secondFailure).toBe(firstFailure);
    expect(getSignalNode(direct).observers.size).toBe(0);
  });

  it('caches one indirect cycle error without retaining the back edge', () => {
    let first: ReturnType<typeof computed<number>>;
    let second: ReturnType<typeof computed<number>>;
    first = computed(() => second.get(), { debugName: 'first' });
    second = computed(() => first.get(), { debugName: 'second' });

    const firstFailure = captureFailure(() => first.get());
    const secondFailure = captureFailure(() => first.get());

    expect(firstFailure).toBeInstanceOf(Error);
    expect(firstFailure).not.toBeInstanceOf(RangeError);
    expect((firstFailure as Error).message).toBe(
      'CRC computed cycle: first -> second -> first',
    );
    expect(secondFailure).toBe(firstFailure);
    expect(getSignalNode(first).observers.size).toBe(0);
    expect(getSignalNode(second).observers.size).toBe(0);
  });

  it('recovers guarded direct and indirect cycles after the guard changes', () => {
    const directGuard = signal(true);
    let direct: ReturnType<typeof computed<number>>;
    direct = computed(
      () => directGuard.get() ? direct.get() : 7,
      { debugName: 'guarded direct' },
    );
    expect(() => direct.get()).toThrow(
      'CRC computed cycle: guarded direct -> guarded direct',
    );

    const indirectGuard = signal(true);
    let first: ReturnType<typeof computed<number>>;
    let second: ReturnType<typeof computed<number>>;
    first = computed(() => second.get(), { debugName: 'guarded first' });
    second = computed(
      () => indirectGuard.get() ? first.get() : 11,
      { debugName: 'guarded second' },
    );
    expect(() => first.get()).toThrow(
      'CRC computed cycle: guarded first -> guarded second -> guarded first',
    );

    directGuard.set(false);
    indirectGuard.set(false);

    expect(direct.get()).toBe(7);
    expect(first.get()).toBe(11);
    expect(second.get()).toBe(11);
  });

  it('does not assign promise-continuation reads to a completed computation', async () => {
    const source = signal(1);
    let evaluations = 0;
    const value = computed(() => {
      evaluations++;
      Promise.resolve().then(() => source.get());
      return evaluations * 2;
    });
    const dependencies: unknown[] = [];

    withSignalTracking({
      addDependency: dependency => dependencies.push(dependency),
    }, () => value.get());
    await Promise.resolve();

    expect(dependencies).toEqual([getSignalNode(value)]);
    source.set(3);
    expect(value.get()).toBe(2);
    expect(evaluations).toBe(1);
  });

  it('evaluates every branch of an observed diamond once per source update', () => {
    const source = signal(1);
    let leftEvaluations = 0;
    let rightEvaluations = 0;
    let joinedEvaluations = 0;
    const left = computed(() => {
      leftEvaluations++;
      return source.get() * 2;
    });
    const right = computed(() => {
      rightEvaluations++;
      return source.get() * 3;
    });
    const joined = computed(() => {
      joinedEvaluations++;
      return left.get() + right.get();
    });
    const observe = getSignalNode(joined).observe;
    if (observe === undefined) {
      throw new Error('Expected computed signals to support internal observation.');
    }
    const detach = observe();

    flushPendingComputedValidations();
    expect([leftEvaluations, rightEvaluations, joinedEvaluations]).toEqual([1, 1, 1]);

    source.set(2);
    flushPendingComputedValidations();
    expect([leftEvaluations, rightEvaluations, joinedEvaluations]).toEqual([2, 2, 2]);

    detach();
  });

  it('validates observed computed values dependency-first and stops after detach', () => {
    const source = signal(1);
    let innerEvaluations = 0;
    let outerEvaluations = 0;
    const inner = computed(() => {
      innerEvaluations++;
      return source.get() * 2;
    });
    const outer = computed(() => {
      outerEvaluations++;
      return inner.get() + 1;
    });
    const observe = getSignalNode(outer).observe;
    if (observe === undefined) {
      throw new Error('Expected computed signals to support internal observation.');
    }
    const detach = observe();

    flushPendingComputedValidations();
    expect([innerEvaluations, outerEvaluations]).toEqual([1, 1]);

    source.set(2);
    flushPendingComputedValidations();
    expect([innerEvaluations, outerEvaluations]).toEqual([2, 2]);

    detach();
    source.set(3);
    flushPendingComputedValidations();
    expect([innerEvaluations, outerEvaluations]).toEqual([2, 2]);
  });

  it('drains independent observed computeds when an earlier value fails', () => {
    const failingSource = signal(0);
    const healthySource = signal(0);
    const computationFailure = new Error('observed computation failed');
    let healthyEvaluations = 0;
    const failing = computed(() => {
      if (failingSource.get() > 0) throw computationFailure;
      return 0;
    });
    const healthy = computed(() => {
      healthyEvaluations++;
      return healthySource.get() + 1;
    });
    expect(failing.get()).toBe(0);
    expect(healthy.get()).toBe(1);
    const detachFailing = getSignalNode(failing).observe!();
    const detachHealthy = getSignalNode(healthy).observe!();

    failingSource.set(1);
    healthySource.set(1);

    expect(() => flushPendingComputedValidations()).not.toThrow();
    expect(healthyEvaluations).toBe(2);
    expect(healthy.get()).toBe(2);
    expect(captureFailure(() => failing.get())).toBe(computationFailure);
    expect(signalGraphSnapshot().pendingComputedValidations).toBe(0);

    detachFailing();
    detachHealthy();
  });

  it('leases computed source edges only while observed and validates retained values by version', () => {
    const baseline = signalGraphSnapshot();
    const source = signal(2);
    const doubled = computed(() => source.get() * 2);

    expect(doubled.get()).toBe(4);
    expect(getSignalNode(source).observers.size).toBe(0);
    expect(signalGraphSnapshot().computedSourceEdges).toBe(
      baseline.computedSourceEdges,
    );

    const detach = getSignalNode(doubled).observe!();
    expect(getSignalNode(source).observers.size).toBe(1);
    expect(signalGraphSnapshot()).toMatchObject({
      computedSourceEdges: baseline.computedSourceEdges + 1,
      createdComputedSourceEdges: baseline.createdComputedSourceEdges + 1,
    });

    detach();
    expect(getSignalNode(source).observers.size).toBe(0);
    expect(signalGraphSnapshot()).toMatchObject({
      computedSourceEdges: baseline.computedSourceEdges,
      releasedComputedSourceEdges: baseline.releasedComputedSourceEdges + 1,
    });

    source.set(3);
    expect(doubled.get()).toBe(6);
    expect(getSignalNode(source).observers.size).toBe(0);
  });

  it('clears queued Plan work when an explicit observed read validates it', () => {
    const source = signal(1);
    const parity = computed(() => source.get() % 2);
    expect(parity.get()).toBe(1);
    const detach = getSignalNode(parity).observe!();

    source.set(3);
    expect(signalGraphSnapshot().pendingComputedValidations).toBe(1);

    expect(parity.get()).toBe(1);
    expect(signalGraphSnapshot().pendingComputedValidations).toBe(0);

    detach();
  });

  it('recursively acquires and releases nested computed source edges', () => {
    const baseline = signalGraphSnapshot();
    const source = signal(1);
    const inner = computed(() => source.get() + 1);
    const outer = computed(() => inner.get() + 1);
    expect(outer.get()).toBe(3);

    const detach = getSignalNode(outer).observe!();
    expect(signalGraphSnapshot().computedSourceEdges).toBe(
      baseline.computedSourceEdges + 2,
    );
    expect(getSignalNode(source).observers.size).toBe(1);
    expect(getSignalNode(inner).observers.size).toBe(1);

    detach();
    expect(signalGraphSnapshot()).toMatchObject({
      computedSourceEdges: baseline.computedSourceEdges,
      createdComputedSourceEdges: baseline.createdComputedSourceEdges + 2,
      releasedComputedSourceEdges: baseline.releasedComputedSourceEdges + 2,
    });
    expect(getSignalNode(source).observers.size).toBe(0);
    expect(getSignalNode(inner).observers.size).toBe(0);
  });

  it('replaces observed computed source-edge leases after dependency switching', () => {
    const baseline = signalGraphSnapshot();
    const chooseLeft = signal(true);
    const left = signal(1);
    const right = signal(10);
    const selected = computed(() => chooseLeft.get() ? left.get() : right.get());
    expect(selected.get()).toBe(1);
    const detach = getSignalNode(selected).observe!();

    expect(getSignalNode(chooseLeft).observers.size).toBe(1);
    expect(getSignalNode(left).observers.size).toBe(1);
    expect(getSignalNode(right).observers.size).toBe(0);

    chooseLeft.set(false);
    flushPendingComputedValidations();

    expect(selected.get()).toBe(10);
    expect(getSignalNode(left).observers.size).toBe(0);
    expect(getSignalNode(right).observers.size).toBe(1);
    expect(signalGraphSnapshot()).toMatchObject({
      computedSourceEdges: baseline.computedSourceEdges + 2,
      createdComputedSourceEdges: baseline.createdComputedSourceEdges + 3,
      releasedComputedSourceEdges: baseline.releasedComputedSourceEdges + 1,
    });

    detach();
    expect(signalGraphSnapshot()).toMatchObject({
      computedSourceEdges: baseline.computedSourceEdges,
      releasedComputedSourceEdges: baseline.releasedComputedSourceEdges + 3,
    });
  });
});

function captureFailure(callback: () => unknown): unknown {
  try {
    callback();
  } catch (error) {
    return error;
  }
  throw new Error('Expected callback to throw.');
}

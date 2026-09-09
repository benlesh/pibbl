import { describe, expect, it } from 'vitest';
import {
  computed,
  isSignal,
  signal,
  untracked,
  type SignalEquals,
} from '../../index';
import {
  flushPendingComputedValidations,
  createSignalCommitBatch,
  getSignalNode,
  withSignalTracking,
  withSignalWriteForbidden,
  withSignalWritePolicy,
} from './graph';

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

  it('retains the previous successful value when equality throws', () => {
    const source = signal(1);
    const boom = new Error('equality failed');
    const value = computed(() => source.get(), { equals: () => { throw boom; } });
    const node = getSignalNode(value);

    expect(value.get()).toBe(1);
    source.set(2);
    expect(() => value.get()).toThrow(boom);
    expect(node.value).toBe(1);
    expect(node.version).toBe(1);
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

  it('reports direct and indirect computed cycles with the debug-name path', () => {
    let direct: ReturnType<typeof computed<number>>;
    direct = computed(() => direct.get(), { debugName: 'direct' });
    let first: ReturnType<typeof computed<number>>;
    let second: ReturnType<typeof computed<number>>;
    first = computed(() => second.get(), { debugName: 'first' });
    second = computed(() => first.get(), { debugName: 'second' });

    expect(() => direct.get()).toThrow('CRC computed cycle: direct -> direct');
    expect(() => first.get()).toThrow(
      'CRC computed cycle: first -> second -> first',
    );
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
});

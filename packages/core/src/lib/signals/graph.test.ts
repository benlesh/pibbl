import { describe, expect, it } from 'vitest';
import {
  isSignal,
  signal,
  untracked,
  type SignalEquals,
} from '../../index';
import {
  getSignalNode,
  withSignalTracking,
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

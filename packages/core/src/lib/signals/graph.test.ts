import { describe, expect, it } from 'vitest';
import {
  isSignal,
  signal,
  untracked,
  type SignalEquals,
} from '../../index';
import { getSignalNode } from './graph';

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
});

describe('untracked', () => {
  it('returns its callback value and transparently propagates callback errors', () => {
    const value = signal(1);
    const boom = new Error('callback failed');

    expect(untracked(() => value.get() + 1)).toBe(2);
    expect(() => untracked(() => { throw boom; })).toThrow(boom);
  });
});

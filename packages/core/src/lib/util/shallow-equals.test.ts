import { describe, expect, it } from 'vitest';
import { shallowEquals } from './shallow-equals';

describe('shallowEquals', () => {
  it('should return true for identical primitive values', () => {
    expect(shallowEquals(1, 1)).toBe(true);
    expect(shallowEquals('test', 'test')).toBe(true);
    expect(shallowEquals(true, true)).toBe(true);
    expect(shallowEquals(null, null)).toBe(true);
    expect(shallowEquals(undefined, undefined)).toBe(true);
  });

  it('should return true for empty objects', () => {
    expect(shallowEquals({}, {})).toBe(true);
  });

  it('should return true for objects with same primitive properties', () => {
    expect(shallowEquals(
      { a: 1, b: 'test', c: true },
      { a: 1, b: 'test', c: true },
    )).toBe(true);
  });

  it.todo('should return false for different primitive values', () => {
    expect(shallowEquals(1, 2)).toBe(false);
    expect(shallowEquals('test', 'different')).toBe(false);
    expect(shallowEquals(true, false)).toBe(false);
    expect(shallowEquals(null, undefined)).toBe(false);
  });

  it('should return false for objects with different number of properties', () => {
    expect(shallowEquals(
      { a: 1, b: 2 },
      { a: 1 },
    )).toBe(false);
  });

  it('should return false for objects with different property values', () => {
    expect(shallowEquals(
      { a: 1, b: 2 },
      { a: 1, b: 3 },
    )).toBe(false);
  });

  it('should perform shallow comparison for nested objects', () => {
    const obj1 = { a: { nested: 1 } };
    const obj2 = { a: { nested: 1 } };
    const obj3 = { a: obj1.a };

    // Different object references with same content should be false
    expect(shallowEquals(obj1, obj2)).toBe(false);

    // Same object reference should be true
    expect(shallowEquals(obj1, obj3)).toBe(true);
  });

  it('should handle arrays as values', () => {
    const arr = [1, 2, 3];

    // Same array reference should be true
    expect(shallowEquals(
      { arr },
      { arr },
    )).toBe(true);

    // Different array reference should be false, even with same content
    expect(shallowEquals(
      { arr: [1, 2, 3] },
      { arr: [1, 2, 3] },
    )).toBe(false);
  });
});

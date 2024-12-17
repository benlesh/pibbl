import { describe, expect, it } from 'vitest';
import { shallowArrayEquals } from './shallow-array-equals';

describe('shallowArrayEquals', () => {
  it('should return true for identical primitive arrays', () => {
    expect(shallowArrayEquals([], [])).toBe(true);
    expect(shallowArrayEquals([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(shallowArrayEquals(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true);
    expect(shallowArrayEquals([true, false], [true, false])).toBe(true);
  });

  it('should return false for arrays with different lengths', () => {
    expect(shallowArrayEquals([1, 2, 3], [1, 2])).toBe(false);
    expect(shallowArrayEquals([1], [1, 2])).toBe(false);
    expect(shallowArrayEquals([], [1])).toBe(false);
  });

  it('should return false for arrays with different elements', () => {
    expect(shallowArrayEquals([1, 2, 3], [1, 2, 4])).toBe(false);
    expect(shallowArrayEquals(['a', 'b', 'c'], ['a', 'b', 'd'])).toBe(false);
    expect(shallowArrayEquals([true, false], [false, true])).toBe(false);
  });

  it('should perform shallow comparison for object arrays', () => {
    const obj1 = { id: 1 };
    const obj2 = { id: 2 };
    const obj3 = { id: 1 }; // Same content as obj1 but different reference

    // Same references should be equal
    expect(shallowArrayEquals([obj1, obj2], [obj1, obj2])).toBe(true);

    // Different references with same content should be false (shallow comparison)
    expect(shallowArrayEquals([obj1], [obj3])).toBe(false);
  });

  it('should handle mixed type arrays', () => {
    expect(shallowArrayEquals([1, 'a', true], [1, 'a', true])).toBe(true);
    expect(shallowArrayEquals([1, 'a', true], [1, 'a', false])).toBe(false);
  });
});

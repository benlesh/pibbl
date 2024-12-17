import { describe, expect, it } from 'vitest';
import { typedEntries } from './typed-entries';

describe('typedEntries', () => {
  it('should be a wrapper around Object.entries but adds type safety', () => {
    const obj = {
      name: 'test',
      age: 25,
      active: true,
    };

    const entries = typedEntries(obj);

    expect(entries).toEqual([
      ['name', 'test'],
      ['age', 25],
      ['active', true],
    ]);

    expect(entries[0]).toEqual(['name', 'test']);
    expect(entries[1]).toEqual(['age', 25]);
    expect(entries[2]).toEqual(['active', true]);

    expect(Object.entries(obj)).toEqual(entries);
  });

  it('should handle empty object', () => {
    expect(typedEntries({})).toEqual([]);
  });

  it('should handle nested objects', () => {
    const obj = {
      user: {
        name: 'test',
        age: 25,
      },
      settings: {
        theme: 'dark',
      },
    };

    expect(typedEntries(obj)).toEqual([
      ['user', { name: 'test', age: 25 }],
      ['settings', { theme: 'dark' }],
    ]);
  });

  it('should preserve literal types', () => {
    const obj = {
      status: 'active',
      count: 42,
    };

    expect(typedEntries(obj)).toEqual([
      ['status', 'active'],
      ['count', 42],
    ]);
  });

  it('should handle array values', () => {
    const obj = {
      tags: ['a', 'b', 'c'],
      scores: [1, 2, 3],
    };

    expect(typedEntries(obj)).toEqual([
      ['tags', ['a', 'b', 'c']],
      ['scores', [1, 2, 3]],
    ]);
  });
});

import { describe, expectTypeOf, it } from 'vitest';
import { typedEntries } from './typed-entries';

describe('typedEntries types', () => {
  it('should have correct return type for simple object', () => {
    const obj = {
      name: 'test',
      age: 25,
      active: true,
    };

    expectTypeOf(typedEntries(obj)).toEqualTypeOf<Array<['name' | 'age' | 'active', string | number | boolean]>>();
  });

  it('should have correct return type for nested object', () => {
    const obj = {
      user: { name: 'test' },
      settings: { theme: 'light' },
    };

    expectTypeOf(typedEntries(obj)).toEqualTypeOf<Array<['user' | 'settings', { name: string } | { theme: string }]>>();
  });

  it('should error on invalid input types', () => {
    const obj = {
      name: 'test',
    };

    // @ts-expect-error - number is not assignable to string
    typedEntries(obj).find(([_, value]) => value === 123);
  });
});

import { describe, expect, it } from 'vitest';
import {
  particleChoice,
  particleCurve,
  particleGradient,
  particleInteger,
  particleParameter,
  particleRange,
} from '../index.js';
import { particle } from './particle.js';

describe('particle value descriptors', () => {
  it('exports descriptor factories individually for tree shaking', () => {
    expect(particleRange(1, 2)).toEqual({ type: 'between', min: 1, max: 2 });
    expect(particleInteger(1, 2)).toEqual({ type: 'integer', min: 1, max: 2 });
    expect(particleChoice([{ value: 'red', weight: 1 }])).toMatchObject({
      type: 'choice',
    });
    expect(particleParameter('wind')).toEqual({ type: 'parameter', name: 'wind' });
    expect(particleCurve([[0, 0], [1, 1]])).toMatchObject({ type: 'curve' });
    expect(particleGradient([[0, '#000'], [1, '#fff']])).toMatchObject({
      type: 'gradient',
    });
  });

  it('preserves continuous and inclusive integer endpoints in frozen descriptors', () => {
    const between = particle.between(-2.5, 7.25);
    const integer = particle.integer(-2, 7);

    expect(between).toEqual({ type: 'between', min: -2.5, max: 7.25 });
    expect(integer).toEqual({ type: 'integer', min: -2, max: 7 });
    expect(Object.isFrozen(between)).toBe(true);
    expect(Object.isFrozen(integer)).toBe(true);
  });

  it.each([
    ['between', 'particleRange', Number.NaN, 1],
    ['between', 'particleRange', 0, Number.POSITIVE_INFINITY],
    ['between', 'particleRange', 2, 1],
    ['integer', 'particleInteger', 0.5, 2],
    ['integer', 'particleInteger', 0, Number.NEGATIVE_INFINITY],
    ['integer', 'particleInteger', 3, 2],
  ] as const)('rejects invalid %s bounds %s through %s', (kind, factoryName, min, max) => {
    expect(() => particle[kind](min, max)).toThrowError(
      new RegExp(`${factoryName}.*(?:min|max|bounds)`, 'i'),
    );
  });

  it('rejects a continuous span that cannot be sampled finitely', () => {
    expect(() => particle.between(-Number.MAX_VALUE, Number.MAX_VALUE))
      .toThrowError(/particleRange.*span.*finite/i);
  });

  it('rejects an inclusive integer span that is not a safe integer', () => {
    expect(() => particle.integer(-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER))
      .toThrowError(/particleInteger.*span.*safe integer/i);
  });

  it('copies and deeply freezes weighted choices', () => {
    const first = { value: [1, 2] as number[], weight: 1 };
    const choices = [first, { value: [3, 4], weight: 2 }];
    const descriptor = particle.choice(choices);

    first.weight = 99;
    first.value[0] = 99;
    choices.push({ value: [5, 6], weight: 3 });

    expect(descriptor.choices).toEqual([
      { value: [1, 2], weight: 1 },
      { value: [3, 4], weight: 2 },
    ]);
    expect(Object.isFrozen(descriptor)).toBe(true);
    expect(Object.isFrozen(descriptor.choices)).toBe(true);
    expect(Object.isFrozen(descriptor.choices[0])).toBe(true);
    expect(Object.isFrozen(descriptor.choices[0]!.value)).toBe(true);
  });

  it('rejects empty choices and nonpositive or nonfinite weights', () => {
    expect(() => particle.choice([])).toThrowError(/particleChoice.*nonempty/i);
    for (const weight of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => particle.choice([{ value: 'x', weight }])).toThrowError(
        /particleChoice.*weight/i,
      );
    }
    expect(() => particle.choice([
      { value: 'first', weight: Number.MAX_VALUE },
      { value: 'second', weight: Number.MAX_VALUE },
    ])).toThrowError(/particleChoice.*total weight.*finite/i);
  });

  it('creates named parameter references and rejects empty names', () => {
    const reference = particle.parameter('wind');

    expect(reference).toEqual({ type: 'parameter', name: 'wind' });
    expect(Object.isFrozen(reference)).toBe(true);
    expect(() => particle.parameter('')).toThrowError(/particleParameter.*name/i);
    expect(() => particle.parameter('   ')).toThrowError(/particleParameter.*name/i);
  });

  it('copies and deeply freezes curves and gradients without changing key order', () => {
    const curveKeys: [number, [number, number]][] = [
      [0, [1, 2]],
      [1, [3, 4]],
    ];
    const gradientKeys: [number, string][] = [[0, '#000'], [1, '#fff']];
    const curve = particle.curve(curveKeys);
    const gradient = particle.gradient(gradientKeys);

    curveKeys[0]![1][0] = 99;
    curveKeys.push([0.5, [5, 6]]);
    gradientKeys[0]![1] = 'red';

    expect(curve.keys).toEqual([[0, [1, 2]], [1, [3, 4]]]);
    expect(gradient.keys).toEqual([[0, '#000'], [1, '#fff']]);
    expect(Object.isFrozen(curve.keys[0]![1])).toBe(true);
    expect(Object.isFrozen(gradient.keys[0])).toBe(true);
  });

  it.each([
    [[], 'nonempty'],
    [[[0.1, 0], [1, 1]], '0'],
    [[[0, 0], [0, 1], [1, 2]], 'increasing'],
    [[[0, 0], [Number.NaN, 1], [1, 2]], 'finite'],
    [[[0, 0], [1, [1, 2]]], 'dimension'],
  ] as const)('rejects invalid curve keys %#', (keys, expected) => {
    expect(() => particle.curve(keys as never)).toThrowError(
      new RegExp(`particleCurve.*${expected}`, 'i'),
    );
  });
});

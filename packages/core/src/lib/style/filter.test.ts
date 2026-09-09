import { describe, expect, it } from 'vitest';
import type { CRCFilter } from './filter-types';
import {
  compileFilterList,
  getResolvedFilterList,
  resolveFilterList,
} from './filter';
import type { StyleResolutionContext, SystemStyle } from '../types';

const context: StyleResolutionContext = {
  allocation: { x: 0, y: 0, width: 400, height: 200 },
  percentageBasis: { x: 0, y: 0, width: 400, height: 200 },
  constraints: { minWidth: 0, maxWidth: 400, minHeight: 0, maxHeight: 200 },
  component: 'FilterProbe',
  algorithm: 'render-dispatch',
};

describe('filter lists', () => {
  it('normalizes and compiles the representative ordered list', () => {
    const resolved = resolveFilterList(
      [
        { type: 'grayscale', amount: 2 },
        {
          type: 'dropShadow',
          offsetX: 4,
          offsetY: -6,
          blurRadius: 3,
          color: 'rgb(0 0 0 / 50%)',
        },
        { type: 'hueRotate', degrees: -450 },
      ],
      context,
    );

    expect(resolved?.values).toEqual([
      { type: 'grayscale', amount: 1 },
      {
        type: 'dropShadow',
        offsetX: 4,
        offsetY: -6,
        blurRadius: 3,
        color: 'rgb(0 0 0 / 50%)',
      },
      { type: 'hueRotate', degrees: -450 },
    ]);
    expect(compileFilterList(resolved!, 2)).toBe(
      'grayscale(1) drop-shadow(8px -12px 6px rgb(0 0 0 / 50%)) hue-rotate(-450deg)',
    );
  });

  it('normalizes one descriptor to a list and treats an empty list as absent', () => {
    const single = resolveFilterList({ type: 'blur', radius: 3 }, context);

    expect(single?.values).toEqual([{ type: 'blur', radius: 3 }]);
    expect(resolveFilterList([], context)).toBeUndefined();
  });

  it.each([
    [{ type: 'blur', radius: 3 }, 'blur(6px)'],
    [{ type: 'brightness', amount: 1.5 }, 'brightness(1.5)'],
    [{ type: 'contrast', amount: 1.5 }, 'contrast(1.5)'],
    [
      { type: 'dropShadow', offsetX: 4, offsetY: -6, color: 'black' },
      'drop-shadow(8px -12px 0px black)',
    ],
    [{ type: 'grayscale', amount: 0.5 }, 'grayscale(0.5)'],
    [{ type: 'hueRotate', degrees: -90 }, 'hue-rotate(-90deg)'],
    [{ type: 'invert', amount: 0.5 }, 'invert(0.5)'],
    [{ type: 'opacity', amount: 0.5 }, 'opacity(0.5)'],
    [{ type: 'saturate', amount: 1.5 }, 'saturate(1.5)'],
    [{ type: 'sepia', amount: 0.5 }, 'sepia(0.5)'],
  ] as const)(
    'normalizes and compiles %o',
    (value: CRCFilter, expected: string) => {
      const resolved = resolveFilterList(value, context)!;

      expect(compileFilterList(resolved, 2)).toBe(expected);
    },
  );

  it('defaults a drop-shadow blur radius and preserves or clamps amounts by filter kind', () => {
    const resolved = resolveFilterList(
      [
        { type: 'dropShadow', offsetX: 1, offsetY: 2, color: 'black' },
        { type: 'brightness', amount: 2 },
        { type: 'contrast', amount: 2 },
        { type: 'saturate', amount: 2 },
        { type: 'grayscale', amount: 2 },
        { type: 'invert', amount: 2 },
        { type: 'opacity', amount: 2 },
        { type: 'sepia', amount: 2 },
      ],
      context,
    )!;

    expect(resolved.values).toEqual([
      { type: 'dropShadow', offsetX: 1, offsetY: 2, blurRadius: 0, color: 'black' },
      { type: 'brightness', amount: 2 },
      { type: 'contrast', amount: 2 },
      { type: 'saturate', amount: 2 },
      { type: 'grayscale', amount: 1 },
      { type: 'invert', amount: 1 },
      { type: 'opacity', amount: 1 },
      { type: 'sepia', amount: 1 },
    ]);
  });

  it('does not mutate caller-owned lists or descriptors and returns immutable normalized values', () => {
    const descriptor: CRCFilter = { type: 'grayscale', amount: 2 };
    const values = [descriptor] as const;

    const resolved = resolveFilterList(values, context)!;

    expect(values).toEqual([{ type: 'grayscale', amount: 2 }]);
    expect(resolved.values).not.toBe(values);
    expect(resolved.values[0]).not.toBe(descriptor);
    expect(Object.isFrozen(resolved)).toBe(true);
    expect(Object.isFrozen(resolved.values)).toBe(true);
    expect(Object.isFrozen(resolved.values[0])).toBe(true);
  });

  it.each([
    [{ type: 'blur', radius: -1 }, 'filter.radius', 'nonnegative'],
    [{ type: 'blur', radius: Number.NaN }, 'filter.radius', 'finite'],
    [{ type: 'brightness', amount: -1 }, 'filter.amount', 'nonnegative'],
    [{ type: 'dropShadow', offsetX: Number.POSITIVE_INFINITY, offsetY: 0, color: 'black' }, 'filter.offsetX', 'finite'],
    [{ type: 'dropShadow', offsetX: 0, offsetY: 0, blurRadius: -1, color: 'black' }, 'filter.blurRadius', 'nonnegative'],
    [{ type: 'hueRotate', degrees: Number.NEGATIVE_INFINITY }, 'filter.degrees', 'finite'],
  ] as const)(
    'rejects invalid numeric filter values',
    (value, property, reason) => {
      expect(() => resolveFilterList(value as CRCFilter, context)).toThrow(
        new RegExp(`${property}.*${reason}`),
      );
    },
  );

  it('rejects an explicitly null drop-shadow blur radius', () => {
    expect(() => resolveFilterList({
      type: 'dropShadow',
      offsetX: 0,
      offsetY: 0,
      blurRadius: null,
      color: 'black',
    } as unknown as CRCFilter, context)).toThrow(/filter\.blurRadius.*finite/);
  });

  it('reports indexed property paths and unsupported discriminators', () => {
    expect(() => resolveFilterList([
      { type: 'blur', radius: 1 },
      { type: 'sepia', amount: 1 },
      { type: 'grayscale', amount: -1 },
    ], context)).toThrow(/filter\[2\]\.amount.*nonnegative/);
    expect(() => resolveFilterList(
      { type: 'url', value: '#unsupported' } as unknown as CRCFilter,
      context,
    )).toThrow(/filter\.type.*unsupported/);
  });

  it.each([
    'currentColor',
    'CURRENTcolor',
    'var(--shadow)',
    'VAR(--shadow)',
    'env(--shadow, red)',
    'attr(data-shadow type(<color>), red)',
    'inherit(--shadow, red)',
    'if(style(--dark): white; else: black)',
    'light-dark(red, blue)',
    'color-mix(in srgb, light-dark(red, blue), black)',
    'l\\69 ght-dark(red, blue)',
  ])(
    'rejects contextual drop-shadow color %s',
    color => {
      expect(() => resolveFilterList({
        type: 'dropShadow', offsetX: 0, offsetY: 0, color,
      }, context)).toThrow(/filter\.color.*contextual/);
    },
  );

  it.each([
    'red) blur(100px',
    'rgb(0 0 0',
    'color-mix(in srgb, red, blue]]',
  ])('rejects color %s that escapes its balanced token boundary', color => {
    expect(() => resolveFilterList({
      type: 'dropShadow', offsetX: 0, offsetY: 0, color,
    }, context)).toThrow(/filter\.color.*balanced.*boundary/i);
  });

  it('ignores contextual names and delimiters inside comments, strings, and escapes', () => {
    const colors = [
      'red /* currentColor light-dark(red, blue) ) */',
      'color-mix(in srgb, red, "currentColor)")',
      'r\\29 ed',
    ];

    for (const color of colors) {
      expect(resolveFilterList({
        type: 'dropShadow', offsetX: 0, offsetY: 0, color,
      }, context)?.values[0]).toMatchObject({ color });
    }
  });

  it('does not classify contextual-keyword substrings as contextual tokens', () => {
    const colors = ['currentColorful', 'CanvasTexture', 'Marking'];

    for (const color of colors) {
      expect(resolveFilterList({
        type: 'dropShadow', offsetX: 0, offsetY: 0, color,
      }, context)?.values[0]).toMatchObject({ color });
    }
  });

  it('gets an already-resolved nonempty filter list from system style', () => {
    const resolved = resolveFilterList({ type: 'blur', radius: 2 }, context)!;
    const style: SystemStyle = { filter: resolved.values };

    expect(getResolvedFilterList(style)?.values).toBe(resolved.values);
    expect(getResolvedFilterList({ filter: [] })).toBeUndefined();
  });
});

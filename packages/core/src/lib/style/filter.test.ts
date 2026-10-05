import { compileNativeFilters, type NativePreparedFilter } from '../../filters/native-operations';
import { grayscale, dropShadow, hueRotate, blur, brightness, contrast, invert, opacity, saturate, sepia } from '@pibbl/core/filters';
import { describe, expect, it } from 'vitest';
import type { PibblFilter } from './filter-types';
import {
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
        grayscale({ amount: 2 }),
        dropShadow({ offsetX: 4, offsetY: -6, blurRadius: 3, color: 'rgb(0 0 0 / 50%)' }),
        hueRotate({ degrees: -450 }),
      ],
      context,
    );

    expect(compileNativeFilters(resolved!.values as readonly NativePreparedFilter[], 2)).toBe(
      'grayscale(1) drop-shadow(8px -12px 6px rgb(0 0 0 / 50%)) hue-rotate(-450deg)',
    );
  });

  it('normalizes one descriptor to a list and treats an empty list as absent', () => {
    const single = resolveFilterList(blur({ radius: 3 }), context);

    expect(compileNativeFilters(single!.values as readonly NativePreparedFilter[], 1)).toBe('blur(3px)');
    expect(resolveFilterList([], context)).toBeUndefined();
  });

  it.each([
    [blur({ radius: 3 }), 'blur(6px)'],
    [brightness({ amount: 1.5 }), 'brightness(1.5)'],
    [contrast({ amount: 1.5 }), 'contrast(1.5)'],
    [
      dropShadow({ offsetX: 4, offsetY: -6, color: 'black' }),
      'drop-shadow(8px -12px 0px black)',
    ],
    [grayscale({ amount: 0.5 }), 'grayscale(0.5)'],
    [hueRotate({ degrees: -90 }), 'hue-rotate(-90deg)'],
    [invert({ amount: 0.5 }), 'invert(0.5)'],
    [opacity({ amount: 0.5 }), 'opacity(0.5)'],
    [saturate({ amount: 1.5 }), 'saturate(1.5)'],
    [sepia({ amount: 0.5 }), 'sepia(0.5)'],
  ] as const)(
    'normalizes and compiles %o',
    (value: PibblFilter, expected: string) => {
      const resolved = resolveFilterList(value, context)!;

      expect(compileNativeFilters(resolved.values as readonly NativePreparedFilter[], 2)).toBe(expected);
    },
  );

  it('defaults a drop-shadow blur radius and preserves or clamps amounts by filter kind', () => {
    const resolved = resolveFilterList(
      [
        dropShadow({ offsetX: 1, offsetY: 2, color: 'black' }),
        brightness({ amount: 2 }),
        contrast({ amount: 2 }),
        saturate({ amount: 2 }),
        grayscale({ amount: 2 }),
        invert({ amount: 2 }),
        opacity({ amount: 2 }),
        sepia({ amount: 2 }),
      ],
      context,
    )!;

    expect(compileNativeFilters(resolved.values as readonly NativePreparedFilter[], 1)).toBe(
      'drop-shadow(1px 2px 0px black) brightness(2) contrast(2) saturate(2) grayscale(1) invert(1) opacity(1) sepia(1)',
    );
  });

  it('does not mutate caller-owned lists or descriptors and returns immutable normalized values', () => {
    const descriptor: PibblFilter = grayscale({ amount: 2 });
    const values = [descriptor] as const;

    const resolved = resolveFilterList(values, context)!;

    expect(values[0]).toBe(descriptor);
    expect(resolved.values).not.toBe(values);
    expect(resolved.values[0]).not.toBe(descriptor);
    expect(Object.isFrozen(resolved)).toBe(true);
    expect(Object.isFrozen(resolved.values)).toBe(true);
    expect(Object.isFrozen(resolved.values[0])).toBe(true);
  });

  it.each([
    [blur({ radius: -1 }), 'filter.radius', 'nonnegative'],
    [blur({ radius: Number.NaN }), 'filter.radius', 'finite'],
    [brightness({ amount: -1 }), 'filter.amount', 'nonnegative'],
    [dropShadow({ offsetX: Number.POSITIVE_INFINITY, offsetY: 0, color: 'black' }), 'filter.offsetX', 'finite'],
    [dropShadow({ offsetX: 0, offsetY: 0, blurRadius: -1, color: 'black' }), 'filter.blurRadius', 'nonnegative'],
    [hueRotate({ degrees: Number.NEGATIVE_INFINITY }), 'filter.degrees', 'finite'],
  ] as const)(
    'rejects invalid numeric filter values',
    (value, property, reason) => {
      expect(() => resolveFilterList(value as PibblFilter, context)).toThrow(
        new RegExp(`${property}.*${reason}`),
      );
    },
  );

  it('rejects an explicitly null drop-shadow blur radius', () => {
    expect(() => resolveFilterList(dropShadow({ offsetX: 0, offsetY: 0, blurRadius: null as unknown as number, color: 'black' }) as unknown as PibblFilter, context)).toThrow(/filter\.blurRadius.*finite/);
  });

  it('reports indexed property paths and unsupported discriminators', () => {
    expect(() => resolveFilterList([
      blur({ radius: 1 }),
      sepia({ amount: 1 }),
      grayscale({ amount: -1 }),
    ], context)).toThrow(/filter\[2\]\.amount.*nonnegative/);
    expect(() => resolveFilterList(
      { type: 'url', value: '#unsupported' } as unknown as PibblFilter,
      context,
    )).toThrow(/filter.*removed descriptor.*@pibbl\/core\/filters/);
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
    '-webkit-link',
    '-WEBKIT-LINK',
    '-webkit-activelink',
    '-WebKit-ActiveLink',
    '-\\77 ebkit-link',
    '-webkit-active\\6c ink',
    'color-mix(in srgb, -webkit-link, red)',
  ])(
    'rejects contextual drop-shadow color %s',
    color => {
      expect(() => resolveFilterList(dropShadow({ offsetX: 0, offsetY: 0, color }), context)).toThrow(/filter\.color.*contextual/);
    },
  );

  it('reports the exact indexed path for a nested vendor contextual color', () => {
    expect(() => resolveFilterList([
      blur({ radius: 1 }),
      dropShadow({ offsetX: 0, offsetY: 0, color: 'color-mix(in srgb, red, -webkit-active\\6c ink)' }),
    ], context)).toThrow(/property filter\[1\]\.color .*contextual/);
  });

  it.each([
    'red) blur(100px',
    'rgb(0 0 0',
    'color-mix(in srgb, red, blue]]',
  ])('rejects color %s that escapes its balanced token boundary', color => {
    expect(() => resolveFilterList(dropShadow({ offsetX: 0, offsetY: 0, color }), context)).toThrow(/filter\.color.*balanced.*boundary/i);
  });

  it('ignores contextual names and delimiters inside comments, strings, and escapes', () => {
    const colors = [
      'red /* currentColor light-dark(red, blue) ) */',
      'color-mix(in srgb, red, "currentColor)")',
      'r\\29 ed',
    ];

    for (const color of colors) {
      const resolved = resolveFilterList(dropShadow({ offsetX: 0, offsetY: 0, color }), context)!;
      expect(compileNativeFilters(resolved.values as readonly NativePreparedFilter[], 1)).toBe(`drop-shadow(0px 0px 0px ${color})`);
    }
  });

  it('does not classify contextual-keyword substrings as contextual tokens', () => {
    const colors = [
      'currentColorful',
      'CanvasTexture',
      'Marking',
      '-webkit-linkish',
      'my-webkit-activelink',
      'color-mix(in srgb, -webkit-linkish, red)',
    ];

    for (const color of colors) {
      const resolved = resolveFilterList(dropShadow({ offsetX: 0, offsetY: 0, color }), context)!;
      expect(compileNativeFilters(resolved.values as readonly NativePreparedFilter[], 1)).toBe(`drop-shadow(0px 0px 0px ${color})`);
    }
  });

  it('gets an already-resolved nonempty filter list from system style', () => {
    const resolved = resolveFilterList(blur({ radius: 2 }), context)!;
    const style: SystemStyle = { filter: resolved.values as unknown as readonly PibblFilter[] };

    expect(getResolvedFilterList(style)?.values).toBe(resolved.values);
    expect(getResolvedFilterList({ filter: [] })).toBeUndefined();
  });
});

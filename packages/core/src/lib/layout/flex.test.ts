import { describe, expect, it, vi } from 'vitest';
import { rect } from '../components/rect';
import { defineComp } from '../define-comp';
import type { Length } from '../style/types';
import type { CompEl, SystemStyle } from '../types';
import { flex, layoutFlex } from './flex';
import { measureElement, type CanvasMeasurementService } from './measure';

const service: CanvasMeasurementService = {
  measureText: value => ({ width: value.length * 10 } as TextMetrics),
};
const measurement = {
  service,
  measureElement: (element: CompEl, constraints: {
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
  }) => measureElement(element, constraints, service),
};

function item(style: Record<string, unknown>) {
  return rect({ style: {
    width: 1,
    height: 10,
    minWidth: 0,
    flexShrink: 1,
    ...style,
  } as any });
}

describe('CSS-compatible flex geometry', () => {
  it('measures nested auto flex content without rendering children', () => {
    const nested = flex({
      style: { width: 'auto', height: 'auto', columnGap: 5 },
      children: [
        item({ flexBasis: 20, flexShrink: 0 }),
        item({ flexBasis: 20, flexShrink: 0 }),
      ],
    });

    expect(measureElement(nested, {
      minWidth: 0,
      maxWidth: 200,
      minHeight: 0,
      maxHeight: 100,
    }, service)).toEqual({
      status: 'measured',
      size: { width: 45, height: 10 },
    });
  });

  it('distributes sufficient positive space by flex grow factors', () => {
    expect(layoutFlex(
      { x: 0, y: 0, width: 100, height: 20 },
      [
        item({ flexBasis: 20, flexGrow: 1 }),
        item({ flexBasis: 20, flexGrow: 2 }),
      ],
      {},
      measurement,
    )).toEqual([
      { x: 0, y: 0, width: 40, height: 10 },
      { x: 40, y: 0, width: 60, height: 10 },
    ]);
  });

  it('shrinks proportionally to scaled shrink factors', () => {
    expect(layoutFlex(
      { x: 0, y: 0, width: 100, height: 20 },
      [item({ flexBasis: 80 }), item({ flexBasis: 80 })],
      {},
      measurement,
    )).toEqual([
      { x: 0, y: 0, width: 50, height: 10 },
      { x: 50, y: 0, width: 50, height: 10 },
    ]);
  });

  it('iteratively freezes max and min violations before redistribution', () => {
    expect(layoutFlex(
      { x: 0, y: 0, width: 100, height: 20 },
      [
        item({ flexBasis: 20, flexGrow: 1, maxWidth: 30 }),
        item({ flexBasis: 20, flexGrow: 1 }),
      ],
      {},
      measurement,
    )).toEqual([
      { x: 0, y: 0, width: 30, height: 10 },
      { x: 30, y: 0, width: 70, height: 10 },
    ]);
    expect(layoutFlex(
      { x: 0, y: 0, width: 100, height: 20 },
      [
        item({ flexBasis: 80, minWidth: 70 }),
        item({ flexBasis: 80 }),
      ],
      {},
      measurement,
    )).toEqual([
      { x: 0, y: 0, width: 70, height: 10 },
      { x: 70, y: 0, width: 30, height: 10 },
    ]);
  });

  it('chooses grow from clamped hypothetical outer sizes', () => {
    expect(layoutFlex(
      { x: 0, y: 0, width: 100, height: 20 },
      [
        item({ flexBasis: 100, flexGrow: 1, maxWidth: 30 }),
        item({ flexBasis: 10, flexGrow: 3 }),
        item({ flexBasis: 30, flexGrow: 1 }),
      ],
      {},
      measurement,
    )).toEqual([
      { x: 0, y: 0, width: 30, height: 10 },
      { x: 30, y: 0, width: 32.5, height: 10 },
      { x: 62.5, y: 0, width: 37.5, height: 10 },
    ]);
  });

  it('supports columns and main-axis justification', () => {
    expect(layoutFlex(
      { x: 0, y: 0, width: 40, height: 100 },
      [
        item({ flexBasis: 20, height: 1, minHeight: 0, flexGrow: 1 }),
        item({ flexBasis: 20, height: 1, minHeight: 0, flexGrow: 2 }),
      ],
      { flexDirection: 'column', alignItems: 'flex-start' },
      measurement,
    )).toEqual([
      { x: 0, y: 0, width: 1, height: 40 },
      { x: 0, y: 40, width: 1, height: 60 },
    ]);
    expect(layoutFlex(
      { x: 0, y: 0, width: 100, height: 20 },
      [
        item({ flexBasis: 20, flexShrink: 0 }),
        item({ flexBasis: 20, flexShrink: 0 }),
      ],
      { justifyContent: 'space-between' },
      measurement,
    )).toEqual([
      { x: 0, y: 0, width: 20, height: 10 },
      { x: 80, y: 0, width: 20, height: 10 },
    ]);
  });

  it('wraps source-order items and aligns multiple lines', () => {
    expect(layoutFlex(
      { x: 0, y: 0, width: 100, height: 50 },
      [
        item({ flexBasis: 40, flexShrink: 0 }),
        item({ flexBasis: 40, flexShrink: 0 }),
        item({ flexBasis: 40, flexShrink: 0 }),
      ],
      {
        flexWrap: 'wrap',
        columnGap: 10,
        rowGap: 10,
        alignContent: 'flex-start',
      },
      measurement,
    )).toEqual([
      { x: 0, y: 0, width: 40, height: 10 },
      { x: 50, y: 0, width: 40, height: 10 },
      { x: 0, y: 20, width: 40, height: 10 },
    ]);
    expect(layoutFlex(
      { x: 0, y: 0, width: 100, height: 100 },
      [
        item({ flexBasis: 60, flexShrink: 0 }),
        item({ flexBasis: 60, flexShrink: 0 }),
      ],
      {
        flexWrap: 'wrap',
        rowGap: 10,
        alignContent: 'center',
      },
      measurement,
    )).toEqual([
      { x: 0, y: 35, width: 60, height: 10 },
      { x: 0, y: 55, width: 60, height: 10 },
    ]);
  });

  it.each([
    ['center', { x: 0, y: 45, width: 20, height: 10 }],
    ['flex-end', { x: 0, y: 90, width: 20, height: 10 }],
    ['stretch', { x: 0, y: 0, width: 20, height: 10 }],
  ] as const)(
    'treats one-line wrap as multi-line for alignContent %s',
    (alignContent, expected) => {
      expect(layoutFlex(
        { x: 0, y: 0, width: 100, height: 100 },
        [item({ flexBasis: 20, flexShrink: 0 })],
        { flexWrap: 'wrap', alignContent },
        measurement,
      )).toEqual([expected]);
    },
  );

  it.each([
    ['flex-end', -60],
    ['center', -30],
    ['space-between', 0],
    ['space-around', -30],
    ['space-evenly', -30],
  ] as const)('preserves negative free-space fallback for %s', (
    justifyContent,
    firstX,
  ) => {
    expect(layoutFlex(
      { x: 0, y: 0, width: 100, height: 20 },
      [
        item({ flexBasis: 80, flexShrink: 0 }),
        item({ flexBasis: 80, flexShrink: 0 }),
      ],
      { justifyContent },
      measurement,
    )).toEqual([
      { x: firstX, y: 0, width: 80, height: 10 },
      { x: firstX + 80, y: 0, width: 80, height: 10 },
    ]);
  });

  it('stretches auto cross sizes and honors alignSelf', () => {
    interface AutoStyle extends SystemStyle {
      width?: Length;
      height?: Length;
      minWidth: number;
      flexBasis: number;
      flexShrink: number;
      alignSelf?: 'auto' | 'stretch' | 'flex-start' | 'flex-end' | 'center';
    }
    interface ResolvedAutoStyle extends SystemStyle {
      width: number;
      height: number;
    }
    const Auto = defineComp<{}, AutoStyle, AutoStyle, ResolvedAutoStyle>(
      () => undefined,
      {
        resolveStyle: style => ({
          width: style.width as number,
          height: style.height as number,
        }),
        measure: vi.fn(() => ({
          status: 'measured' as const,
          size: { width: 20, height: 10 },
        })),
      },
    );
    const children = [
      Auto({ style: {
        minWidth: 0,
        flexBasis: 20,
        flexShrink: 0,
      } }),
      Auto({ style: {
        minWidth: 0,
        flexBasis: 20,
        flexShrink: 0,
        alignSelf: 'center',
      } }),
    ];

    expect(layoutFlex(
      { x: 0, y: 0, width: 100, height: 40 },
      children,
      {},
      measurement,
    )).toEqual([
      { x: 0, y: 0, width: 20, height: 40 },
      { x: 20, y: 15, width: 20, height: 10 },
    ]);
  });

  it('leaves overflow or unused space when total shrink or grow is zero', () => {
    expect(layoutFlex(
      { x: 0, y: 0, width: 100, height: 20 },
      [
        item({ flexBasis: 80, flexShrink: 0 }),
        item({ flexBasis: 80, flexShrink: 0 }),
      ],
      {},
      measurement,
    )).toEqual([
      { x: 0, y: 0, width: 80, height: 10 },
      { x: 80, y: 0, width: 80, height: 10 },
    ]);
    expect(layoutFlex(
      { x: 0, y: 0, width: 100, height: 20 },
      [
        item({ flexBasis: 20, flexGrow: 0 }),
        item({ flexBasis: 20, flexGrow: 0 }),
      ],
      {},
      measurement,
    )).toEqual([
      { x: 0, y: 0, width: 20, height: 10 },
      { x: 20, y: 0, width: 20, height: 10 },
    ]);
  });

  it('partially consumes free space when total flex factors are below one', () => {
    expect(layoutFlex(
      { x: 0, y: 0, width: 100, height: 20 },
      [
        item({ flexBasis: 20, flexGrow: 0.25 }),
        item({ flexBasis: 20, flexGrow: 0.25 }),
      ],
      {},
      measurement,
    )).toEqual([
      { x: 0, y: 0, width: 35, height: 10 },
      { x: 35, y: 0, width: 35, height: 10 },
    ]);
    expect(layoutFlex(
      { x: 0, y: 0, width: 100, height: 20 },
      [
        item({ flexBasis: 80, flexShrink: 0.25 }),
        item({ flexBasis: 80, flexShrink: 0.25 }),
      ],
      {},
      measurement,
    )).toEqual([
      { x: 0, y: 0, width: 65, height: 10 },
      { x: 65, y: 0, width: 65, height: 10 },
    ]);
  });

  it('requires explicit main-axis minimums and rejects unsupported values', () => {
    expect(() => layoutFlex(
      { x: 0, y: 0, width: 100, height: 20 },
      [rect({ style: { width: 20, height: 10, flexBasis: 'auto' } })],
      {},
      measurement,
    )).toThrowError(/minWidth.*explicit/i);
    for (const style of [
      { flexDirection: 'row-reverse' },
      { flexWrap: 'wrap-reverse' },
      { gap: '10%' },
    ]) {
      expect(() => layoutFlex(
        { x: 0, y: 0, width: 100, height: 20 },
        [],
        style as any,
        measurement,
      )).toThrowError(/unsupported flex/i);
    }
  });

  it.each([
    [{ flexWrap: 'wrap' }, /nowrap/i],
    [{}, /grow/i],
    [{}, /percentage/i],
  ] as const)('rejects allocation-dependent intrinsic measurement %#', (
    flexStyle,
    reason,
  ) => {
    const childStyle = reason.source.includes('grow') ?
      { flexBasis: 20, flexGrow: 1, flexShrink: 0 } :
      reason.source.includes('percentage') ?
        { flexBasis: '50%', flexShrink: 0 } :
        { flexBasis: 20, flexShrink: 0 };
    expect(measureElement(flex({
      style: { width: 'auto', height: 'auto', ...flexStyle } as any,
      children: [item(childStyle)],
    }), {
      minWidth: 0,
      maxWidth: 200,
      minHeight: 0,
      maxHeight: 100,
    }, service)).toEqual({
      status: 'unsupported',
      reason: expect.stringMatching(reason),
    });
  });

  // @ts-expect-error reverse directions are outside the supported matrix
  void flex({ style: { flexDirection: 'row-reverse' }, children: [] });
});

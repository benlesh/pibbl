import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Rectangle } from '../components/rect';
import { Text } from '../components/text';
import { componentTest } from '../test-utils/component-test';
import type { PibblElement } from '../types';
import { autoFillTracks, autoFitTracks, Grid, layoutGrid, minmax, repeatTracks, resolveGridTracks } from './grid';
import { measureElement, measureIntrinsicElement } from './measure';
import { createElement } from '../element/create-element';
import { prepareLayoutEngineSync } from './wasm/embedded';
import { nativeLayout } from './wasm/region';

beforeAll(() => {
  if (nativeLayout) prepareLayoutEngineSync();
});

const service = {
  measureText: (value: string) => ({ width: value.length * 10 }) as TextMetrics,
};
const measurement = {
  service,
  measureElement: (
    element: PibblElement<any>,
    constraints: {
      minWidth: number;
      maxWidth: number;
      minHeight: number;
      maxHeight: number;
    },
  ) => measureElement(element, constraints, service),
};

function child(style: Record<string, unknown>) {
  return createElement(Rectangle, {
    style: {
      width: 'auto',
      height: 'auto',
      gridColumnStart: 1,
      gridRowStart: 1,
      ...style,
    } as any,
  });
}

describe('CSS-compatible explicit grid geometry', () => {
  it.runIf(nativeLayout)('resolves minmax fractional tracks through the native Grid arena', () => {
    const boxes = layoutGrid(
      { x: 0, y: 0, width: 90, height: 20 },
      [
        child({ gridColumnStart: 1, gridRowStart: 1 }),
        child({ gridColumnStart: 2, gridRowStart: 1 }),
      ],
      {
        gridTemplateColumns: [minmax({ min: 0, max: '1fr' }), minmax({ min: 0, max: '2fr' })],
        gridTemplateRows: [20],
      },
      measurement,
    );
    expect(boxes[0]!.width).toBeCloseTo(30);
    expect(boxes[1]!.x).toBeCloseTo(30);
    expect(boxes[1]!.width).toBeCloseTo(60);
  });

  it.runIf(nativeLayout)('collapses unused auto-fit repetitions and remaps occupied native cells', () => {
    expect(layoutGrid(
      { x: 0, y: 0, width: 100, height: 20 },
      [child({ gridColumnStart: 3, gridRowStart: 1 })],
      {
        gridTemplateColumns: [autoFitTracks(20)],
        gridTemplateRows: [20],
        columnGap: 5,
      },
      measurement,
    )).toEqual([{ x: 0, y: 0, width: 20, height: 20 }]);
  });

  it.runIf(nativeLayout)('uses distinct paired Text intrinsic contributions across a spanning gap', () => {
    const boxes = layoutGrid(
      { x: 0, y: 0, width: 100, height: 20 },
      [createElement(Text, { children: 'aa bb', style: {
        wrap: true,
        width: 'auto', height: 'auto', gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1,
      } })],
      {
        gridTemplateColumns: ['auto', 'auto'],
        gridTemplateRows: [20],
        columnGap: 10,
      },
      measurement,
    );
    // min-content is one word (20); max-content is the 50px run. The native
    // contribution subtracts the 10px internal gap before distributing 40px.
    expect(boxes[0]).toEqual({ x: 0, y: 0, width: 50, height: 20 });
  });

  it.runIf(nativeLayout)('keeps sparse auto-flow after a spanning item while dense flow backfills its hole', () => {
    const children = [
      createElement(Rectangle, { style: { width: 'auto', height: 'auto', gridColumnSpan: 2 } }),
      createElement(Rectangle, { style: { width: 'auto', height: 'auto', gridColumnSpan: 2 } }),
      createElement(Rectangle, { style: { width: 'auto', height: 'auto' } }),
    ];
    const style = { gridTemplateColumns: [10, 10, 10], gridTemplateRows: [10], gridAutoRows: 10 } as const;
    expect(layoutGrid({ x: 0, y: 0, width: 30, height: 30 }, children, { ...style, gridAutoFlow: 'row' }, measurement)).toEqual([
      { x: 0, y: 0, width: 20, height: 10 }, { x: 0, y: 10, width: 20, height: 10 }, { x: 20, y: 10, width: 10, height: 10 },
    ]);
    expect(layoutGrid({ x: 0, y: 0, width: 30, height: 30 }, children, { ...style, gridAutoFlow: 'row dense' }, measurement)[2]).toEqual({ x: 20, y: 0, width: 10, height: 10 });
  });

  it.runIf(nativeLayout)('creates implicit tracks and expands repeat and auto-fit definitions', () => {
    const boxes = layoutGrid({ x: 0, y: 0, width: 10, height: 30 }, [
      createElement(Rectangle, { style: { width: 'auto', height: 'auto' } }),
      createElement(Rectangle, { style: { width: 'auto', height: 'auto' } }),
      createElement(Rectangle, { style: { width: 'auto', height: 'auto' } }),
    ], { gridTemplateColumns: [10], gridTemplateRows: [5], gridAutoRows: 7 }, measurement);
    expect(boxes).toEqual([{ x: 0, y: 0, width: 10, height: 5 }, { x: 0, y: 5, width: 10, height: 7 }, { x: 0, y: 12, width: 10, height: 7 }]);
    expect(resolveGridTracks([repeatTracks([10], { count: 2 }), minmax({ min: 10, max: '1fr' })], 40, 0, 'columns')).toEqual([10, 10, 10]);
    expect(resolveGridTracks([autoFitTracks(20)], 100, 0, 'columns')).toEqual([20, 20, 20, 20, 20]);
  });

  it.runIf(nativeLayout)('counts auto-fill repetitions after fixed sibling breadth and every gap', () => {
    const boxes = layoutGrid(
      { x: 0, y: 0, width: 100, height: 20 },
      Array.from({ length: 7 }, () => createElement(Rectangle, {
        style: { width: 'auto', height: 'auto' },
      })),
      {
        gridTemplateColumns: [20, autoFillTracks(10)],
        gridTemplateRows: [10],
        gridAutoRows: 10,
        columnGap: 5,
      },
      measurement,
    );

    // 20 + 5 × 10 + 5 × 5 = 95: six columns fit, so the seventh
    // source item starts the implicit second row instead of a seventh column.
    expect(boxes[5]).toEqual({ x: 85, y: 0, width: 10, height: 10 });
    expect(boxes[6]).toEqual({ x: 0, y: 10, width: 20, height: 10 });
  });
  it.runIf(nativeLayout)('does not overfill auto-repeat tracks beside a fixed sibling', () => {
    expect(resolveGridTracks([20, autoFillTracks(10)], 99, 10, 'columns')).toEqual([20, 10, 10, 10]);
    expect(resolveGridTracks([autoFillTracks(10), 20], 99, 10, 'columns')).toEqual([10, 10, 10, 20]);
  });

  it.runIf(nativeLayout)('does not let an absolute Grid item create implicit flow tracks', () => {
    const boxes = layoutGrid(
      { x: 0, y: 0, width: 100, height: 20 },
      [
        createElement(Rectangle, { style: { width: 'auto', height: 'auto' } }),
        createElement(Rectangle, {
          style: {
            position: 'absolute',
            width: 10,
            height: 10,
            gridColumnStart: 3,
            gridRowStart: 1,
          },
        }),
      ],
      {
        gridTemplateColumns: ['1fr'],
        gridTemplateRows: [20],
        gridAutoColumns: 20,
      },
      measurement,
    );
    expect(boxes[0]).toEqual({ x: 0, y: 0, width: 100, height: 20 });
  });

  it('resolves mixed fixed, percentage, and fractional tracks', () => {
    expect(resolveGridTracks([50, '25%', '1fr'], 200, 10, 'columns')).toEqual([
      50, 50, 80,
    ]);
    expect(
      layoutGrid(
        { x: 0, y: 0, width: 200, height: 100 },
        [
          child({ gridColumnStart: 1, gridRowStart: 1 }),
          child({ gridColumnStart: 3, gridRowStart: 2 }),
        ],
        {
          gridTemplateColumns: [50, '25%', '1fr'],
          gridTemplateRows: [40, '1fr'],
          gap: 10,
        },
        measurement,
      ),
    ).toEqual([
      { x: 0, y: 0, width: 50, height: 40 },
      { x: 120, y: 50, width: 80, height: 50 },
    ]);
  });

  it('leaves unused space when total fr is below one', () => {
    expect(resolveGridTracks(['0.5fr', '0.25fr'], 100, 0, 'columns')).toEqual([
      50, 25,
    ]);
  });

  it('resolves spans including internal gaps', () => {
    expect(
      layoutGrid(
        { x: 0, y: 0, width: 130, height: 30 },
        [
          child({
            gridColumnStart: 2,
            gridColumnSpan: 2,
            gridRowStart: 1,
          }),
        ],
        {
          gridTemplateColumns: [30, 40, 50],
          gridTemplateRows: [30],
          columnGap: 5,
        },
        measurement,
      ),
    ).toEqual([{ x: 35, y: 0, width: 95, height: 30 }]);
  });

  it('clamps fractional tracks to zero when fixed tracks consume the space', () => {
    expect(resolveGridTracks([40, 30, '1fr'], 50, 10, 'columns')).toEqual([
      40, 30, 0,
    ]);
  });

  it('aligns definite children within their grid area', () => {
    expect(
      layoutGrid(
        { x: 0, y: 0, width: 100, height: 50 },
        [
          createElement(Rectangle, {
            style: {
              width: 20,
              height: 10,
              gridColumnStart: 1,
              gridRowStart: 1,
              justifySelf: 'center',
              alignSelf: 'end',
            },
          }),
        ],
        {
          gridTemplateColumns: ['1fr'],
          gridTemplateRows: ['1fr'],
        },
        measurement,
      ),
    ).toEqual([{ x: 40, y: 40, width: 20, height: 10 }]);
  });

  it('preserves source-order overlap for paint and interaction', async () => {
    const bottom = vi.fn();
    const top = vi.fn();
    const canvas = await componentTest(
      createElement(Grid, {
        style: {
          width: 50,
          height: 30,
          gridTemplateColumns: [50],
          gridTemplateRows: [30],
        },
        children: [
          createElement(Rectangle, {
            style: {
              width: 'auto',
              height: 'auto',
              gridColumnStart: 1,
              gridRowStart: 1,
              fill: 'red',
            },
            onClick: bottom,
          }),
          createElement(Rectangle, {
            style: {
              width: 20,
              height: 10,
              gridColumnStart: 1,
              gridRowStart: 1,
              justifySelf: 'center',
              alignSelf: 'center',
              fill: 'blue',
            },
            onClick: top,
          }),
        ],
      }),
    );

    expect(
      Array.from(
        canvas.element.getContext('2d')!.getImageData(25, 15, 1, 1).data,
      ),
    ).toEqual([0, 0, 255, 255]);
    await canvas.click({ position: { x: 25, y: 15 } });
    expect(top).toHaveBeenCalledOnce();
    expect(bottom).not.toHaveBeenCalled();
  });

  it('renders percentage and fractional tracks through public dispatch', async () => {
    const canvas = await componentTest(
      createElement(Grid, {
        style: {
          width: 200,
          height: 20,
          gridTemplateColumns: ['25%', '1fr'],
          gridTemplateRows: [20],
        },
        children: [
          createElement(Rectangle, { style: {
            width: 'auto',
            height: 'auto',
            gridColumnStart: 1,
            gridRowStart: 1,
            fill: 'red',
          } }),
          createElement(Rectangle, { style: {
            width: 'auto',
            height: 'auto',
            gridColumnStart: 2,
            gridRowStart: 1,
            fill: 'blue',
          } }),
        ],
      }),
    );

    expect(Array.from(canvas.element.getContext('2d')!
      .getImageData(49, 10, 1, 1).data)).toEqual([255, 0, 0, 255]);
    expect(Array.from(canvas.element.getContext('2d')!
      .getImageData(50, 10, 1, 1).data)).toEqual([0, 0, 255, 255]);
  });

  it('measures only exact fixed-track intrinsic grids', () => {
    expect(
      measureElement(
        createElement(Grid, {
          style: {
            width: 'auto',
            height: 'auto',
            gridTemplateColumns: [20, 30],
            gridTemplateRows: [10],
            columnGap: 5,
          },
          children: [],
        }),
        {
          minWidth: 0,
          maxWidth: 200,
          minHeight: 0,
          maxHeight: 100,
        },
        service,
      ),
    ).toEqual({
      status: 'measured',
      size: { width: 55, height: 10 },
    });
    expect(
      measureElement(
        createElement(Grid, {
          style: {
            width: 'auto',
            height: 'auto',
            gridTemplateColumns: ['1fr'],
            gridTemplateRows: [10],
          },
          children: [],
        }),
        {
          minWidth: 0,
          maxWidth: 200,
          minHeight: 0,
          maxHeight: 100,
        },
        service,
      ),
    ).toEqual({
      status: 'unsupported',
      reason: expect.stringMatching(/fractional.*intrinsic/i),
    });
  });

  it.runIf(nativeLayout)('provides paired automatic Grid contributions under finite owner constraints', () => {
    const result = measureIntrinsicElement(
      createElement(Grid, {
        style: {
          width: 'auto', height: 'auto',
          gridTemplateColumns: ['auto'], gridTemplateRows: ['auto'],
        },
        children: createElement(Text, {
          children: 'aa bb',
          style: { wrap: true, gridColumnStart: 1, gridRowStart: 1 },
        }),
      }),
      { minWidth: 0, maxWidth: 100, minHeight: 0, maxHeight: 100 },
      service,
    );
    expect(result).toMatchObject({
      status: 'measured',
      minContent: { width: 20 },
      maxContent: { width: 50 },
    });
  });

  it.each([
    { gridTemplateColumns: [-10, 20], gridTemplateRows: [10] },
    { gridTemplateColumns: ['1e2%'], gridTemplateRows: [10] },
    { gridTemplateColumns: [10], gridTemplateRows: [Number.POSITIVE_INFINITY] },
  ])('validates every track before definite measurement %#', style => {
    expect(() => measureElement(createElement(Grid, {
      style: { width: 100, height: 50, ...style } as any,
      children: [],
    }), {
      minWidth: 0,
      maxWidth: 100,
      minHeight: 0,
      maxHeight: 50,
    }, service)).toThrowError(/Grid.*gridTemplate(?:Columns|Rows).*track/i);
  });

  it.each([
    [{ gridTemplateColumns: [], gridTemplateRows: [10] }, /nonempty.*columns/i],
    [{ gridTemplateColumns: [10], gridTemplateRows: [] }, /nonempty.*rows/i],
  ])('rejects invalid grid container %s', (style, reason) => {
    expect(() =>
      layoutGrid(
        { x: 0, y: 0, width: 100, height: 50 },
        [],
        style as any,
        measurement,
      ),
    ).toThrowError(reason);
  });

  it.runIf(!nativeLayout)('rejects missing, nonpositive, or overflowing explicit placements', () => {
    const base = {
      gridTemplateColumns: [50],
      gridTemplateRows: [50],
    } as const;
    expect(() =>
      layoutGrid(
        { x: 0, y: 0, width: 50, height: 50 },
        [createElement(Rectangle, { style: { width: 10, height: 10 } })],
        base,
        measurement,
      ),
    ).toThrowError(/gridColumnStart.*required/i);
    expect(() =>
      layoutGrid(
        { x: 0, y: 0, width: 50, height: 50 },
        [child({ gridColumnStart: 0 })],
        base,
        measurement,
      ),
    ).toThrowError(/gridColumnStart.*positive/i);
    expect(() =>
      layoutGrid(
        { x: 0, y: 0, width: 50, height: 50 },
        [child({ gridColumnSpan: 2 })],
        base,
        measurement,
      ),
    ).toThrowError(/gridColumnSpan.*explicit/i);
    expect(() => layoutGrid(
      { x: 0, y: 0, width: 50, height: 50 },
      [child({ gridColumnStart: 2 })],
      base,
      measurement,
    )).toThrowError(/gridColumnStart.*2.*explicit.*1/i);
    expect(() => layoutGrid(
      { x: 0, y: 0, width: 50, height: 50 },
      [child({ gridRowStart: 2 })],
      base,
      measurement,
    )).toThrowError(/gridRowStart.*2.*explicit.*1/i);
    expect(() => layoutGrid(
      { x: 0, y: 0, width: 50, height: 50 },
      [child({ gridColumnSpan: 0 })],
      base,
      measurement,
    )).toThrowError(/gridColumnSpan.*positive/i);
  });

  // @ts-expect-error Grid requires explicit track lists
  void createElement(Grid, { style: {}, children: [] });
});

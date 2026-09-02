import { afterEach, describe, expect, it } from 'vitest';
import { Rectangle } from '../src/lib/components/rect';
import {
  layoutGrid,
  type GridStyle,
  type GridTrack,
} from '../src/lib/layout/grid';
import { measureElement } from '../src/lib/layout/measure';
import type { CRCElement } from '../src/lib/types';
import { createElement } from '../src/lib/element/create-element';

const service = {
  measureText: (value: string) => ({ width: value.length * 10 }) as TextMetrics,
};
const measurement = {
  service,
  measureElement: (
    element: CRCElement<any>,
    constraints: {
      minWidth: number;
      maxWidth: number;
      minHeight: number;
      maxHeight: number;
    },
  ) => measureElement(element, constraints, service),
};

afterEach(() => document.body.replaceChildren());

describe('Grid Chromium compatibility oracle', () => {
  it.each([
    {
      name: 'fixed percentage fr and gaps',
      container: { width: 200, height: 100 },
      style: {
        gridTemplateColumns: [50, '25%', '1fr'],
        gridTemplateRows: [40, '1fr'],
        gap: 10,
      },
      items: [
        { column: 1, row: 1 },
        { column: 3, row: 2 },
      ],
    },
    {
      name: 'fraction total below one',
      container: { width: 100, height: 20 },
      style: {
        gridTemplateColumns: ['0.5fr', '0.25fr'],
        gridTemplateRows: [20],
      },
      items: [
        { column: 1, row: 1 },
        { column: 2, row: 1 },
      ],
    },
    {
      name: 'spans and alignment',
      container: { width: 130, height: 50 },
      style: {
        gridTemplateColumns: [30, 40, 50],
        gridTemplateRows: [50],
        columnGap: 5,
      },
      items: [
        {
          column: 2,
          columnSpan: 2,
          row: 1,
          width: 20,
          height: 10,
          justifySelf: 'center',
          alignSelf: 'end',
        },
      ],
    },
    {
      name: 'explicit overlap',
      container: { width: 80, height: 40 },
      style: {
        gridTemplateColumns: [80],
        gridTemplateRows: [40],
      },
      items: [
        { column: 1, row: 1 },
        { column: 1, row: 1, width: 20, height: 10 },
      ],
    },
  ] as const)('matches Chromium for $name', (fixture) => {
    const children = fixture.items.map((item) =>
      createElement(Rectangle, {
        style: {
          width: 'width' in item ? item.width : 'auto',
          height: 'height' in item ? item.height : 'auto',
          gridColumnStart: item.column,
          gridColumnSpan: 'columnSpan' in item ? item.columnSpan : 1,
          gridRowStart: item.row,
          gridRowSpan: 1,
          justifySelf: 'justifySelf' in item ? item.justifySelf : 'auto',
          alignSelf: 'alignSelf' in item ? item.alignSelf : 'auto',
        } as any,
      }),
    );
    const actual = layoutGrid(
      { x: 0, y: 0, ...fixture.container },
      children,
      fixture.style as GridStyle,
      measurement,
    );

    expect(actual).toEqual(domOracle(fixture as any));
  });
});

function domOracle(fixture: {
  container: { width: number; height: number };
  style: GridStyle;
  items: readonly {
    column: number;
    columnSpan?: number;
    row: number;
    rowSpan?: number;
    width?: number;
    height?: number;
    justifySelf?: 'stretch' | 'start' | 'center' | 'end';
    alignSelf?: 'stretch' | 'start' | 'center' | 'end';
  }[];
}) {
  const container = document.createElement('div');
  Object.assign(container.style, {
    display: 'grid',
    boxSizing: 'content-box',
    width: `${fixture.container.width}px`,
    height: `${fixture.container.height}px`,
    gridTemplateColumns: tracks(fixture.style.gridTemplateColumns),
    gridTemplateRows: tracks(fixture.style.gridTemplateRows),
    justifyItems: fixture.style.justifyItems ?? 'stretch',
    alignItems: fixture.style.alignItems ?? 'stretch',
    rowGap: `${fixture.style.rowGap ?? fixture.style.gap ?? 0}px`,
    columnGap: `${fixture.style.columnGap ?? fixture.style.gap ?? 0}px`,
  });
  for (const item of fixture.items) {
    const element = document.createElement('div');
    Object.assign(element.style, {
      boxSizing: 'content-box',
      gridColumn: `${item.column} / span ${item.columnSpan ?? 1}`,
      gridRow: `${item.row} / span ${item.rowSpan ?? 1}`,
      ...(item.width === undefined ? {} : { width: `${item.width}px` }),
      ...(item.height === undefined ? {} : { height: `${item.height}px` }),
      ...(item.justifySelf === undefined
        ? {}
        : { justifySelf: item.justifySelf }),
      ...(item.alignSelf === undefined ? {} : { alignSelf: item.alignSelf }),
    });
    container.appendChild(element);
  }
  document.body.appendChild(container);
  const root = container.getBoundingClientRect();
  return Array.from(container.children, (child) => {
    const box = child.getBoundingClientRect();
    return {
      x: round(box.left - root.left),
      y: round(box.top - root.top),
      width: round(box.width),
      height: round(box.height),
    };
  });
}

function tracks(values: readonly GridTrack[]): string {
  return values
    .map((value) => (typeof value === 'number' ? `${value}px` : value))
    .join(' ');
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

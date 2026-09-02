import { Rectangle } from '../src/lib/components/rect';
import {
  layoutFlex,
  type FlexStyle,
} from '../src/lib/layout/flex';
import { measureElement } from '../src/lib/layout/measure';
import type { CRCElement } from '../src/lib/types';
import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from '../src/lib/element/create-element';

const service = {
  measureText: (value: string) => ({ width: value.length * 10 } as TextMetrics),
};
const measurement = {
  service,
  measureElement: (element: CRCElement<any>, constraints: {
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
  }) => measureElement(element, constraints, service),
};

afterEach(() => document.body.replaceChildren());

describe('Flexbox Chromium compatibility oracle', () => {
  it.each([
    {
      name: 'grow',
      container: { width: 100, height: 20 },
      style: {},
      items: [
        { basis: 20, grow: 1, shrink: 1, width: 1, height: 10 },
        { basis: 20, grow: 2, shrink: 1, width: 1, height: 10 },
      ],
    },
    {
      name: 'shrink',
      container: { width: 100, height: 20 },
      style: {},
      items: [
        { basis: 80, grow: 0, shrink: 1, width: 1, height: 10 },
        { basis: 80, grow: 0, shrink: 1, width: 1, height: 10 },
      ],
    },
    {
      name: 'wrap and align-content',
      container: { width: 100, height: 100 },
      style: { flexWrap: 'wrap', alignContent: 'center', rowGap: 10 },
      items: [
        { basis: 60, grow: 0, shrink: 0, width: 1, height: 10 },
        { basis: 60, grow: 0, shrink: 0, width: 1, height: 10 },
      ],
    },
    {
      name: 'column and justify-content',
      container: { width: 30, height: 100 },
      style: {
        flexDirection: 'column',
        justifyContent: 'space-around',
        alignItems: 'flex-start',
      },
      items: [
        { basis: 20, grow: 0, shrink: 0, width: 10, height: 1 },
        { basis: 20, grow: 0, shrink: 0, width: 10, height: 1 },
      ],
    },
    {
      name: 'hypothetical max chooses grow',
      container: { width: 100, height: 20 },
      style: {},
      items: [
        {
          basis: 100,
          grow: 1,
          shrink: 1,
          width: 1,
          height: 10,
          maxWidth: 30,
        },
        { basis: 10, grow: 3, shrink: 1, width: 1, height: 10 },
        { basis: 30, grow: 1, shrink: 1, width: 1, height: 10 },
      ],
    },
    {
      name: 'one-line wrap align-content center',
      container: { width: 100, height: 100 },
      style: { flexWrap: 'wrap', alignContent: 'center' },
      items: [
        { basis: 20, grow: 0, shrink: 0, width: 1, height: 10 },
      ],
    },
    {
      name: 'negative center fallback',
      container: { width: 100, height: 20 },
      style: { justifyContent: 'center' },
      items: [
        { basis: 80, grow: 0, shrink: 0, width: 1, height: 10 },
        { basis: 80, grow: 0, shrink: 0, width: 1, height: 10 },
      ],
    },
  ] as const)('matches Chromium for $name', fixture => {
    const children = fixture.items.map(value => {
      const maxWidth = 'maxWidth' in value ? value.maxWidth : undefined;
      return createElement(Rectangle, { style: {
        width: value.width,
        height: value.height,
        minWidth: 0,
        minHeight: 0,
        flexBasis: value.basis,
        flexGrow: value.grow,
        flexShrink: value.shrink,
        ...(maxWidth === undefined ? {} : { maxWidth }),
      } });
    });
    const actual = layoutFlex(
      { x: 0, y: 0, ...fixture.container },
      children,
      fixture.style as FlexStyle,
      measurement,
    );

    expect(actual).toEqual(domOracle(fixture));
  });
});

function domOracle(fixture: {
  container: { width: number; height: number };
  style: FlexStyle;
  items: readonly {
    basis: number;
    grow: number;
    shrink: number;
    width: number;
    height: number;
    maxWidth?: number;
  }[];
}) {
  const container = document.createElement('div');
  Object.assign(container.style, {
    display: 'flex',
    boxSizing: 'content-box',
    width: `${fixture.container.width}px`,
    height: `${fixture.container.height}px`,
    flexDirection: fixture.style.flexDirection ?? 'row',
    flexWrap: fixture.style.flexWrap ?? 'nowrap',
    justifyContent: fixture.style.justifyContent ?? 'flex-start',
    alignItems: fixture.style.alignItems ?? 'stretch',
    alignContent: fixture.style.alignContent ?? 'stretch',
    rowGap: `${fixture.style.rowGap ?? fixture.style.gap ?? 0}px`,
    columnGap: `${fixture.style.columnGap ?? fixture.style.gap ?? 0}px`,
  });
  for (const item of fixture.items) {
    const element = document.createElement('div');
    Object.assign(element.style, {
      boxSizing: 'content-box',
      width: `${item.width}px`,
      height: `${item.height}px`,
      minWidth: '0px',
      minHeight: '0px',
      flexBasis: `${item.basis}px`,
      flexGrow: String(item.grow),
      flexShrink: String(item.shrink),
      ...(item.maxWidth === undefined ? {} : { maxWidth: `${item.maxWidth}px` }),
    });
    container.appendChild(element);
  }
  document.body.appendChild(container);
  const root = container.getBoundingClientRect();
  return Array.from(container.children, child => {
    const box = child.getBoundingClientRect();
    return {
      x: round(box.left - root.left),
      y: round(box.top - root.top),
      width: round(box.width),
      height: round(box.height),
    };
  });
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

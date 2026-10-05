import { describe, expect, it } from 'vitest';
import { jsxDEV } from '../../jsx-dev-runtime.js';
import { jsx, jsxs } from '../../jsx-runtime.js';
import { createElement } from './create-element.js';
import { getElementSource } from './metadata.js';
import type { PibblNode } from './types.js';

function Card(_props: { title: string; children?: PibblNode }): void {}

describe('automatic JSX runtime', () => {
  it('constructs the same descriptor as createElement', () => {
    expect(jsx(Card, { title: 'Pibbl' }, 'card')).toEqual(
      createElement(Card, { key: 'card', title: 'Pibbl' }),
    );
    expect(jsxs(Card, { title: 'Pibbl', children: [null, false] }, 'card')).toEqual(
      createElement(Card, { key: 'card', title: 'Pibbl', children: [null, false] }),
    );
  });

  it('gives the compiler key precedence over a defensive props key', () => {
    const element = jsx(
      Card,
      { title: 'Pibbl', key: 'defensive' } as { title: string; key: string },
      'compiler',
    );

    expect(element.key).toBe('compiler');
    expect(element.props).toEqual({ title: 'Pibbl' });
  });

  it('records source metadata only for development JSX', () => {
    const source = {
      fileName: 'scene.pibbl.tsx',
      lineNumber: 7,
      columnNumber: 5,
    };
    const dev = jsxDEV(Card, { title: 'Pibbl' }, 'card', false, source, undefined);
    const production = jsx(Card, { title: 'Pibbl' }, 'card');

    expect(getElementSource(dev)).toEqual(source);
    expect(getElementSource(production)).toBeUndefined();
    expect(dev).toEqual(createElement(Card, { key: 'card', title: 'Pibbl' }));
  });
});

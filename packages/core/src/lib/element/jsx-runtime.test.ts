import { describe, expect, it } from 'vitest';
import { jsxDEV } from '../../jsx-dev-runtime.js';
import { jsx, jsxs } from '../../jsx-runtime.js';
import { createElement } from './create-element.js';
import { getElementSource } from './metadata.js';
import type { CRCNode } from './types.js';

function Card(_props: { title: string; children?: CRCNode }): void {}

describe('automatic JSX runtime', () => {
  it('constructs the same descriptor as createElement', () => {
    expect(jsx(Card, { title: 'CRC' }, 'card')).toEqual(
      createElement(Card, { key: 'card', title: 'CRC' }),
    );
    expect(jsxs(Card, { title: 'CRC', children: [null, false] }, 'card')).toEqual(
      createElement(Card, { key: 'card', title: 'CRC', children: [null, false] }),
    );
  });

  it('gives the compiler key precedence over a defensive props key', () => {
    const element = jsx(
      Card,
      { title: 'CRC', key: 'defensive' } as { title: string; key: string },
      'compiler',
    );

    expect(element.key).toBe('compiler');
    expect(element.props).toEqual({ title: 'CRC' });
  });

  it('records source metadata only for development JSX', () => {
    const source = {
      fileName: 'scene.crc.tsx',
      lineNumber: 7,
      columnNumber: 5,
    };
    const dev = jsxDEV(Card, { title: 'CRC' }, 'card', false, source, undefined);
    const production = jsx(Card, { title: 'CRC' }, 'card');

    expect(getElementSource(dev)).toEqual(source);
    expect(getElementSource(production)).toBeUndefined();
    expect(dev).toEqual(createElement(Card, { key: 'card', title: 'CRC' }));
  });
});

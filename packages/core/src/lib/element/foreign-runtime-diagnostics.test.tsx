import {
  Rectangle,
  crc,
  type CRCComponent,
  type CRCNode,
} from '@crc/core';
import { jsxDEV } from '@crc/core/jsx-dev-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('foreign JSX runtime diagnostics', () => {
  it.each([
    Symbol.for('react.element'),
    Symbol.for('react.transitional.element'),
  ])('rejects a React-branded root synchronously before mounting for %s', reactBrand => {
    const canvas = createCanvas();
    const reactElement = {
      $$typeof: reactBrand,
      type: 'div',
      props: {},
    };
    const request = vi.spyOn(window, 'requestAnimationFrame');

    expect(() => crc(canvas, reactElement as unknown as CRCNode)).toThrowError(
      'CRC received a React element. This file is using the React JSX runtime.\n' +
      'Set jsxImportSource to "@crc/core" or add ' +
      '/** @jsxImportSource @crc/core */.\n' +
      'Received by CRC root.',
    );
    expect(request).not.toHaveBeenCalled();
  });

  it('distinguishes a generic foreign element-like root from React and ordinary invalid objects', () => {
    const canvas = createCanvas();
    const foreignElement = {
      type: () => undefined,
      props: {},
    };
    const request = vi.spyOn(window, 'requestAnimationFrame');

    expect(() => crc(canvas, foreignElement as unknown as CRCNode))
      .toThrowError(
        'CRC root received an element-like object that was not created by ' +
        '@crc/core as a CRC child.\n' +
        'Check this file\'s JSX runtime and set jsxImportSource to "@crc/core".',
      );
    expect(request).not.toHaveBeenCalled();
    request.mockRestore();

    expect(() => renderNow({ type: 'configuration' }))
      .toThrowError('CRC root received an unsupported object as a CRC child.');
    expect(() => renderNow({ type: 'configuration' }))
      .not.toThrowError(/JSX runtime|jsxImportSource|React element/);
  });

  it('reports receiver component identity and jsxDEV source for foreign element-like children', () => {
    function Poster(): CRCNode {
      return {
        type: () => undefined,
        props: {},
      } as unknown as CRCNode;
    }
    const root = jsxDEV(
      Poster,
      {},
      undefined,
      false,
      {
        fileName: 'poster.crc.tsx',
        lineNumber: 18,
        columnNumber: 7,
      },
      undefined,
    );

    expect(() => renderNow(root)).toThrowError(
      'Poster at poster.crc.tsx:18:7 received an element-like object that ' +
      'was not created by @crc/core as a CRC child.\n' +
      'Check this file\'s JSX runtime and set jsxImportSource to "@crc/core".',
    );
  });

  it.each([
    ['a non-empty string', 'interpolated'],
    ['a nonzero number', 42],
    ['a function', () => undefined],
  ])('reports invalid interpolated %s with receiver and source', (description, child) => {
    const Receiver = (() => child) as CRCComponent<any>;
    Object.defineProperty(Receiver, 'name', { value: 'ResultsGrid' });
    const root = jsxDEV(
      Receiver,
      {},
      undefined,
      false,
      {
        fileName: 'results.crc.tsx',
        lineNumber: 31,
        columnNumber: 11,
      },
      undefined,
    );

    expect(() => renderNow(root)).toThrowError(
      `ResultsGrid at results.crc.tsx:31:11 received ${description} as a CRC child.`,
    );
  });

  it('reports React runtime guidance together with receiver and jsxDEV source', () => {
    function ResultsGrid(): CRCNode {
      return {
        $$typeof: Symbol.for('react.transitional.element'),
        type: 'div',
        props: {},
      } as unknown as CRCNode;
    }
    const root = jsxDEV(
      ResultsGrid,
      {},
      undefined,
      false,
      {
        fileName: 'results.crc.tsx',
        lineNumber: 44,
        columnNumber: 9,
      },
      undefined,
    );

    expect(() => renderNow(root)).toThrowError(
      'CRC received a React element. This file is using the React JSX runtime.\n' +
      'Set jsxImportSource to "@crc/core" or add ' +
      '/** @jsxImportSource @crc/core */.\n' +
      'Received by ResultsGrid at results.crc.tsx:44:9.',
    );
  });

  it('reports direct primitive invocation with both supported constructors', () => {
    expect(() => Rectangle({ style: { width: 10, height: 10 } }))
      .toThrowError(
        'Rectangle is a CRC component and was invoked outside the CRC renderer.\n' +
        'Use <Rectangle ... /> in a CRC JSX file or ' +
        'createElement(Rectangle, props).',
      );
  });
});

function renderNow(root: unknown): void {
  const canvas = createCanvas();
  let pending: FrameRequestCallback | undefined;
  const request = vi.spyOn(window, 'requestAnimationFrame')
    .mockImplementation(callback => {
      pending = callback;
      return 1;
    });
  const controller = crc(canvas, root as CRCNode);
  try {
    if (!pending) throw new Error('CRC did not schedule a render.');
    pending(0);
  } finally {
    controller.dispose();
    request.mockRestore();
  }
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  return canvas;
}

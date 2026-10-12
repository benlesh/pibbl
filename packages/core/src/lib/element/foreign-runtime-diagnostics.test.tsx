import {
  Rectangle,
  pibbl,
  type PibblComponent,
  type PibblNode,
} from '@pibbl/core';
import { jsxDEV } from '@pibbl/core/jsx-dev-runtime';
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

    expect(() => pibbl(canvas, reactElement as unknown as PibblNode)).toThrowError(
      'Pibbl received a React element. This file is using the React JSX runtime.\n' +
      'Set jsxImportSource to "@pibbl/core" or add ' +
      '/** @jsxImportSource @pibbl/core */.\n' +
      'Received by Pibbl root.',
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

    expect(() => pibbl(canvas, foreignElement as unknown as PibblNode))
      .toThrowError(
        'Pibbl root received an element-like object that was not created by ' +
        '@pibbl/core as a Pibbl child.\n' +
        'Check this file\'s JSX runtime and set jsxImportSource to "@pibbl/core".',
      );
    expect(request).not.toHaveBeenCalled();
    request.mockRestore();

    expect(() => renderNow({ type: 'configuration' }))
      .toThrowError('Pibbl root received an unsupported object as a Pibbl child.');
    expect(() => renderNow({ type: 'configuration' }))
      .not.toThrowError(/JSX runtime|jsxImportSource|React element/);
  });

  it('reports receiver component identity and jsxDEV source for foreign element-like children', () => {
    function Poster(): PibblNode {
      return {
        type: () => undefined,
        props: {},
      } as unknown as PibblNode;
    }
    const root = jsxDEV(
      Poster,
      {},
      undefined,
      false,
      {
        fileName: 'poster.pibbl.tsx',
        lineNumber: 18,
        columnNumber: 7,
      },
      undefined,
    );

    expect(() => renderNow(root)).toThrowError(
      'Poster at poster.pibbl.tsx:18:7 received an element-like object that ' +
      'was not created by @pibbl/core as a Pibbl child.\n' +
      'Check this file\'s JSX runtime and set jsxImportSource to "@pibbl/core".',
    );
  });

  it.each([
    ['a non-empty string', 'interpolated'],
    ['a nonzero number', 42],
    ['a function', () => undefined],
  ])('reports invalid interpolated %s with receiver and source', (description, child) => {
    const Receiver = (() => child) as PibblComponent<any>;
    Object.defineProperty(Receiver, 'name', { value: 'ResultsGrid' });
    const root = jsxDEV(
      Receiver,
      {},
      undefined,
      false,
      {
        fileName: 'results.pibbl.tsx',
        lineNumber: 31,
        columnNumber: 11,
      },
      undefined,
    );

    expect(() => renderNow(root)).toThrowError(
      `ResultsGrid at results.pibbl.tsx:31:11 received ${description} as a Pibbl child.`,
    );
  });

  it('reports React runtime guidance together with receiver and jsxDEV source', () => {
    function ResultsGrid(): PibblNode {
      return {
        $$typeof: Symbol.for('react.transitional.element'),
        type: 'div',
        props: {},
      } as unknown as PibblNode;
    }
    const root = jsxDEV(
      ResultsGrid,
      {},
      undefined,
      false,
      {
        fileName: 'results.pibbl.tsx',
        lineNumber: 44,
        columnNumber: 9,
      },
      undefined,
    );

    expect(() => renderNow(root)).toThrowError(
      'Pibbl received a React element. This file is using the React JSX runtime.\n' +
      'Set jsxImportSource to "@pibbl/core" or add ' +
      '/** @jsxImportSource @pibbl/core */.\n' +
      'Received by ResultsGrid at results.pibbl.tsx:44:9.',
    );
  });

  it('reports direct primitive invocation with both supported constructors', () => {
    expect(() => Rectangle({ style: { width: 10, height: 10 } }))
      .toThrowError(
        'Rectangle is a Pibbl component and was invoked outside the Pibbl renderer.\n' +
        'Use <Rectangle ... /> in a Pibbl JSX file or ' +
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
  const controller = pibbl(canvas, root as PibblNode);
  try {
    if (!pending) throw new Error('Pibbl did not schedule a render.');
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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crc } from '../crc.js';
import { defineComp } from '../define-comp.js';
import { executeRender } from '../execute-render.js';
import { clearSharedState, getCRCInstance } from '../global-state.js';
import { mountCRC } from '../mount-crc.js';
import type { CompFn, CRCNode } from '../types.js';
import {
  materializeContainerChildren,
  materializeTextChildren,
} from './children.js';
import { Fragment, jsx, jsxDEV } from './jsx-runtime.js';

interface ProbeProps {
  value: string;
  rendered: string[];
}

const Probe = defineComp(({ value, rendered }: ProbeProps) => {
  rendered.push(value);
});

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
});

describe('recursive CRC container children', () => {
  it('returns one frozen direct-element sequence from recursive container input', () => {
    const rendered: string[] = [];
    let executions = 0;
    function* children(): Iterable<CRCNode> {
      executions++;
      yield Probe({ key: 'a', value: 'A', rendered });
      yield [null, Probe({ key: 'b', value: 'B', rendered })];
    }

    const prepared = materializeContainerChildren(children(), 'Group');

    expect(prepared.map(element => element.key)).toEqual(['a', 'b']);
    expect(Object.isFrozen(prepared)).toBe(true);
    expect(executions).toBe(1);
  });

  it('materializes recursive text content exactly once without treating zero as empty', () => {
    let executions = 0;
    function* content() {
      executions++;
      yield ['Hello ', 0, false, null];
      yield '!';
    }

    expect(materializeTextChildren(content(), 'Text')).toBe('Hello 0!');
    expect(executions).toBe(1);
    expect(() => materializeTextChildren(
      Probe({ value: 'invalid', rendered: [] }) as never,
      'Text',
    )).toThrowError(/Text.*CRC element/i);
  });

  it('flattens root arrays, nested arrays, iterables, and unkeyed fragments in source order once', async () => {
    const canvas = createCanvas();
    const rendered: string[] = [];
    let generatorExecutions = 0;
    let recursiveIterableExecutions = 0;

    function* rows(): Iterable<CRCNode> {
      generatorExecutions++;
      yield Probe({ key: 'a', value: 'A', rendered });
      yield [false, Probe({ key: 'b', value: 'B', rendered })];
    }

    const recursiveIterable: Iterable<CRCNode> = {
      *[Symbol.iterator]() {
        recursiveIterableExecutions++;
        yield [
          true,
          null,
          undefined,
          '',
          0,
          [Probe({ key: 'c', value: 'C', rendered })],
        ];
      },
    };

    const controller = crc(canvas, jsx(Fragment, {
      children: [
        rows(),
        jsx(Fragment, { children: recursiveIterable }),
        Probe({ key: 'footer', value: 'footer', rendered }),
      ],
    }));
    await nextFrame();

    expect(rendered).toEqual(['A', 'B', 'C', 'footer']);
    expect(generatorExecutions).toBe(1);
    expect(recursiveIterableExecutions).toBe(1);
    controller.dispose();
  });

  it('accepts an initially empty root and commits an explicit undefined root update', async () => {
    const canvas = createCanvas();
    const rendered: string[] = [];
    const controller = crc(canvas, undefined);
    await nextFrame();

    expect(getCRCInstance(canvas).root).toBeUndefined();

    crc(canvas, Probe({ value: 'mounted', rendered }));
    await nextFrame();
    expect(rendered).toEqual(['mounted']);

    crc(canvas, undefined);
    await nextFrame();
    expect(getCRCInstance(canvas).root).toBeUndefined();
    expect(getCRCInstance(canvas).refs.size).toBe(0);
    controller.dispose();
  });

  it('rejects duplicate keys in one sibling scope after transparent flattening', () => {
    const rendered: string[] = [];
    const root = jsx(Fragment, {
      children: [
        [Probe({ key: 'duplicate', value: 'first', rendered })],
        jsx(Fragment, {
          children: Probe({ key: 'duplicate', value: 'second', rendered }),
        }),
      ],
    });

    expect(() => renderNow(root)).toThrowError(/duplicate.*key.*duplicate/i);
    expect(rendered).toEqual([]);
  });

  it.each([
    ['a non-empty string', 'hello', /Receiver.*non-empty string/i],
    ['a nonzero number', 7, /Receiver.*nonzero number/i],
    ['a Promise', Promise.resolve(null), /Receiver.*Promise/i],
    [
      'an async iterable',
      { async *[Symbol.asyncIterator]() { yield null; } },
      /Receiver.*async iterable/i,
    ],
    ['a function', () => undefined, /Receiver.*function/i],
    ['a symbol', Symbol('child'), /Receiver.*symbol/i],
    ['a plain object', { child: true }, /Receiver.*object/i],
  ])('rejects %s with receiver and jsxDEV source context', (_label, child, message) => {
    const Receiver = ((_props: {}, _style, _ctx) => child) as CompFn<{}>;
    const receiver = jsxDEV(
      Receiver as any,
      { style: {} },
      undefined,
      false,
      {
        fileName: 'scene.crc.tsx',
        lineNumber: 17,
        columnNumber: 9,
      },
      undefined,
    );

    expect(() => renderNow(receiver)).toThrowError(message);
    expect(() => renderNow(receiver)).toThrowError(/scene\.crc\.tsx:17:9/);
  });

  it.each([
    Symbol.for('react.element'),
    Symbol.for('react.transitional.element'),
  ])('recognizes the known React element brand %s', reactBrand => {
    const Receiver = (() => ({
      $$typeof: reactBrand,
      type: 'div',
      props: {},
    })) as unknown as CompFn<{}>;
    const receiver = jsxDEV(
      Receiver as any,
      { style: {} },
      undefined,
      false,
      {
        fileName: 'react-scene.crc.tsx',
        lineNumber: 4,
        columnNumber: 3,
      },
      undefined,
    );

    expect(() => renderNow(receiver)).toThrowError(
      'CRC received a React element. This file is using the React JSX runtime.\n' +
      'Set jsxImportSource to "@crc/core" or add ' +
      '/** @jsxImportSource @crc/core */.',
    );
  });
});

function renderNow(root: unknown): void {
  const canvas = createCanvas();
  mountCRC(canvas, root as never);
  executeRender(canvas, 0);
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  return canvas;
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

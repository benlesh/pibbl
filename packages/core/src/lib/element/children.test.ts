import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pibbl } from '../pibbl.js';
import { executeRender } from '../execute-render.js';
import { clearSharedState, getPibblInstance } from '../global-state.js';
import { mountPibbl } from '../mount-pibbl.js';
import type { PibblComponent, PibblNode } from '../types.js';
import {
  materializeContainerChildren,
  materializeTextChildren,
} from './children.js';
import { Fragment, jsx, jsxDEV } from './jsx-runtime.js';
import { signal } from '../signals/graph.js';

interface ProbeProps {
  value: string;
  rendered: string[];
}

function Probe({ value, rendered }: ProbeProps): void {
  rendered.push(value);
}

function probe(input: ProbeProps & { key?: string }) {
  const { key, ...props } = input;
  return jsx(Probe, props, key);
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
});

describe('recursive Pibbl container children', () => {
  it('constructs the shared traversal probe as a plain function element', () => {
    const rendered: string[] = [];
    const element = probe({ value: 'not-rendered', rendered });

    expect(element.type).toBe(Probe);
    expect(rendered).toEqual([]);
  });

  it('returns one frozen direct-element sequence from recursive container input', () => {
    const rendered: string[] = [];
    let executions = 0;
    function* children(): Iterable<PibblNode> {
      executions++;
      yield probe({ key: 'a', value: 'A', rendered });
      yield [null, probe({ key: 'b', value: 'B', rendered })];
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
      probe({ value: 'invalid', rendered: [] }) as never,
      'Text',
    )).toThrowError(/Text.*Pibbl element/i);
  });

  it('resolves signals at declared text grammar positions', () => {
    const label = signal('Current');
    const suffix = signal('!');
    function* tail() {
      yield suffix;
    }

    expect(materializeTextChildren(
      ['Value: ', label, 0, tail()] as never,
      'Text',
    )).toBe('Value: Current0!');
  });

  it('rejects nested signals returned by one signal and cyclic structures', () => {
    const nested = signal(['outer', signal('inner')] as const);
    const cyclic: unknown[] = [];
    cyclic.push(cyclic);

    expect(() => materializeTextChildren(nested as never, 'Text'))
      .toThrowError(/Text.*signal.*resolved/iu);
    expect(() => materializeTextChildren(cyclic as never, 'Text'))
      .toThrowError(/Text.*cyclic/iu);

    const rendered: string[] = [];
    const nestedNode = signal([
      signal<PibblNode>(probe({ value: 'nested', rendered })),
    ] as const);
    expect(() => materializeContainerChildren(nestedNode as never, 'Group'))
      .toThrowError(/Group.*signal.*resolved/iu);
    expect(rendered).toEqual([]);
  });

  it('flattens root arrays, nested arrays, iterables, and unkeyed fragments in source order once', async () => {
    const canvas = createCanvas();
    const rendered: string[] = [];
    let generatorExecutions = 0;
    let recursiveIterableExecutions = 0;

    function* rows(): Iterable<PibblNode> {
      generatorExecutions++;
      yield probe({ key: 'a', value: 'A', rendered });
      yield [false, probe({ key: 'b', value: 'B', rendered })];
    }

    const recursiveIterable: Iterable<PibblNode> = {
      *[Symbol.iterator]() {
        recursiveIterableExecutions++;
        yield [
          true,
          null,
          undefined,
          '',
          0,
          [probe({ key: 'c', value: 'C', rendered })],
        ];
      },
    };

    const controller = pibbl(canvas, jsx(Fragment, {
      children: [
        rows(),
        jsx(Fragment, { children: recursiveIterable }),
        probe({ key: 'footer', value: 'footer', rendered }),
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
    const controller = pibbl(canvas, undefined);
    await nextFrame();

    expect(getPibblInstance(canvas).root).toBeUndefined();

    pibbl(canvas, probe({ value: 'mounted', rendered }));
    await nextFrame();
    expect(rendered).toEqual(['mounted']);

    pibbl(canvas, undefined);
    await nextFrame();
    expect(getPibblInstance(canvas).root).toBeUndefined();
    expect(getPibblInstance(canvas).refs.size).toBe(0);
    controller.dispose();
  });

  it('owns component-result signals at the receiving component', async () => {
    const canvas = createCanvas();
    const rendered: string[] = [];
    const selected = signal<PibblNode>(probe({ value: 'A', rendered }));
    const Receiver = (() => selected) as unknown as PibblComponent<{}>;
    const controller = pibbl(canvas, jsx(Receiver, {}));
    await nextFrame();

    expect(rendered).toEqual(['A']);
    expect(Array.from(getPibblInstance(canvas).refs.values())
      .find(ref => ref.element.type === Receiver)?.signalConsumer)
      .toBeDefined();

    selected.set(probe({ value: 'B', rendered }));
    await nextFrame();
    expect(rendered).toEqual(['A', 'B']);
    controller.dispose();
  });

  it('makes keyed Fragments own child signals and leaves unkeyed ones transparent', async () => {
    const rendered: string[] = [];
    const selected = signal<PibblNode>(probe({ value: 'keyed', rendered }));
    const keyedCanvas = createCanvas();
    const keyed = jsx(Fragment, { children: selected as never }, 'owner');
    const keyedController = pibbl(keyedCanvas, keyed);
    await nextFrame();
    const keyedRefs = Array.from(getPibblInstance(keyedCanvas).refs.values());

    expect(rendered).toEqual(['keyed']);
    expect(keyedRefs.find(ref => ref.element.type === Fragment)?.signalConsumer)
      .toBeDefined();
    keyedController.dispose();

    rendered.length = 0;
    const unkeyedCanvas = createCanvas();
    const Receiver = (() => jsx(Fragment, {
      children: selected as never,
    })) as PibblComponent<{}>;
    const unkeyedController = pibbl(unkeyedCanvas, jsx(Receiver, {}));
    await nextFrame();
    const unkeyedRefs = Array.from(getPibblInstance(unkeyedCanvas).refs.values());

    expect(rendered).toEqual(['keyed']);
    expect(unkeyedRefs.find(ref => ref.element.type === Receiver)?.signalConsumer)
      .toBeDefined();
    expect(unkeyedRefs.some(ref => ref.element.type === Fragment)).toBe(false);
    unkeyedController.dispose();
  });

  it('rejects a bare signal at the Pibbl root', () => {
    expect(() => renderNow(signal<PibblNode>(undefined) as never))
      .toThrowError(/Pibbl root.*signal.*component/iu);
  });

  it('rejects duplicate keys in one sibling scope after transparent flattening', () => {
    const rendered: string[] = [];
    const root = jsx(Fragment, {
      children: [
        [probe({ key: 'duplicate', value: 'first', rendered })],
        jsx(Fragment, {
          children: probe({ key: 'duplicate', value: 'second', rendered }),
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
    const Receiver = (() => child) as PibblComponent<any>;
    const receiver = jsxDEV(
      Receiver as any,
      { style: {} },
      undefined,
      false,
      {
        fileName: 'scene.pibbl.tsx',
        lineNumber: 17,
        columnNumber: 9,
      },
      undefined,
    );

    expect(() => renderNow(receiver)).toThrowError(message);
    expect(() => renderNow(receiver)).toThrowError(/scene\.pibbl\.tsx:17:9/);
  });

  it.each([
    Symbol.for('react.element'),
    Symbol.for('react.transitional.element'),
  ])('recognizes the known React element brand %s', reactBrand => {
    const Receiver = (() => ({
      $$typeof: reactBrand,
      type: 'div',
      props: {},
    })) as unknown as PibblComponent<any>;
    const receiver = jsxDEV(
      Receiver as any,
      { style: {} },
      undefined,
      false,
      {
        fileName: 'react-scene.pibbl.tsx',
        lineNumber: 4,
        columnNumber: 3,
      },
      undefined,
    );

    expect(() => renderNow(receiver)).toThrowError(
      'Pibbl received a React element. This file is using the React JSX runtime.\n' +
      'Set jsxImportSource to "@pibbl/core" or add ' +
      '/** @jsxImportSource @pibbl/core */.',
    );
  });
});

function renderNow(root: unknown): void {
  const canvas = createCanvas();
  mountPibbl(canvas, root as never);
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

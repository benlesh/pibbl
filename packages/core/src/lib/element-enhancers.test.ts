import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { absolute } from './layout/absolute';
import { crc } from './crc';
import { defineComp } from './define-comp';
import { executeRender } from './execute-render';
import {
  clearSharedState,
  getComponentRefs,
  getCRCInstance,
} from './global-state';
import { crcLayoutBox } from './hooks/crc-layout-box';
import { crcState, type StateUpdater } from './hooks/crc-state';
import { measureElement } from './layout/measure';
import { mountCRC } from './mount-crc';
import { withFocusManagement } from './focus/with-focus-management';
import { withKeyboardNavigation } from './focus/with-keyboard-navigation';
import type { CRCKeyboardNavigationOptions } from './focus/types';
import type {
  CompEl,
  CompRefs,
  CRCInstance,
  MeasureResult,
  SystemStyle,
} from './types';

interface TestMountedEnhancer {
  update(next: TestEnhancerDescriptor): void;
  enter(): void;
  exit(success: boolean): void;
  dispose(): void;
}

interface TestEnhancerDescriptor {
  readonly key: symbol;
  readonly generation: number;
  mount(context: {
    readonly component: CompRefs<any>;
    readonly instance: CRCInstance;
  }): TestMountedEnhancer;
}

const activeControllers = new Set<{ dispose(): void }>();

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(() => {
  for (const controller of activeControllers) controller.dispose();
  activeControllers.clear();
  clearSharedState();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('identity-transparent element enhancers', () => {
  it('preserves keyed state, component path, parent, layout, measurement, and paint order', async () => {
    const lifecycle: string[] = [];
    const observations: Array<{
      box: Readonly<{ x: number; y: number; width: number; height: number }>;
      id: string;
      parentId: string | undefined;
      state: number;
    }> = [];
    let setState: StateUpdater<number> | undefined;
    let descriptorGeneration = 0;

    interface ChildStyle extends SystemStyle {
      width: number;
      height: number;
    }
    const Child = defineComp<{}, ChildStyle>((_props, style, context) => {
      const refs = getComponentRefs();
      const [state, updateState] = crcState(0);
      setState = updateState;
      observations.push({
        box: crcLayoutBox(),
        id: refs.id,
        parentId: refs.parent?.id,
        state,
      });
      lifecycle.push('paint:child');
      context.fillStyle = '#ef4444';
      context.fillRect(0, 0, style.width, style.height);
    }, {
      measure: (): MeasureResult => ({
        status: 'measured',
        size: { width: 30, height: 20 },
      }),
    });
    const Paint = defineComp<{
      label: string;
      fill: string;
    }, ChildStyle>(({ label, fill }, _style, context) => {
      lifecycle.push(`paint:${label}`);
      context.fillStyle = fill;
      context.fillRect(0, 0, 30, 20);
    });
    const enhancerKey = Symbol('identity');
    const descriptor = () => createDescriptor(
      'identity',
      enhancerKey,
      ++descriptorGeneration,
      lifecycle,
    );
    const Host = defineComp(({ enhanced }: { enhanced: boolean }) => {
      const child = Child({ key: 'stable', style: { width: 30, height: 20 } });
      return absolute({
        style: { width: 80, height: 60 },
        children: [
          Paint({
            label: 'before',
            fill: '#2563eb',
            style: { width: 30, height: 20 },
          }),
          enhanced ? annotate(child, [descriptor()]) : child,
          Paint({
            label: 'after',
            fill: '#22c55e',
            style: { width: 30, height: 20 },
          }),
        ],
      });
    });

    const measurable = Child({ key: 'stable', style: { width: 30, height: 20 } });
    expect(measureElement(annotate(measurable, [descriptor()]), {
      minWidth: 0,
      maxWidth: 100,
      minHeight: 0,
      maxHeight: 100,
    }, {
      measureText: () => ({ width: 0 }) as TextMetrics,
    })).toEqual({ status: 'measured', size: { width: 30, height: 20 } });
    expect(lifecycle).toEqual([]);

    const canvas = createCanvas();
    const controller = crc(canvas, Host({ enhanced: true }));
    activeControllers.add(controller);
    await nextFrame();
    const first = observations[0];
    expect(first).toMatchObject({ state: 0, box: { x: 0, y: 0, width: 30, height: 20 } });
    expect(lifecycle.filter(item => item.startsWith('paint:'))).toEqual([
      'paint:before',
      'paint:child',
      'paint:after',
    ]);
    expect(pixelAt(canvas, 10, 10)).toEqual([34, 197, 94, 255]);

    lifecycle.length = 0;
    setState?.(1);
    await nextFrame();
    crc(canvas, Host({ enhanced: false }));
    await nextFrame();
    const last = observations.at(-1)!;

    expect(last.id).toBe(first.id);
    expect(last.parentId).toBe(first.parentId);
    expect(last.state).toBe(1);
    expect(last.box).toBe(first.box);
    expect(lifecycle.filter(item => item.startsWith('paint:')).slice(-3)).toEqual([
      'paint:before',
      'paint:child',
      'paint:after',
    ]);
  });

  it('mounts once, updates every render, scopes in declaration order, and disposes missing metadata before render', async () => {
    const trace: string[] = [];
    const firstKey = Symbol('first');
    const secondKey = Symbol('second');
    const Child = defineComp(() => {
      trace.push('render:child');
    });
    const Root = defineComp(({
      firstGeneration,
      order,
      showSecond,
    }: {
      firstGeneration: number;
      order: 'forward' | 'reverse';
      showSecond: boolean;
    }) => {
      trace.push('render:root');
      const descriptors = [
        createDescriptor('first', firstKey, firstGeneration, trace),
        ...(showSecond ? [createDescriptor('second', secondKey, firstGeneration, trace)] : []),
      ];
      if (order === 'reverse') descriptors.reverse();
      return annotate(Child({ key: 'stable' }), descriptors);
    });
    const canvas = createCanvas();
    const controller = crc(canvas, Root({
      firstGeneration: 1,
      order: 'forward',
      showSecond: true,
    }));
    activeControllers.add(controller);
    await nextFrame();

    expect(trace).toEqual([
      'render:root',
      'mount:first',
      'update:first:1',
      'mount:second',
      'update:second:1',
      'enter:first',
      'enter:second',
      'render:child',
      'exit:second:true',
      'exit:first:true',
    ]);

    trace.length = 0;
    crc(canvas, Root({
      firstGeneration: 2,
      order: 'reverse',
      showSecond: true,
    }));
    await nextFrame();
    expect(trace).toEqual([
      'render:root',
      'update:second:2',
      'update:first:2',
      'enter:second',
      'enter:first',
      'render:child',
      'exit:first:true',
      'exit:second:true',
    ]);

    trace.length = 0;
    crc(canvas, Root({
      firstGeneration: 3,
      order: 'forward',
      showSecond: false,
    }));
    await nextFrame();
    expect(trace).toEqual([
      'render:root',
      'update:first:3',
      'dispose:second',
      'enter:first',
      'render:child',
      'exit:first:true',
    ]);

    trace.length = 0;
    controller.dispose();
    controller.dispose();
    expect(trace).toEqual(['dispose:first']);
  });

  it('exits and disposes in exact reverse order after a descendant render failure', () => {
    const trace: string[] = [];
    const Throwing = defineComp(() => {
      trace.push('render:throwing');
      throw new Error('expected descendant failure');
    });
    const Parent = defineComp(() => annotate(Throwing({}), [
      createDescriptor('first', Symbol('first'), 1, trace),
      createDescriptor('second', Symbol('second'), 1, trace),
    ]));
    const canvas = createCanvas();
    const controller = mountCRC(canvas, Parent({}));
    activeControllers.add(controller);

    expect(() => executeRender(canvas, 1)).toThrowError('expected descendant failure');
    expect(trace).toEqual([
      'mount:first',
      'update:first:1',
      'mount:second',
      'update:second:1',
      'enter:first',
      'enter:second',
      'render:throwing',
      'exit:second:false',
      'exit:first:false',
      'dispose:second',
      'dispose:first',
    ]);
    expect(getCRCInstance(canvas).refs.size).toBe(0);

    controller.dispose();
    controller.dispose();
    expect(trace.at(-1)).toBe('dispose:first');
  });
});

describe('built-in enhancer constructors', () => {
  it('preserves exact element fields while appending focus and directional descriptors', () => {
    interface ConstructorStyle extends SystemStyle {
      width: number;
    }
    const Component = defineComp<{ value: number }, ConstructorStyle>(() => undefined);
    const element = Component({ key: 'stable', value: 7, style: { width: 20 } });
    const identityHint = { type: element.type, key: element.key, occurrence: 3 };
    element.identityHint = identityHint;

    const enhanced = withFocusManagement(
      withKeyboardNavigation(element, { mode: 'directional' }),
    );

    expect(enhanced).not.toBe(element);
    expect(enhanced.type).toBe(element.type);
    expect(enhanced.props).toBe(element.props);
    expect(enhanced.style).toBe(element.style);
    expect(enhanced.key).toBe('stable');
    expect(enhanced.identityHint).toBe(identityHint);
    expect(readEnhancers(enhanced)).toHaveLength(2);
    expect(readEnhancers(enhanced)[0].key).not.toBe(readEnhancers(enhanced)[1].key);
  });

  it('rejects duplicate focus and directional enhancers with targeted errors', () => {
    const Component = defineComp(() => undefined);

    const focused = withFocusManagement(Component({}));
    expect(() => withFocusManagement(focused)).toThrowError(/withFocusManagement.*same.*element/i);

    const directional = withKeyboardNavigation(Component({}), { mode: 'directional' });
    expect(() => withKeyboardNavigation(directional, { mode: 'directional' }))
      .toThrowError(/withKeyboardNavigation.*same.*element/i);
  });

  it('accepts only directional keyboard-navigation mode', () => {
    const Component = defineComp(() => undefined);
    const options: CRCKeyboardNavigationOptions = { mode: 'directional' };

    expect(withKeyboardNavigation(Component({}), options).type)
      .toBe(Component({}).type);

    expect(() => withKeyboardNavigation(Component({}), { mode: 'linear' } as never))
      .toThrowError(/mode.*directional/i);
  });
});

function annotate<P>(
  element: CompEl<P, any>,
  enhancers: readonly TestEnhancerDescriptor[],
): CompEl<P, any> {
  return { ...element, enhancers } as CompEl<P, any>;
}

function createDescriptor(
  name: string,
  key: symbol,
  generation: number,
  trace: string[],
): TestEnhancerDescriptor {
  return {
    key,
    generation,
    mount() {
      trace.push(`mount:${name}`);
      return {
        update(next) {
          trace.push(`update:${name}:${next.generation}`);
        },
        enter() {
          trace.push(`enter:${name}`);
        },
        exit(success) {
          trace.push(`exit:${name}:${success}`);
        },
        dispose() {
          trace.push(`dispose:${name}`);
        },
      };
    },
  };
}

function readEnhancers(element: CompEl<any, any>): readonly TestEnhancerDescriptor[] {
  return (element as CompEl<any, any> & {
    enhancers: readonly TestEnhancerDescriptor[];
  }).enhancers;
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 80;
  document.body.appendChild(canvas);
  return canvas;
}

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): readonly number[] {
  return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

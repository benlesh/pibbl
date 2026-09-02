import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { absolute } from './layout/absolute';
import { crc } from './crc';
import { defineComp } from './define-comp';
import { appendElementEnhancer } from './element-enhancers';
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
import type { CompEl as PublicCompEl } from '../index';

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

interface TestDescriptorFailures {
  mount?: boolean;
  update?: boolean;
  enter?: boolean;
  exit?: boolean;
  dispose?: boolean;
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

  it('creates enhancer teardown ownership lazily once across removal and re-add', () => {
    const trace: string[] = [];
    const enhancerKey = Symbol('lazy-owner');
    const Component = defineComp(() => {
      trace.push('render:component');
    });
    const plainElement = () => Component({ key: 'stable' });
    const enhancedElement = (generation: number) => annotate(plainElement(), [
      createDescriptor('lazy-owner', enhancerKey, generation, trace),
    ]);
    const canvas = createCanvas();
    const controller = mountCRC(canvas, plainElement());
    activeControllers.add(controller);

    executeRender(canvas, 1);
    const instance = getCRCInstance(canvas);
    const component = Array.from(instance.refs.values())[0];
    expect(instance.refs.size).toBe(1);
    expect(teardownCount(component.teardowns)).toBe(1);
    expect(trace).toEqual(['render:component']);

    trace.length = 0;
    executeRender(canvas, 2, enhancedElement(1));
    expect(Array.from(instance.refs.values())[0]).toBe(component);
    expect(teardownCount(component.teardowns)).toBe(2);
    expect(trace).toEqual([
      'mount:lazy-owner',
      'update:lazy-owner:1',
      'enter:lazy-owner',
      'render:component',
      'exit:lazy-owner:true',
    ]);

    trace.length = 0;
    executeRender(canvas, 3, plainElement());
    expect(teardownCount(component.teardowns)).toBe(2);
    expect(trace).toEqual(['dispose:lazy-owner', 'render:component']);

    trace.length = 0;
    executeRender(canvas, 4, enhancedElement(2));
    expect(teardownCount(component.teardowns)).toBe(2);
    expect(trace).toEqual([
      'mount:lazy-owner',
      'update:lazy-owner:2',
      'enter:lazy-owner',
      'render:component',
      'exit:lazy-owner:true',
    ]);

    trace.length = 0;
    controller.dispose();
    controller.dispose();
    expect(trace).toEqual(['dispose:lazy-owner']);
    expect(teardownCount(component.teardowns)).toBe(0);
  });

  it('exits an enhanced parent after its throwing descendant with success false', () => {
    const trace: string[] = [];
    const Throwing = defineComp(() => {
      trace.push('render:throwing');
      throw new Error('expected descendant failure');
    });
    const Parent = defineComp(() => {
      trace.push('render:parent');
      return Throwing({});
    });
    const enhancedParent = annotate(Parent({}), [
      createDescriptor('first', Symbol('first'), 1, trace),
      createDescriptor('second', Symbol('second'), 1, trace),
    ]);
    const canvas = createCanvas();
    const controller = mountCRC(canvas, enhancedParent);
    activeControllers.add(controller);

    expect(() => executeRender(canvas, 1)).toThrowError('expected descendant failure');
    expect(trace).toEqual([
      'mount:first',
      'update:first:1',
      'mount:second',
      'update:second:1',
      'enter:first',
      'enter:second',
      'render:parent',
      'render:throwing',
      'exit:second:false',
      'exit:first:false',
      'dispose:second',
      'dispose:first',
    ]);
    expect(getCRCInstance(canvas).refs.size).toBe(0);

    const afterFailure = [...trace];
    controller.dispose();
    controller.dispose();
    expect(trace).toEqual(afterFailure);
  });

  it('releases newly acquired entries before preserving existing ownership through a mount failure', () => {
    const trace: string[] = [];
    const existingKey = Symbol('existing');
    const acquiredKey = Symbol('acquired');
    const Leaf = defineComp(() => undefined);
    const Root = defineComp(({ failing }: { failing: boolean }) => annotate(
      Leaf({ key: 'stable' }),
      failing ? [
        createDescriptor('existing', existingKey, 2, trace),
        createDescriptor('acquired', acquiredKey, 2, trace),
        createDescriptor('mount-failure', Symbol('mount-failure'), 2, trace, {
          mount: true,
        }),
      ] : [createDescriptor('existing', existingKey, 1, trace)],
    ));
    const canvas = createCanvas();
    const controller = mountCRC(canvas, Root({ failing: false }));
    activeControllers.add(controller);
    executeRender(canvas, 1);
    trace.length = 0;

    expect(() => executeRender(canvas, 2, Root({ failing: true })))
      .toThrowError('mount:mount-failure:failed');
    expect(trace).toEqual([
      'update:existing:2',
      'mount:acquired',
      'update:acquired:2',
      'mount:mount-failure',
      'dispose:acquired',
      'dispose:existing',
    ]);
    expect(getCRCInstance(canvas).refs.size).toBe(0);

    const afterFailure = [...trace];
    controller.dispose();
    controller.dispose();
    expect(trace).toEqual(afterFailure);
  });

  it('releases all newly acquired entries in reverse before existing ownership after an update failure', () => {
    const trace: string[] = [];
    const existingKey = Symbol('existing');
    const Leaf = defineComp(() => undefined);
    const Root = defineComp(({ failing }: { failing: boolean }) => annotate(
      Leaf({ key: 'stable' }),
      failing ? [
        createDescriptor('existing', existingKey, 2, trace),
        createDescriptor('acquired', Symbol('acquired'), 2, trace),
        createDescriptor('update-failure', Symbol('update-failure'), 2, trace, {
          update: true,
        }),
      ] : [createDescriptor('existing', existingKey, 1, trace)],
    ));
    const canvas = createCanvas();
    const controller = mountCRC(canvas, Root({ failing: false }));
    activeControllers.add(controller);
    executeRender(canvas, 1);
    trace.length = 0;

    expect(() => executeRender(canvas, 2, Root({ failing: true })))
      .toThrowError('update:update-failure:failed');
    expect(trace).toEqual([
      'update:existing:2',
      'mount:acquired',
      'update:acquired:2',
      'mount:update-failure',
      'update:update-failure:2',
      'dispose:update-failure',
      'dispose:acquired',
      'dispose:existing',
    ]);
    expect(getCRCInstance(canvas).refs.size).toBe(0);

    const afterFailure = [...trace];
    controller.dispose();
    controller.dispose();
    expect(trace).toEqual(afterFailure);
  });

  it('unwinds already-entered scopes and disposes every mounted entry after a later enter fails', () => {
    const trace: string[] = [];
    const Root = defineComp(() => undefined);
    const enhanced = annotate(Root({}), [
      createDescriptor('first', Symbol('first'), 1, trace),
      createDescriptor('enter-failure', Symbol('enter-failure'), 1, trace, {
        enter: true,
      }),
      createDescriptor('never-entered', Symbol('never-entered'), 1, trace),
    ]);
    const canvas = createCanvas();
    const controller = mountCRC(canvas, enhanced);
    activeControllers.add(controller);

    expect(() => executeRender(canvas, 1)).toThrowError('enter:enter-failure:failed');
    expect(trace).toEqual([
      'mount:first',
      'update:first:1',
      'mount:enter-failure',
      'update:enter-failure:1',
      'mount:never-entered',
      'update:never-entered:1',
      'enter:first',
      'enter:enter-failure',
      'exit:first:false',
      'dispose:never-entered',
      'dispose:enter-failure',
      'dispose:first',
    ]);

    const afterFailure = [...trace];
    controller.dispose();
    controller.dispose();
    expect(trace).toEqual(afterFailure);
  });

  it('marks outer exits unsuccessful and runs every exit after the inner exit throws', () => {
    const trace: string[] = [];
    const Root = defineComp(() => {
      trace.push('render:root');
    });
    const enhanced = annotate(Root({}), [
      createDescriptor('outer', Symbol('outer'), 1, trace),
      createDescriptor('middle', Symbol('middle'), 1, trace),
      createDescriptor('inner', Symbol('inner'), 1, trace, { exit: true }),
    ]);
    const canvas = createCanvas();
    const controller = mountCRC(canvas, enhanced);
    activeControllers.add(controller);

    expect(() => executeRender(canvas, 1)).toThrowError('exit:inner:failed');
    expect(trace).toEqual([
      'mount:outer',
      'update:outer:1',
      'mount:middle',
      'update:middle:1',
      'mount:inner',
      'update:inner:1',
      'enter:outer',
      'enter:middle',
      'enter:inner',
      'render:root',
      'exit:inner:true',
      'exit:middle:false',
      'exit:outer:false',
      'dispose:inner',
      'dispose:middle',
      'dispose:outer',
    ]);

    const afterFailure = [...trace];
    controller.dispose();
    controller.dispose();
    expect(trace).toEqual(afterFailure);
  });

  it('continues reverse disposal after an inner disposer throws and never disposes twice', () => {
    const trace: string[] = [];
    const reportError = vi.spyOn(globalThis, 'reportError').mockImplementation(() => {});
    const Root = defineComp(() => undefined);
    const enhanced = annotate(Root({}), [
      createDescriptor('outer', Symbol('outer'), 1, trace),
      createDescriptor('throwing', Symbol('throwing'), 1, trace, { dispose: true }),
      createDescriptor('inner', Symbol('inner'), 1, trace),
    ]);
    const canvas = createCanvas();
    const controller = mountCRC(canvas, enhanced);
    activeControllers.add(controller);
    executeRender(canvas, 1);
    trace.length = 0;

    controller.dispose();
    controller.dispose();

    expect(trace).toEqual([
      'dispose:inner',
      'dispose:throwing',
      'dispose:outer',
    ]);
    expect(reportError).toHaveBeenCalledOnce();
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
    expect('enhancers' in enhanced).toBe(false);
    expect(Object.keys(enhanced)).toEqual([
      'type',
      'props',
      'key',
    ]);
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

  it('rejects unbranded descriptor copies with arbitrary string metadata', () => {
    type PublicElementHasEnhancers = 'enhancers' extends keyof PublicCompEl
      ? true
      : false;
    const publicElementHasEnhancers: PublicElementHasEnhancers = false;
    const mount = vi.fn(() => ({
      update: () => undefined,
      enter: () => undefined,
      exit: () => undefined,
      dispose: () => undefined,
    }));
    const Component = defineComp(() => undefined);
    const descriptor = { key: Symbol('unsupported'), mount };
    const element = Component({});
    const unsupported: PublicCompEl = {
      ...element,
      // @ts-expect-error arbitrary enhancer metadata is not public CRC element input
      enhancers: [descriptor],
    };
    const canvas = createCanvas();
    const controller = mountCRC(canvas, unsupported);
    activeControllers.add(controller);

    expect(publicElementHasEnhancers).toBe(false);
    expect(() => executeRender(canvas, 1))
      .toThrowError(/CRC root.*unsupported object/i);
    expect(mount).not.toHaveBeenCalled();
  });
});

function annotate<P>(
  element: CompEl<P, any>,
  enhancers: readonly TestEnhancerDescriptor[],
): CompEl<P, any> {
  return enhancers.reduce(
    (enhanced, descriptor) => appendElementEnhancer(enhanced, descriptor),
    element,
  );
}

function createDescriptor(
  name: string,
  key: symbol,
  generation: number,
  trace: string[],
  failures: Readonly<TestDescriptorFailures> = {},
): TestEnhancerDescriptor {
  return {
    key,
    generation,
    mount() {
      trace.push(`mount:${name}`);
      if (failures.mount) throw new Error(`mount:${name}:failed`);
      return {
        update(next) {
          trace.push(`update:${name}:${next.generation}`);
          if (failures.update) throw new Error(`update:${name}:failed`);
        },
        enter() {
          trace.push(`enter:${name}`);
          if (failures.enter) throw new Error(`enter:${name}:failed`);
        },
        exit(success) {
          trace.push(`exit:${name}:${success}`);
          if (failures.exit) throw new Error(`exit:${name}:failed`);
        },
        dispose() {
          trace.push(`dispose:${name}`);
          if (failures.dispose) throw new Error(`dispose:${name}:failed`);
        },
      };
    },
  };
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 80;
  document.body.appendChild(canvas);
  return canvas;
}

function teardownCount(teardowns: unknown): number {
  return (Reflect.get(teardowns as object, '_teardowns') as Set<unknown>).size;
}

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): readonly number[] {
  return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

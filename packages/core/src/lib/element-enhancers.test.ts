import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cloneCRCElement,
  createElement,
  isCRCElement,
} from './element/create-element';
import { materializeContainerChildren } from './element/children';
import {
  getPlacementIdentityHint,
  setPlacementIdentityHint,
} from './element/metadata';
import { Absolute } from './layout/absolute';
import { Flow } from './layout/flow';
import { Flex } from './layout/flex';
import { Grid } from './layout/grid';
import { Layer } from './components/layer';
import { crc } from './crc';
import {
  appendElementEnhancer,
  getElementEnhancerDescriptors,
} from './element-enhancers';
import { executeRender } from './execute-render';
import {
  clearSharedState,
  getComponentRefs,
  getCRCInstance,
} from './global-state';
import { useLayoutBox } from './hooks/use-layout-box';
import { useEventListener } from './hooks/use-event-listener';
import { useEventTarget } from './hooks/use-event-target';
import { useState, type StateUpdater } from './hooks/use-state';
import { measureElement } from './layout/measure';
import { mountCRC } from './mount-crc';
import {
  directionalPolicy,
  focusManaged,
} from './focus/policy-test-support';
import type { CRCKeyboardNavigationOptions } from './focus/types';
import type { BoxStyle, LayoutItemStyle } from './style/types';
import type { CRCComponentRefs, CRCElement, CRCNode, CRCInstance, MeasureResult, SystemStyle } from './types';
import type { CRCElement as PublicCRCElement } from '../index';
import { definePrimitive } from './define-primitive';
import {
  crcInternalCreatePropAttachment,
  type CRCInternalMountedPropAttachment,
  type CRCInternalPrimitiveAttachmentInput,
} from '@crc/core/internal';

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
    readonly component: CRCComponentRefs<any>;
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

interface EnhancerLayoutStyle extends BoxStyle, LayoutItemStyle {}

interface ResolvedEnhancerLayoutStyle extends SystemStyle {
  readonly width: number;
  readonly height: number;
}

interface TestAttachmentValue {
  readonly generation: number;
  readonly name: string;
}

interface AttachmentPrimitiveProps {
  readonly children?: CRCNode;
  readonly physics?: TestAttachmentValue;
}

interface AttachmentPrimitiveStyle extends SystemStyle, BoxStyle, LayoutItemStyle {
  readonly width: number;
  readonly height: number;
}

interface ResolvedAttachmentPrimitiveStyle extends SystemStyle {
  readonly width: number;
  readonly height: number;
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
  it('keeps focus policies transparent to keyed state, component path, parent, layout, measurement, and paint order', async () => {
    const lifecycle: string[] = [];
    const eventPaths: Array<readonly unknown[]> = [];
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
    const Child = definePrimitive<{}, ChildStyle>((_props, style, context) => {
      const refs = getComponentRefs();
      const [state, updateState] = useState(0);
      setState = updateState;
      observations.push({
        box: useLayoutBox(),
        id: refs.id,
        parentId: refs.parent?.id,
        state,
      });
      const eventPath = new Path2D();
      eventPath.rect(0, 0, style.width, style.height);
      useEventTarget({
        onClick: event => eventPaths.push(event.composedPath()),
      }, { path: eventPath, fill: true });
      lifecycle.push('paint:child');
      context.fillStyle = '#ef4444';
      context.fillRect(0, 0, style.width, style.height);
    }, {
      measure: (): MeasureResult => ({
        status: 'measured',
        size: { width: 30, height: 20 },
      }),
    });
    const Paint = definePrimitive<{
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
    const Host = ({ enhanced }: { enhanced: boolean }) => {
      useEventListener({ onClick: () => undefined });
      const child = createElement(Child, { key: 'stable', style: { width: 30, height: 20 } });
      return createElement(Absolute, {
        style: { width: 80, height: 60 },
        children: [
          createElement(Paint, {
            label: 'before',
            fill: '#2563eb',
            style: { width: 30, height: 20 },
          }),
          enhanced ? focusManaged(directionalPolicy(
            annotate(child, [descriptor()]),
          )) : child,
          createElement(Paint, {
            label: 'after',
            fill: '#22c55e',
            style: { width: 30, height: 20 },
          }),
        ],
      });
    };

    const measurable = createElement(Child, { key: 'stable', style: { width: 30, height: 20 } });
    const [preparedMeasurable] = materializeContainerChildren(
      focusManaged(directionalPolicy(annotate(measurable, [descriptor()]))),
      'measurement test',
    );
    expect(measureElement(preparedMeasurable, {
      minWidth: 0,
      maxWidth: 100,
      minHeight: 0,
      maxHeight: 100,
    }, {
      measureText: () => ({ width: 0 }) as TextMetrics,
    })).toEqual({ status: 'measured', size: { width: 30, height: 20 } });
    expect(lifecycle).toEqual([]);

    const canvas = createCanvas();
    const controller = crc(canvas, createElement(Host, { enhanced: true }));
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
    dispatchClick(canvas, 10, 10);
    expect(eventPaths).toHaveLength(1);
    expect(eventPaths[0]).toHaveLength(2);

    lifecycle.length = 0;
    setState?.(1);
    await nextFrame();
    crc(canvas, createElement(Host, { enhanced: false }));
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
    dispatchClick(canvas, 10, 10);
    expect(eventPaths[1]).toEqual(eventPaths[0]);
  });

  it('mounts once, updates every render, scopes in declaration order, and disposes missing metadata before render', async () => {
    const trace: string[] = [];
    const firstKey = Symbol('first');
    const secondKey = Symbol('second');
    const Child = (_props: {}) => {
      trace.push('render:child');
    };
    const Root = ({
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
      return annotate(createElement(Child, { key: 'stable' }), descriptors);
    };
    const canvas = createCanvas();
    const controller = crc(canvas, createElement(Root, {
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
    crc(canvas, createElement(Root, {
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
    crc(canvas, createElement(Root, {
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
    const Component = (_props: {}) => {
      trace.push('render:component');
    };
    const plainElement = () => createElement(Component, { key: 'stable' });
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
    expect(teardownCount(component.teardowns)).toBe(2);
    expect(trace).toEqual(['render:component']);

    trace.length = 0;
    executeRender(canvas, 2, enhancedElement(1));
    expect(Array.from(instance.refs.values())[0]).toBe(component);
    expect(teardownCount(component.teardowns)).toBe(3);
    expect(trace).toEqual([
      'mount:lazy-owner',
      'update:lazy-owner:1',
      'enter:lazy-owner',
      'render:component',
      'exit:lazy-owner:true',
    ]);

    trace.length = 0;
    executeRender(canvas, 3, plainElement());
    expect(teardownCount(component.teardowns)).toBe(3);
    expect(trace).toEqual(['dispose:lazy-owner', 'render:component']);

    trace.length = 0;
    executeRender(canvas, 4, enhancedElement(2));
    expect(teardownCount(component.teardowns)).toBe(3);
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
    const Throwing = (_props: {}) => {
      trace.push('render:throwing');
      throw new Error('expected descendant failure');
    };
    const Parent = (_props: {}) => {
      trace.push('render:parent');
      return createElement(Throwing, {});
    };
    const enhancedParent = annotate(createElement(Parent, {}), [
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
    const Leaf = (_props: {}) => undefined;
    const Root = ({ failing }: { failing: boolean }) => annotate(
      createElement(Leaf, { key: 'stable' }),
      failing ? [
        createDescriptor('existing', existingKey, 2, trace),
        createDescriptor('acquired', acquiredKey, 2, trace),
        createDescriptor('mount-failure', Symbol('mount-failure'), 2, trace, {
          mount: true,
        }),
      ] : [createDescriptor('existing', existingKey, 1, trace)],
    );
    const canvas = createCanvas();
    const controller = mountCRC(canvas, createElement(Root, { failing: false }));
    activeControllers.add(controller);
    executeRender(canvas, 1);
    trace.length = 0;

    expect(() => executeRender(canvas, 2, createElement(Root, { failing: true })))
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
    const Leaf = (_props: {}) => undefined;
    const Root = ({ failing }: { failing: boolean }) => annotate(
      createElement(Leaf, { key: 'stable' }),
      failing ? [
        createDescriptor('existing', existingKey, 2, trace),
        createDescriptor('acquired', Symbol('acquired'), 2, trace),
        createDescriptor('update-failure', Symbol('update-failure'), 2, trace, {
          update: true,
        }),
      ] : [createDescriptor('existing', existingKey, 1, trace)],
    );
    const canvas = createCanvas();
    const controller = mountCRC(canvas, createElement(Root, { failing: false }));
    activeControllers.add(controller);
    executeRender(canvas, 1);
    trace.length = 0;

    expect(() => executeRender(canvas, 2, createElement(Root, { failing: true })))
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
    const Root = (_props: {}) => undefined;
    const enhanced = annotate(createElement(Root, {}), [
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
    const Root = (_props: {}) => {
      trace.push('render:root');
    };
    const enhanced = annotate(createElement(Root, {}), [
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
    const Root = (_props: {}) => undefined;
    const enhanced = annotate(createElement(Root, {}), [
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

describe('registered primitive prop attachments', () => {
  it('mounts once, updates recreated values, scopes resolved traversal, and disposes on removal and root teardown', () => {
    const trace: string[] = [];
    const Child = (_props: {}) => {
      trace.push('render:child');
    };
    const Primitive = definePrimitive<
      AttachmentPrimitiveProps,
      AttachmentPrimitiveStyle,
      AttachmentPrimitiveStyle,
      ResolvedAttachmentPrimitiveStyle
    >((props, style) => {
      trace.push(`render:primitive:${style.width}x${style.height}`);
      return props.children;
    }, {
      resolveStyle: style => ({
        width: style.width,
        height: style.height,
      }),
    });
    const build = (generation: number, attached: boolean) => createElement(
      Primitive,
      {
        key: 'stable',
        physics: attached ? createAttachment('body', generation, trace) : undefined,
        style: { width: 30 + generation, height: 20 },
        children: createElement(Child, {}),
      },
    );
    const canvas = createCanvas();
    const controller = mountCRC(canvas, build(1, true));
    activeControllers.add(controller);

    executeRender(canvas, 1);
    expect(trace).toEqual([
      'mount:body:1',
      'update:body:1',
      'enter:body',
      'prepare:body:31x20',
      'render:primitive:31x20',
      'render:child',
      'exit:body:true',
    ]);

    trace.length = 0;
    executeRender(canvas, 2, build(2, true));
    expect(trace).toEqual([
      'update:body:2',
      'enter:body',
      'prepare:body:32x20',
      'render:primitive:32x20',
      'render:child',
      'exit:body:true',
    ]);

    trace.length = 0;
    executeRender(canvas, 3, build(3, false));
    expect(trace).toEqual([
      'dispose:body',
      'render:primitive:33x20',
      'render:child',
    ]);

    trace.length = 0;
    executeRender(canvas, 4, build(4, true));
    trace.length = 0;
    controller.dispose();
    controller.dispose();
    expect(trace).toEqual(['dispose:body']);
  });

  it('treats physics as ordinary application data until a custom component forwards it to a primitive', () => {
    const trace: string[] = [];
    const Primitive = definePrimitive<AttachmentPrimitiveProps>(() => {
      trace.push('render:primitive');
    });
    const Wrapper = ({
      forward,
      physics,
    }: {
      readonly forward: boolean;
      readonly physics: TestAttachmentValue;
    }) => {
      trace.push(`render:wrapper:${physics.generation}`);
      return createElement(Primitive, forward ? { physics } : {});
    };
    const attachment = createAttachment('forwarded', 1, trace);
    const canvas = createCanvas();
    const controller = mountCRC(canvas, createElement(Wrapper, {
      forward: false,
      physics: attachment,
    }));
    activeControllers.add(controller);

    executeRender(canvas, 1);
    expect(trace).toEqual([
      'render:wrapper:1',
      'render:primitive',
    ]);

    trace.length = 0;
    executeRender(canvas, 2, createElement(Wrapper, {
      forward: true,
      physics: attachment,
    }));
    expect(trace).toEqual([
      'render:wrapper:1',
      'mount:forwarded:1',
      'update:forwarded:1',
      'enter:forwarded',
      'prepare:forwarded:undefinedxundefined',
      'render:primitive',
      'exit:forwarded:true',
    ]);
  });

  it('unwinds a failed attachment preparation in LIFO order and releases the failed host', () => {
    const trace: string[] = [];
    let resourceAcquisitions = 0;
    const Primitive = definePrimitive<AttachmentPrimitiveProps>(() => {
      trace.push('render:primitive');
    });
    const enhanced = appendElementEnhancer(
      createElement(Primitive, {
        physics: createAttachment('physics', 1, trace, {
          prepareError: 'self collider requires a supported primitive resolver',
          onPrepareAccepted: () => resourceAcquisitions++,
        }),
      }),
      createDescriptor('policy', Symbol('policy'), 1, trace),
    );
    const canvas = createCanvas();
    const controller = mountCRC(canvas, enhanced);
    activeControllers.add(controller);

    expect(() => executeRender(canvas, 1)).toThrowError(
      'self collider requires a supported primitive resolver',
    );
    expect(trace).toEqual([
      'mount:policy',
      'update:policy:1',
      'mount:physics:1',
      'update:physics:1',
      'enter:policy',
      'enter:physics',
      'prepare:physics:undefinedxundefined',
      'exit:physics:false',
      'exit:policy:false',
      'dispose:physics',
      'dispose:policy',
    ]);
    expect(resourceAcquisitions).toBe(0);
    expect(getCRCInstance(canvas).refs.size).toBe(0);
  });

  it('remounts on keyed replacement and preserves attachment identity through policy and layout clones', () => {
    const trace: string[] = [];
    const prepared: CRCInternalPrimitiveAttachmentInput[] = [];
    const attachment = createAttachment('placed', 1, trace, { prepared });
    const Primitive = definePrimitive<
      AttachmentPrimitiveProps,
      AttachmentPrimitiveStyle,
      AttachmentPrimitiveStyle,
      ResolvedAttachmentPrimitiveStyle
    >(() => {
      trace.push('render:primitive');
    }, {
      resolveStyle: style => ({
        width: style.width,
        height: style.height,
      }),
    });
    const build = (key: string) => createElement(Absolute, {
      style: { width: 100, height: 60 },
      children: focusManaged(createElement(Primitive, {
        key,
        physics: attachment,
        style: { left: 17, top: 13, width: 30, height: 20 },
      })),
    });
    const canvas = createCanvas();
    const controller = mountCRC(canvas, build('first'));
    activeControllers.add(controller);

    executeRender(canvas, 1);
    expect(prepared).toHaveLength(1);
    expect(matrixValues(prepared[0].parentWorldTransform)).toEqual([
      1, 0, 0, 1, 17, 13,
    ]);

    trace.length = 0;
    executeRender(canvas, 2, build('second'));
    expect(trace).toEqual([
      'mount:placed:1',
      'update:placed:1',
      'enter:placed',
      'prepare:placed:30x20',
      'render:primitive',
      'exit:placed:true',
      'dispose:placed',
    ]);
  });

  it('keeps a stable registered value equal in retained Layer snapshots', () => {
    const trace: string[] = [];
    const attachment = createAttachment('layer', 1, trace);
    const Primitive = definePrimitive<AttachmentPrimitiveProps>(() => {
      trace.push('render:primitive');
    });
    const build = () => createElement(Layer, {
      style: { width: 40, height: 30 },
      children: createElement(Primitive, { physics: attachment }),
    });
    const canvas = createCanvas();
    const controller = mountCRC(canvas, build());
    activeControllers.add(controller);

    executeRender(canvas, 1);
    expect(trace).toContain('render:primitive');

    trace.length = 0;
    executeRender(canvas, 2, build());
    expect(trace).toEqual([]);
  });

  it('lets friend packages reject incompatible metadata before acquiring resources', () => {
    const trace: string[] = [];
    let resourceAcquisitions = 0;
    let primitiveRenders = 0;
    const publicValue = Object.freeze({ generation: 1, name: '3d-body' });
    const wrongDimension = crcInternalCreatePropAttachment(
      'physics',
      publicValue,
      () => {
        trace.push('validate:dimension');
        if (publicValue.name.startsWith('3d')) {
          throw new Error(
            'Rectangle physics attachment has dimension 3d; expected 2d',
          );
        }
        resourceAcquisitions++;
        return createMountedAttachment('wrong-dimension', trace);
      },
    );
    const Primitive = definePrimitive<AttachmentPrimitiveProps>(() => {
      primitiveRenders++;
    });
    const canvas = createCanvas();
    const controller = mountCRC(canvas, createElement(Primitive, {
      physics: wrongDimension,
    }));
    activeControllers.add(controller);

    expect(() => executeRender(canvas, 1)).toThrowError(
      'Rectangle physics attachment has dimension 3d; expected 2d',
    );
    expect(trace).toEqual(['validate:dimension']);
    expect(resourceAcquisitions).toBe(0);
    expect(primitiveRenders).toBe(0);
  });
});

describe('built-in transparent policies', () => {
  it('preserves exact element fields while preparing focus and directional descriptors', () => {
    interface ConstructorStyle extends SystemStyle {
      width: number;
    }
    const Component = (_props: { value: number } & { style: Readonly<ConstructorStyle> }) => undefined;
    const element = createElement(Component, { key: 'stable', value: 7, style: { width: 20 } });
    const identityHint = { type: element.type, key: element.key, occurrence: 3 };
    setPlacementIdentityHint(element, identityHint);

    const policyTree = focusManaged(
      directionalPolicy(element, { mode: 'directional' }),
    );
    const [enhanced] = materializeContainerChildren(policyTree, 'policy test');

    expect(enhanced).not.toBe(element);
    expect(enhanced.type).toBe(element.type);
    expect(enhanced.props).toBe(element.props);
    expect(enhanced.props.style).toBe(element.props.style);
    expect(enhanced.key).toBe('stable');
    expect(getPlacementIdentityHint(enhanced)).toBe(identityHint);
    expect('enhancers' in enhanced).toBe(false);
    expect(Object.keys(enhanced)).toEqual([
      'type',
      'props',
      'key',
    ]);

    const cloned = cloneCRCElement(
      enhanced as CRCElement<any>,
    ) as typeof enhanced;
    expect(isCRCElement(cloned)).toBe(true);
    expect(cloned.type).toBe(element.type);
    expect(cloned.props).toBe(element.props);
    expect(cloned.key).toBe('stable');
    expect(getPlacementIdentityHint(cloned)).toBe(identityHint);
    expect(Object.isFrozen(cloned)).toBe(import.meta.env.DEV);
    expect(Object.isFrozen(cloned.props)).toBe(import.meta.env.DEV);
    expect('enhancers' in cloned).toBe(false);
    const sourceDescriptors = getElementEnhancerDescriptors(enhanced);
    const clonedDescriptors = getElementEnhancerDescriptors(cloned);
    expect(clonedDescriptors).toEqual(sourceDescriptors);
    expect(clonedDescriptors).not.toBe(sourceDescriptors);
    expect(Object.isFrozen(sourceDescriptors)).toBe(true);
    expect(Object.isFrozen(clonedDescriptors)).toBe(true);
    expect(() => materializeContainerChildren(
      focusManaged(cloned as typeof enhanced),
      'policy test',
    )).toThrowError(/FocusManagement.*same.*element/i);
  });

  it.each([
    {
      name: 'Absolute',
      build: (child: CRCNode) => createElement(Absolute, {
        style: { width: 100, height: 60 },
        children: child,
      }),
      childStyle: { width: 30, height: 20 },
      measurements: 0,
    },
    {
      name: 'Flow',
      build: (child: CRCNode) => createElement(Flow, {
        style: { width: 100, height: 60, alignItems: 'start' },
        children: child,
      }),
      childStyle: { width: 'auto', height: 'auto' },
      measurements: 1,
    },
    {
      name: 'Flex',
      build: (child: CRCNode) => createElement(Flex, {
        style: { width: 100, height: 60, alignItems: 'flex-start' },
        children: child,
      }),
      childStyle: {
        width: 'auto',
        height: 'auto',
        minWidth: 0,
        flexShrink: 0,
        alignSelf: 'flex-start',
      },
      measurements: 1,
    },
    {
      name: 'Grid',
      build: (child: CRCNode) => createElement(Grid, {
        style: {
          width: 100,
          height: 60,
          gridTemplateColumns: [100],
          gridTemplateRows: [60],
          justifyItems: 'start',
          alignItems: 'start',
        },
        children: child,
      }),
      childStyle: {
        width: 'auto',
        height: 'auto',
        gridColumnStart: 1,
        gridRowStart: 1,
        justifySelf: 'start',
        alignSelf: 'start',
      },
      measurements: 1,
    },
  ] as const)(
    '$name preserves a private enhancer through measurement, placement, and paint',
    ({ build, childStyle, measurements }) => {
      const trace: string[] = [];
      const renders: Array<{ id: string; element: CRCElement<any> }> = [];
      let measurementCount = 0;
      const Child = definePrimitive<
        {},
        EnhancerLayoutStyle,
        EnhancerLayoutStyle,
        ResolvedEnhancerLayoutStyle
      >(() => {
        const refs = getComponentRefs();
        renders.push({
          id: refs.id,
          element: refs.element as CRCElement<any>,
        });
        trace.push('paint');
      }, {
        resolveStyle: (_style, context) => ({
          width: context.allocation.width,
          height: context.allocation.height,
        }),
        measure: () => {
          measurementCount++;
          return { status: 'measured', size: { width: 30, height: 20 } };
        },
      });
      const descriptor = createDescriptor(
        'layout',
        Symbol('layout'),
        1,
        trace,
      );
      const enhanced = appendElementEnhancer(
        createElement(Child, { key: 'stable', style: childStyle }),
        descriptor,
      );
      const canvas = createCanvas();
      const controller = mountCRC(canvas, build(enhanced));
      activeControllers.add(controller);

      executeRender(canvas, 1);

      expect(measurementCount).toBe(measurements);
      expect(trace).toEqual([
        'mount:layout',
        'update:layout:1',
        'enter:layout',
        'paint',
        'exit:layout:true',
      ]);
      expect(renders).toHaveLength(1);
      expect(renders[0].element.key).toBe('stable');
      expect(isCRCElement(renders[0].element)).toBe(true);
      expect(Object.isFrozen(renders[0].element)).toBe(import.meta.env.DEV);
      expect('enhancers' in renders[0].element).toBe(false);

      const firstId = renders[0].id;
      trace.length = 0;
      executeRender(canvas, 2, build(enhanced));
      expect(renders.at(-1)!.id).toBe(firstId);
      expect(trace).toEqual([
        'update:layout:1',
        'enter:layout',
        'paint',
        'exit:layout:true',
      ]);
    },
  );

  it('preserves focus and directional policy on a measured and placed Grid child', () => {
    const rendered: Array<{ id: string; element: CRCElement<any> }> = [];
    const Target = definePrimitive<
      {},
      EnhancerLayoutStyle,
      EnhancerLayoutStyle,
      ResolvedEnhancerLayoutStyle
    >(() => {
      const refs = getComponentRefs();
      rendered.push({ id: refs.id, element: refs.element as CRCElement<any> });
      const path = new Path2D();
      path.rect(0, 0, 30, 20);
      useEventTarget({ onClick: () => undefined }, {
        path,
        keyboardNavigationBounds: { x: 0, y: 0, width: 30, height: 20 },
      });
    }, {
      resolveStyle: (_style, context) => ({
        width: context.allocation.width,
        height: context.allocation.height,
      }),
      measure: () => ({
        status: 'measured',
        size: { width: 30, height: 20 },
      }),
    });
    const build = () => createElement(Grid, {
      style: {
        width: 100,
        height: 60,
        gridTemplateColumns: [100],
        gridTemplateRows: [60],
        justifyItems: 'start',
        alignItems: 'start',
      },
      children: directionalPolicy(
        focusManaged(createElement(Target, {
          key: 'managed',
          style: {
            width: 'auto',
            height: 'auto',
            gridColumnStart: 1,
            gridRowStart: 1,
            justifySelf: 'start',
            alignSelf: 'start',
          },
        })),
        { mode: 'directional' },
      ),
    });
    const canvas = createCanvas();
    const controller = mountCRC(canvas, build());
    activeControllers.add(controller);

    executeRender(canvas, 1);

    const policy = getCRCInstance(canvas).eventRoot.focusPolicy as unknown as {
      readonly candidates: readonly [{ readonly directionalBoundary?: object }];
    };
    expect(policy).toBeDefined();
    expect(policy.candidates).toHaveLength(1);
    expect(policy.candidates[0].directionalBoundary).toBeDefined();
    expect(rendered[0].element.key).toBe('managed');
    expect(isCRCElement(rendered[0].element)).toBe(true);
    expect(Object.isFrozen(rendered[0].element)).toBe(import.meta.env.DEV);
    expect('enhancers' in rendered[0].element).toBe(false);

    executeRender(canvas, 2, build());
    expect(rendered[1].id).toBe(rendered[0].id);
    expect(policy.candidates).toHaveLength(1);
    expect(policy.candidates[0].directionalBoundary).toBeDefined();
  });

  it('rejects duplicate focus and directional policies with targeted errors', () => {
    const Component = (_props: {}) => undefined;

    const focused = focusManaged(createElement(Component, {}));
    expect(() => materializeContainerChildren(
      focusManaged(focused),
      'policy test',
    )).toThrowError(/FocusManagement.*same.*element/i);

    const directional = directionalPolicy(createElement(Component, {}), { mode: 'directional' });
    expect(() => materializeContainerChildren(
      directionalPolicy(directional, { mode: 'directional' }),
      'policy test',
    )).toThrowError(/KeyboardNavigation.*same.*element/i);
  });

  it('accepts only directional keyboard-navigation mode', () => {
    const Component = (_props: {}) => undefined;
    const options: CRCKeyboardNavigationOptions = { mode: 'directional' };

    expect(materializeContainerChildren(
      directionalPolicy(createElement(Component, {}), options),
      'policy test',
    )[0].type).toBe(createElement(Component, {}).type);

    expect(() => materializeContainerChildren(
      directionalPolicy(createElement(Component, {}), { mode: 'linear' } as never),
      'policy test',
    )).toThrowError(/mode.*directional/i);
  });

  it('rejects unbranded descriptor copies with arbitrary string metadata', () => {
    type PublicElementHasEnhancers = 'enhancers' extends keyof PublicCRCElement<any>
      ? true
      : false;
    const publicElementHasEnhancers: PublicElementHasEnhancers = false;
    const mount = vi.fn(() => ({
      update: () => undefined,
      enter: () => undefined,
      exit: () => undefined,
      dispose: () => undefined,
    }));
    const Component = (_props: {}) => undefined;
    const descriptor = { key: Symbol('unsupported'), mount };
    const element = createElement(Component, {});
    const unsupported: PublicCRCElement = {
      ...element,
      // @ts-expect-error arbitrary enhancer metadata is not public CRC element input
      enhancers: [descriptor],
    };
    const canvas = createCanvas();
    const controller = mountCRC(canvas, unsupported);
    activeControllers.add(controller);

    expect(publicElementHasEnhancers).toBe(false);
    expect(() => executeRender(canvas, 1))
      .toThrowError(
        /CRC root.*element-like object.*not created by @crc\/core[\s\S]*jsxImportSource/i,
      );
    expect(mount).not.toHaveBeenCalled();
  });
});

function annotate(
  element: CRCElement<any>,
  enhancers: readonly TestEnhancerDescriptor[],
): CRCElement<any> {
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

function createAttachment(
  name: string,
  generation: number,
  trace: string[],
  options: Readonly<{
    onPrepareAccepted?: () => void;
    prepareError?: string;
    prepared?: CRCInternalPrimitiveAttachmentInput[];
    presentationTransform2D?: DOMMatrix;
  }> = {},
): TestAttachmentValue {
  const publicValue = Object.freeze({ name, generation });
  return crcInternalCreatePropAttachment('physics', publicValue, () => {
    trace.push(`mount:${name}:${generation}`);
    return createMountedAttachment(name, trace, {
      onPrepareAccepted: options.onPrepareAccepted,
      prepareError: options.prepareError,
      prepared: options.prepared,
      presentationTransform2D: options.presentationTransform2D,
    });
  });
}

function createMountedAttachment(
  name: string,
  trace: string[],
  options: Readonly<{
    onPrepareAccepted?: () => void;
    prepareError?: string;
    prepared?: CRCInternalPrimitiveAttachmentInput[];
    presentationTransform2D?: DOMMatrix;
  }> = {},
): CRCInternalMountedPropAttachment {
  return {
    update(value) {
      trace.push(
        `update:${name}:${(value as TestAttachmentValue).generation}`,
      );
    },
    enter() {
      trace.push(`enter:${name}`);
    },
    preparePrimitive(input) {
      options.prepared?.push(input);
      trace.push(
        `prepare:${name}:${String(input.style.width)}x${String(input.style.height)}`,
      );
      if (options.prepareError) throw new Error(options.prepareError);
      options.onPrepareAccepted?.();
      if (options.presentationTransform2D) {
        return { presentationTransform2D: options.presentationTransform2D };
      }
    },
    exit(success) {
      trace.push(`exit:${name}:${success}`);
    },
    dispose() {
      trace.push(`dispose:${name}`);
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

function dispatchClick(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) {
    canvas.dispatchEvent(new MouseEvent(type, {
      bubbles: true,
      button: 0,
      buttons: type === 'mousedown' ? 1 : 0,
      cancelable: true,
      clientX: bounds.left + x,
      clientY: bounds.top + y,
    }));
  }
}

function teardownCount(teardowns: unknown): number {
  return (Reflect.get(teardowns as object, '_teardowns') as Set<unknown>).size;
}

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): readonly number[] {
  return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
}

function matrixValues(matrix: DOMMatrixReadOnly): readonly number[] {
  return [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f];
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

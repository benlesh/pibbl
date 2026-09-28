import { Fragment, FocusManagement, KeyboardNavigation, LayoutDiagnostic, Rectangle, Text, createElement, useEventTarget, useSignal, measureElement, type CanvasMeasurementService, type CRCElement, type CRCNode } from '@crc/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendElementEnhancer,
  getElementEnhancerDescriptors,
} from '../element-enhancers';
import { materializeContainerChildren } from '../element/children';
import { cloneCRCElement } from '../element/create-element';
import { jsxDEV } from '../element/jsx-runtime';
import { executeRender } from '../execute-render';
import {
  clearSharedState,
  getComponentRefs,
  getCRCInstance,
} from '../global-state';
import { mountCRC } from '../mount-crc';
import type { CRCController } from '../types';
import { definePrimitive } from '@crc/core';

const activeControllers = new Set<CRCController>();

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

describe('transparent focus policy preparation', () => {
  it('removes empties, recursively prepares one child, and preserves declaration order and child metadata', () => {
    const existingKey = Symbol('existing child policy');
    const existingDescriptor = {
      key: existingKey,
      mount: () => ({
        update: () => undefined,
        enter: () => undefined,
        exit: () => undefined,
        dispose: () => undefined,
      }),
    };
    const child = appendElementEnhancer(
      <Rectangle
        key="stable"
        style={{ width: 20, height: 10, fill: '#2563eb' }}
      />,
      existingDescriptor,
    );
    const tree = (
      <FocusManagement>
        {[false, (
          <KeyboardNavigation mode="directional">
            {child}
          </KeyboardNavigation>
        ), null]}
      </FocusManagement>
    );

    const [prepared] = materializeContainerChildren(tree, 'test root');

    expect(prepared).not.toBe(child);
    expect(prepared.type).toBe(child.type);
    expect(prepared.props).toBe(child.props);
    expect(prepared.key).toBe('stable');
    expect(getElementEnhancerDescriptors(prepared).map(descriptor =>
      descriptor.key.description
    )).toEqual([
      'existing child policy',
      'CRC focus management',
      'CRC keyboard navigation',
    ]);

    const cloned = cloneCRCElement(prepared);
    expect(getElementEnhancerDescriptors(cloned)).toEqual(
      getElementEnhancerDescriptors(prepared),
    );
    expect(getElementEnhancerDescriptors(cloned)).not.toBe(
      getElementEnhancerDescriptors(prepared),
    );
  });

  it('materializes a nested iterable once and retains policies on a keyed Fragment', () => {
    let iterations = 0;
    function* children(): Iterable<CRCNode> {
      iterations++;
      yield [false, (
        <Fragment key="stable-scope">
          <Rectangle style={{ width: 20, height: 10 }} />
        </Fragment>
      )];
    }
    const tree = (
      <FocusManagement>
        <KeyboardNavigation mode="directional">
          {children()}
        </KeyboardNavigation>
      </FocusManagement>
    );

    const [prepared] = materializeContainerChildren(tree, 'test root');

    expect(iterations).toBe(1);
    expect(prepared.type).toBe(Fragment);
    expect(prepared.key).toBe('stable-scope');
    expect(getElementEnhancerDescriptors(prepared).map(descriptor =>
      descriptor.key.description
    )).toEqual([
      'CRC focus management',
      'CRC keyboard navigation',
    ]);
  });

  it('owns keyed Fragment policies while preserving the existing Fragment and child identities', () => {
    const counts = {
      dispose: 0,
      enter: 0,
      exitFailure: 0,
      exitSuccess: 0,
      mount: 0,
      update: 0,
    };
    const descriptor = {
      key: Symbol('keyed Fragment lifecycle'),
      mount: () => {
        counts.mount++;
        return {
          update: () => counts.update++,
          enter: () => counts.enter++,
          exit: (success: boolean) => success ?
            counts.exitSuccess++ :
            counts.exitFailure++,
          dispose: () => counts.dispose++,
        };
      },
    };
    const observations: Array<{
      readonly id: string;
      readonly parentId: string | undefined;
      readonly state: number;
    }> = [];
    let setState: ((value: number) => void) | undefined;
    function Target(): CRCNode {
      const refs = getComponentRefs();
      const state = useSignal(0);
      setState = value => state.set(value);
      observations.push({
        id: refs.id,
        parentId: refs.parent?.id,
        state: state.get(),
      });
      const path = new Path2D();
      path.rect(0, 0, 20, 10);
      useEventTarget({ onClick: () => undefined }, {
        path,
        fill: true,
        keyboardNavigationBounds: { x: 0, y: 0, width: 20, height: 10 },
      });
      return <Rectangle style={{ width: 20, height: 10 }} />;
    }
    const build = (mode: 'policies' | 'enhancer' | 'plain'): CRCNode => {
      let fragment = (
        <Fragment key="stable-scope">
          <Target />
        </Fragment>
      );
      if (mode !== 'plain') {
        fragment = appendElementEnhancer(fragment, descriptor);
      }
      return mode === 'policies' ? (
        <FocusManagement>
          <KeyboardNavigation mode="directional">
            {fragment}
          </KeyboardNavigation>
        </FocusManagement>
      ) : fragment;
    };
    const canvas = createCanvas();
    const controller = mountCRC(canvas, build('policies'));
    activeControllers.add(controller);

    executeRender(canvas, 1);

    const instance = getCRCInstance(canvas);
    const manager = instance.eventRoot.focusPolicy as unknown as {
      readonly candidates: readonly [{ readonly directionalBoundary?: object }];
    };
    expect(manager.candidates).toHaveLength(1);
    expect(manager.candidates[0].directionalBoundary).toBeDefined();
    expect(counts).toEqual({
      dispose: 0,
      enter: 1,
      exitFailure: 0,
      exitSuccess: 1,
      mount: 1,
      update: 1,
    });
    expect(observations[0]).toMatchObject({ state: 0 });
    expect(observations[0].parentId).toMatch(/Fragment/);
    const fragmentRefs = [...instance.refs.values()].find(refs =>
      refs.element.type === Fragment
    );
    expect(fragmentRefs?.hooks).toEqual([]);
    expect([...instance.refs.keys()].some(id =>
      /FocusManagement|KeyboardNavigation/.test(id)
    )).toBe(false);

    setState?.(1);
    executeRender(canvas, 2, build('policies'));
    expect(observations[1]).toEqual({
      ...observations[0],
      state: 1,
    });
    expect(counts).toMatchObject({
      dispose: 0,
      enter: 2,
      exitFailure: 0,
      exitSuccess: 2,
      mount: 1,
      update: 2,
    });

    executeRender(canvas, 3, build('enhancer'));
    expect(instance.eventRoot.focusPolicy).toBeUndefined();
    expect(observations[2]).toEqual(observations[1]);
    expect(counts).toMatchObject({
      dispose: 0,
      enter: 3,
      exitFailure: 0,
      exitSuccess: 3,
      mount: 1,
      update: 3,
    });

    executeRender(canvas, 4, build('plain'));
    expect(observations[3]).toEqual(observations[2]);
    expect(counts.dispose).toBe(1);
    controller.dispose();
    activeControllers.delete(controller);
    expect(counts.dispose).toBe(1);
  });

  it('fails and cleans up keyed Fragment enhancers with an unsuccessful exit', () => {
    const trace: string[] = [];
    const descriptor = {
      key: Symbol('keyed Fragment failure'),
      mount: () => {
        trace.push('mount');
        return {
          update: () => trace.push('update'),
          enter: () => trace.push('enter'),
          exit: (success: boolean) => trace.push(`exit:${success}`),
          dispose: () => trace.push('dispose'),
        };
      },
    };
    function Broken(): CRCNode {
      throw new Error('keyed Fragment child failed');
    }
    const fragment = appendElementEnhancer(
      <Fragment key="broken-scope"><Broken /></Fragment>,
      descriptor,
    );
    const scene = <FocusManagement>{fragment}</FocusManagement>;
    const canvas = createCanvas();
    const controller = mountCRC(canvas, scene);
    activeControllers.add(controller);

    expect(() => executeRender(canvas, 1)).toThrowError(
      'keyed Fragment child failed',
    );
    expect(trace).toEqual([
      'mount',
      'update',
      'enter',
      'exit:false',
      'dispose',
    ]);
    expect(getCRCInstance(canvas).eventRoot.focusPolicy).toBeUndefined();
  });

  it.each([
    ['zero elements', []],
    ['only empty values', [false, null, undefined, '', 0]],
    [
      'multiple elements',
      [
        <Rectangle key="a" style={{ width: 1, height: 1 }} />,
        <Rectangle key="b" style={{ width: 1, height: 1 }} />,
      ],
    ],
  ] as const)('rejects %s with the policy receiver', (_label, children) => {
    const policy = createElement(FocusManagement, { children });

    expect(() => materializeContainerChildren(policy, 'test root'))
      .toThrowError(/FocusManagement.*exactly one CRC element child/i);
  });

  it('rejects raw text and foreign JSX with contextual source metadata', () => {
    const source = {
      fileName: 'focus-scene.crc.tsx',
      lineNumber: 17,
      columnNumber: 9,
    };
    const textPolicy = jsxDEV(
      FocusManagement,
      { children: 'focus me' as unknown as CRCNode },
      undefined,
      false,
      source,
      undefined,
    );
    expect(() => materializeContainerChildren(textPolicy, 'test root'))
      .toThrowError(
        /FocusManagement at focus-scene\.crc\.tsx:17:9 received a non-empty string/i,
      );

    const reactElement = {
      $$typeof: Symbol.for('react.transitional.element'),
      type: Rectangle,
      props: {},
    } as unknown as CRCNode;
    const foreignPolicy = jsxDEV(
      KeyboardNavigation,
      { mode: 'directional', children: reactElement },
      undefined,
      false,
      source,
      undefined,
    );
    expect(() => materializeContainerChildren(foreignPolicy, 'test root'))
      .toThrowError(
        /React JSX runtime[\s\S]*Received by KeyboardNavigation at focus-scene\.crc\.tsx:17:9/i,
      );
  });

  it('reports direct policy invocation as a likely foreign JSX runtime', () => {
    const child = <Rectangle style={{ width: 1, height: 1 }} />;

    expect(() => FocusManagement({ children: child })).toThrowError(
      'FocusManagement is a CRC component and was invoked outside the CRC renderer.\n' +
      'Use <FocusManagement ... /> in a CRC JSX file or ' +
      'createElement(FocusManagement, props).',
    );
    expect(() => KeyboardNavigation({
      mode: 'directional',
      children: child,
    })).toThrowError(
      'KeyboardNavigation is a CRC component and was invoked outside the CRC renderer.\n' +
      'Use <KeyboardNavigation ... /> in a CRC JSX file or ' +
      'createElement(KeyboardNavigation, props).',
    );
  });

  it('preserves keyboard-without-manager and duplicate-policy validation', () => {
    const child = <Rectangle style={{ width: 1, height: 1 }} />;
    const keyboardOnly = (
      <KeyboardNavigation mode="directional">
        {child}
      </KeyboardNavigation>
    );
    const keyboardCanvas = createCanvas();
    const keyboardController = mountCRC(keyboardCanvas, keyboardOnly);
    activeControllers.add(keyboardController);
    expect(() => executeRender(keyboardCanvas, 1))
      .toThrowError(/KeyboardNavigation requires.*FocusManagement.*focus manager/i);

    const duplicate = (
      <FocusManagement>
        <FocusManagement>{child}</FocusManagement>
      </FocusManagement>
    );
    expect(() => materializeContainerChildren(duplicate, 'test root'))
      .toThrowError(/FocusManagement.*more than once.*same CRC element/i);
  });

  it('does not let a keyed Fragment bypass manager validation', () => {
    const child = <Rectangle style={{ width: 1, height: 1 }} />;
    const keyboardOnly = (
      <KeyboardNavigation mode="directional">
        <Fragment key="keyboard-scope">{child}</Fragment>
      </KeyboardNavigation>
    );
    const keyboardCanvas = createCanvas();
    const keyboardController = mountCRC(keyboardCanvas, keyboardOnly);
    activeControllers.add(keyboardController);
    expect(() => executeRender(keyboardCanvas, 1))
      .toThrowError(/KeyboardNavigation requires.*FocusManagement.*focus manager/i);

    const duplicate = (
      <FocusManagement>
        <Fragment key="outer-focus-scope">
          <FocusManagement>{child}</FocusManagement>
        </Fragment>
      </FocusManagement>
    );
    const duplicateCanvas = createCanvas();
    const duplicateController = mountCRC(duplicateCanvas, duplicate);
    activeControllers.add(duplicateController);
    expect(() => executeRender(duplicateCanvas, 1))
      .toThrowError(/FocusManagement.*only one focus manager.*CRC root/i);
  });
});

describe('transparent focus policy measurement', () => {
  const constraints = {
    minWidth: 0,
    maxWidth: 200,
    minHeight: 0,
    maxHeight: 100,
  };
  const service: CanvasMeasurementService = {
    measureText: value => ({
      width: value.length * 10,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: value.length * 10,
      actualBoundingBoxAscent: 9,
      actualBoundingBoxDescent: 3,
    }) as TextMetrics,
  };

  it('matches unwrapped public primitive and measurable plain-component results without rendering or acquiring focus', () => {
    const addDocumentListener = vi.spyOn(document, 'addEventListener');
    const text = <Text style={{ font: '12px sans-serif' }}>CRC</Text>;
    const textPolicy = (
      <FocusManagement>
        <KeyboardNavigation mode="directional">{text}</KeyboardNavigation>
      </FocusManagement>
    );
    expect(measureElement(textPolicy, constraints, service)).toEqual(
      measureElement(text, constraints, service),
    );

    let renders = 0;
    function Plain(): CRCNode {
      renders++;
      return undefined;
    }
    const plain = <Plain />;
    expect(measureElement(
      <FocusManagement>{plain}</FocusManagement>,
      constraints,
      service,
    )).toEqual(measureElement(plain, constraints, service));

    const measure = vi.fn(() => ({
      status: 'measured' as const,
      size: { width: 31, height: 17 },
    }));
    const Measurable = definePrimitive<{}>(() => {
      renders++;
    }, { measure });
    const measurable = createElement(Measurable, {});
    const measurablePolicy = <FocusManagement>{measurable}</FocusManagement>;
    expect(measureElement(measurablePolicy, constraints, service)).toEqual(
      measureElement(measurable, constraints, service),
    );
    expect(measure).toHaveBeenCalledTimes(2);
    expect(renders).toBe(0);
    expect(addDocumentListener).not.toHaveBeenCalled();
  });

  it('materializes nested policy iterables once per measurement and keeps contextual validation', () => {
    let iterations = 0;
    function* children(): Iterable<CRCNode> {
      iterations++;
      yield [null, <Text style={{ font: '12px sans-serif' }}>once</Text>];
    }
    const scene = (
      <FocusManagement>
        <KeyboardNavigation mode="directional">
          {children()}
        </KeyboardNavigation>
      </FocusManagement>
    );

    expect(measureElement(scene, constraints, service)).toEqual({
      status: 'measured',
      size: { width: 40, height: 12 },
    });
    expect(iterations).toBe(1);

    const invalid = jsxDEV(
      FocusManagement,
      { children: 'raw' as unknown as CRCNode },
      undefined,
      false,
      {
        fileName: 'measured-policy.crc.tsx',
        lineNumber: 8,
        columnNumber: 5,
      },
      undefined,
    );
    expect(() => measureElement(invalid, constraints, service)).toThrowError(
      /FocusManagement at measured-policy\.crc\.tsx:8:5 received a non-empty string/i,
    );
  });

  it('preserves the keyed Fragment measurement boundary', () => {
    const fragment = (
      <Fragment key="measurement-scope">
        <Text style={{ font: '12px sans-serif' }}>CRC</Text>
      </Fragment>
    );
    const policy = <FocusManagement>{fragment}</FocusManagement>;

    expect(measureElement(policy, constraints, service)).toEqual(
      measureElement(fragment, constraints, service),
    );
    expect(measureElement(policy, constraints, service)).toEqual({
      status: 'unsupported',
      reason: 'Fragment does not provide measurement',
    });
  });

  it('preserves cyclic measurement identity through policy clones', () => {
    let wrapped: CRCElement<any>;
    const Direct = definePrimitive<{}>(() => undefined, {
      measure: (input) => input.measureElement(
        wrapped,
        constraints,
      ),
    });
    wrapped = <FocusManagement>{createElement(Direct, {})}</FocusManagement>;

    expect(() => measureElement(wrapped, constraints, service))
      .toThrowError(LayoutDiagnostic);
    expect(() => measureElement(wrapped, constraints, service))
      .toThrowError(/cyclic measurement/i);
  });
});

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 80;
  document.body.appendChild(canvas);
  return canvas;
}

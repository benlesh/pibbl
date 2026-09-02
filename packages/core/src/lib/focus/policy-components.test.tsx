import {
  FocusManagement,
  KeyboardNavigation,
  Rectangle,
  createElement,
  type CRCNode,
} from '@crc/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  appendElementEnhancer,
  getElementEnhancerDescriptors,
} from '../element-enhancers';
import { materializeContainerChildren } from '../element/children';
import { cloneCRCElement } from '../element/create-element';
import { jsxDEV } from '../element/jsx-runtime';
import { executeRender } from '../execute-render';
import { clearSharedState } from '../global-state';
import { mountCRC } from '../mount-crc';
import type { CRCController } from '../types';

const activeControllers = new Set<CRCController>();

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(() => {
  for (const controller of activeControllers) controller.dispose();
  activeControllers.clear();
  clearSharedState();
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
});

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 80;
  document.body.appendChild(canvas);
  return canvas;
}

import {
  Absolute,
  Clip,
  createElement,
  Flow,
  Flex,
  Fragment,
  Grid,
  Group,
  Layer,
  Overlay,
  Rectangle,
  type CRCElement,
  type CRCEventHandlers,
} from '@crc/core';
import { describe, expect, it, vi } from 'vitest';
import { crc } from '../crc';
import { getCRCInstance } from '../global-state';
import type { RectStyle } from '../style/types';
import { componentTest } from '../test-utils/component-test';

interface StructuralCase {
  readonly name: string;
  readonly create: (
    handlers: CRCEventHandlers,
    child: CRCElement<any>,
  ) => CRCElement<any>;
  readonly childStyle: Readonly<RectStyle>;
}

const clipPath = new Path2D();
clipPath.rect(0, 0, 80, 60);

const structuralCases: readonly StructuralCase[] = [
  {
    name: 'Group',
    create: (handlers, children) => createElement(Group, { ...handlers, children }),
    childStyle: { x: 10, y: 10, width: 20, height: 20, fill: '#2563eb' },
  },
  {
    name: 'Clip',
    create: (handlers, children) => createElement(Clip, {
      ...handlers,
      style: { d: clipPath },
      children,
    }),
    childStyle: { x: 10, y: 10, width: 20, height: 20, fill: '#2563eb' },
  },
  {
    name: 'Layer',
    create: (handlers, children) => createElement(Layer, {
      ...handlers,
      style: { width: 80, height: 60 },
      children,
    }),
    childStyle: { x: 10, y: 10, width: 20, height: 20, fill: '#2563eb' },
  },
  {
    name: 'Absolute',
    create: (handlers, children) => createElement(Absolute, {
      ...handlers,
      style: { width: 80, height: 60 },
      children,
    }),
    childStyle: { width: 20, height: 20, fill: '#2563eb' },
  },
  {
    name: 'Overlay',
    create: (handlers, children) => createElement(Overlay, {
      ...handlers,
      style: {
        width: 80,
        height: 60,
        justifyItems: 'start',
        alignItems: 'start',
      },
      children,
    }),
    childStyle: { width: 20, height: 20, fill: '#2563eb' },
  },
  {
    name: 'Flow',
    create: (handlers, children) => createElement(Flow, {
      ...handlers,
      style: { width: 80, height: 60 },
      children,
    }),
    childStyle: { width: 20, height: 20, fill: '#2563eb' },
  },
  {
    name: 'Flex',
    create: (handlers, children) => createElement(Flex, {
      ...handlers,
      style: { width: 80, height: 60 },
      children,
    }),
    childStyle: { width: 20, height: 20, minWidth: 0, fill: '#2563eb' },
  },
  {
    name: 'Grid',
    create: (handlers, children) => createElement(Grid, {
      ...handlers,
      style: {
        width: 80,
        height: 60,
        gridTemplateColumns: [80],
        gridTemplateRows: [60],
      },
      children,
    }),
    childStyle: {
      width: 20,
      height: 20,
      gridColumnStart: 1,
      gridRowStart: 1,
      fill: '#2563eb',
    },
  },
];

describe('structural event listeners', () => {
  it.each(structuralCases)(
    'propagates a $name descendant click without claiming its empty space',
    async ({ create, childStyle }) => {
      const trace: string[] = [];
      const child = createElement(Rectangle, {
        style: childStyle,
        onClick: () => trace.push('child'),
      });
      const canvas = await componentTest(createElement(Fragment, {
        children: [
          createElement(Rectangle, {
            style: { width: 80, height: 60, fill: '#ef4444' },
            onClick: () => trace.push('lower'),
          }),
          create({ onClick: () => trace.push('ancestor') }, child),
        ],
      }), { width: 100, height: 80 });

      await canvas.click({ position: { x: 15, y: 15 } });
      expect(trace).toEqual(['child', 'ancestor']);

      trace.length = 0;
      await canvas.click({ position: { x: 60, y: 50 } });
      expect(trace).toEqual(['lower']);
    },
  );

  it('keeps Group listener hook order stable while handlers are toggled', async () => {
    const trace: string[] = [];
    const scene = (handlers: CRCEventHandlers): CRCElement<any> => createElement(Group, {
      ...handlers,
      children: createElement(Rectangle, {
        style: { width: 20, height: 20, fill: '#2563eb' },
        onClick: () => trace.push('child'),
      }),
    });
    const canvas = await componentTest(scene({}), { width: 40, height: 40 });
    const instance = getCRCInstance(canvas.element);
    const release = vi.fn();
    instance.eventRoot.onNodeRelease = release;

    expect(instance.eventRoot.listenersByComponent.size).toBe(0);
    crc(canvas.element, scene({ onClick: () => trace.push('ancestor') }));
    await nextFrame();

    expect(instance.eventRoot.listenersByComponent.size).toBe(1);
    await canvas.click({ position: { x: 10, y: 10 } });
    expect(trace).toEqual(['child', 'ancestor']);

    trace.length = 0;
    crc(canvas.element, scene({}));
    await nextFrame();

    expect(instance.eventRoot.listenersByComponent.size).toBe(0);
    expect(release).toHaveBeenCalledTimes(1);
    await canvas.click({ position: { x: 10, y: 10 } });
    expect(trace).toEqual(['child']);
  });
});

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

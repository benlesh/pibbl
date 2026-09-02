import { describe, expect, it, vi } from 'vitest';
import { Rectangle } from '../components/rect';
import { crc } from '../crc';
import { crcState } from '../hooks/crc-state';
import { crcLayoutBox } from '../hooks/crc-layout-box';
import { componentTest } from '../test-utils/component-test';
import type { CRCNode, SystemStyle } from '../types';
import { Overlay, placeOverlayChild } from './overlay';
import { Absolute, placeAbsoluteChild } from './absolute';
import { Flow } from './flow';
import { createElement } from '../element/create-element';
import { definePrimitive } from '../define-primitive';

describe('absolute layout', () => {
  it('places from parent-owned left/top while primitive x/y stay local', () => {
    const child = createElement(Rectangle, {
      style: {
        left: '25%',
        top: 12,
        x: 7,
        y: 3,
        width: 40,
        height: 20,
      },
    });

    expect(placeAbsoluteChild(
      { x: 0, y: 0, width: 200, height: 100 },
      child,
    )).toEqual({ x: 50, y: 12, width: 40, height: 20 });
  });

  it('requires direct children to provide definite dimensions', () => {
    const child = createElement(Absolute, { children: [] });

    expect(() => placeAbsoluteChild(
      { x: 0, y: 0, width: 200, height: 100 },
      child,
    )).toThrowError(/Absolute.*width.*definite.*measure/i);
  });

  it('uses the current allocation when container dimensions are omitted', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(createElement(Absolute, {
      style: { padding: 10 },
      children: [createElement(Rectangle, {
        style: { width: '100%', height: 30, fill: 'red' },
        onClick,
      })],
    }), { width: 200, height: 80 });

    const context = canvas.element.getContext('2d')!;
    expect(context.getImageData(189, 20, 1, 1).data[3]).toBe(255);
    expect(context.getImageData(190, 20, 1, 1).data[3]).toBe(0);
    await canvas.click({ position: { x: 189, y: 20 } });
    await canvas.click({ position: { x: 5, y: 20 } });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it.each([
    ['absolute', (children: CRCNode[]) => createElement(Absolute, { children })],
    ['overlay', (children: CRCNode[]) => createElement(Overlay, { children })],
  ])('does not count keyed children in unkeyed %s occurrence identity', async (
    _name,
    createContainer,
  ) => {
    interface ItemStyle extends SystemStyle {
      width: number;
      height: number;
    }
    let nextIdentity = 0;
    const observations = new Map<string, number>();
    const A = ({ label }: { label: string } & { style: Readonly<ItemStyle> }) => {
      const [identity] = crcState(++nextIdentity);
      observations.set(label, identity);
    };
    const Host = ({ keyed }: { keyed: boolean }) => {
      const children: CRCNode[] = [];
      if (keyed) {
        children.push(createElement(A, {
          key: 'keyed',
          label: 'keyed',
          style: { width: 10, height: 10 },
        }));
      }
      children.push(createElement(A, {
        label: 'unkeyed',
        style: { width: 10, height: 10 },
      }));
      return createContainer(children);
    };
    const canvas = await componentTest(createElement(Host, { keyed: false }));
    const originalIdentity = observations.get('unkeyed');

    crc(canvas.element, createElement(Host, { keyed: true }));
    await nextFrame();
    expect(observations.get('unkeyed')).toBe(originalIdentity);

    crc(canvas.element, createElement(Host, { keyed: false }));
    await nextFrame();
    expect(observations.get('unkeyed')).toBe(originalIdentity);
  });

  it('normalizes direct child descriptors before reading layout fields', () => {
    interface DeclaredStyle extends SystemStyle {}
    interface NormalizedStyle extends SystemStyle {
      width: number;
      height: number;
      left: number;
      top: number;
      alignSelf: 'center';
      justifySelf: 'end';
    }
    const normalizeStyle = vi.fn((
      style: Readonly<DeclaredStyle>,
    ): Readonly<NormalizedStyle> => {
      expect(Object.isFrozen(style)).toBe(true);
      return {
        width: 40,
        height: 20,
        left: 30,
        top: 10,
        alignSelf: 'center',
        justifySelf: 'end',
      };
    });
    const Normalized = definePrimitive<
      {},
      DeclaredStyle,
      NormalizedStyle,
      NormalizedStyle
    >(() => undefined, { normalizeStyle });
    const specified = Object.freeze({});
    const child = createElement(Normalized, { style: specified });
    const container = { x: 0, y: 0, width: 200, height: 100 };

    expect(placeAbsoluteChild(container, child))
      .toEqual({ x: 30, y: 10, width: 40, height: 20 });
    expect(placeOverlayChild(container, child))
      .toEqual({ x: 160, y: 40, width: 40, height: 20 });
    expect(normalizeStyle).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['absolute', (child: CRCNode) => createElement(Absolute, {
      style: { width: 100, height: 50 },
      children: [child],
    })],
    ['overlay', (child: CRCNode) => createElement(Overlay, {
      style: {
        width: 100,
        height: 50,
        alignItems: 'start',
        justifyItems: 'start',
      },
      children: [child],
    })],
    ['flow', (child: CRCNode) => createElement(Flow, {
      style: { width: 100, height: 50 },
      children: [child],
    })],
  ] as const)(
    'normalizes a definite custom child exactly once per %s frame',
    async (_name, createContainer) => {
      interface SpecifiedStyle extends SystemStyle {
        token: 'specified';
      }
      interface NormalizedStyle extends SystemStyle {
        token: 'normalized';
        width: number;
        height: number;
      }
      const normalizeStyle = vi.fn((): NormalizedStyle => ({
        token: 'normalized',
        width: 20,
        height: 10,
      }));
      const render = vi.fn(() => {
        expect(crcLayoutBox()).toEqual({ x: 0, y: 0, width: 20, height: 10 });
      });
      const Child = definePrimitive<
        {},
        SpecifiedStyle,
        NormalizedStyle,
        NormalizedStyle
      >(render, { normalizeStyle });

      await componentTest(createContainer(createElement(Child, {
        style: Object.freeze({ token: 'specified' }),
      })));

      expect(normalizeStyle).toHaveBeenCalledOnce();
      expect(render).toHaveBeenCalledOnce();
    },
  );

  // @ts-expect-error absolute has no overlay alignment vocabulary
  void createElement(Absolute, { style: { alignItems: 'center' }, children: [] });
});

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

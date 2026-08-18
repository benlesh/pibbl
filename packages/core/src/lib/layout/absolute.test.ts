import { describe, expect, it, vi } from 'vitest';
import { rect } from '../components/rect';
import { crc } from '../crc';
import { defineComp } from '../define-comp';
import { crcState } from '../hooks/crc-state';
import { componentTest } from '../test-utils/component-test';
import type { CRCNode, SystemStyle } from '../types';
import { overlay, placeOverlayChild } from './overlay';
import { absolute, placeAbsoluteChild } from './absolute';

describe('absolute layout', () => {
  it('places from parent-owned left/top while primitive x/y stay local', () => {
    const child = rect({
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
    const child = absolute({ children: [] });

    expect(() => placeAbsoluteChild(
      { x: 0, y: 0, width: 200, height: 100 },
      child,
    )).toThrowError(/Absolute.*width.*definite.*measure/i);
  });

  it('uses the current allocation when container dimensions are omitted', async () => {
    const onClick = vi.fn();
    const canvas = await componentTest(absolute({
      style: { padding: 10 },
      children: [rect({
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
    ['absolute', (children: CRCNode[]) => absolute({ children })],
    ['overlay', (children: CRCNode[]) => overlay({ children })],
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
    const A = defineComp<{ label: string }, ItemStyle>(({ label }) => {
      const [identity] = crcState(++nextIdentity);
      observations.set(label, identity);
    });
    const Host = defineComp(({ keyed }: { keyed: boolean }) => {
      const children: CRCNode[] = [];
      if (keyed) {
        children.push(A({
          key: 'keyed',
          label: 'keyed',
          style: { width: 10, height: 10 },
        }));
      }
      children.push(A({
        label: 'unkeyed',
        style: { width: 10, height: 10 },
      }));
      return createContainer(children);
    });
    const canvas = await componentTest(Host({ keyed: false }));
    const originalIdentity = observations.get('unkeyed');

    crc(canvas.element, Host({ keyed: true }));
    await nextFrame();
    expect(observations.get('unkeyed')).toBe(originalIdentity);

    crc(canvas.element, Host({ keyed: false }));
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
    const Normalized = defineComp<
      {},
      DeclaredStyle,
      NormalizedStyle,
      NormalizedStyle
    >(() => undefined, { normalizeStyle });
    const specified = Object.freeze({});
    const child = Normalized({ style: specified });
    const container = { x: 0, y: 0, width: 200, height: 100 };

    expect(placeAbsoluteChild(container, child))
      .toEqual({ x: 30, y: 10, width: 40, height: 20 });
    expect(placeOverlayChild(container, child))
      .toEqual({ x: 160, y: 40, width: 40, height: 20 });
    expect(normalizeStyle).toHaveBeenCalledTimes(2);
  });

  // @ts-expect-error absolute has no overlay alignment vocabulary
  void absolute({ style: { alignItems: 'center' }, children: [] });
});

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

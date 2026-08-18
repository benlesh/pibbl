import { describe, expect, it, vi } from 'vitest';
import { rect } from '../components/rect';
import { crc } from '../crc';
import { componentTest } from '../test-utils/component-test';
import { overlay, placeOverlayChild } from './overlay';

describe('overlay layout', () => {
  it('centers a definite child in the shared content box', () => {
    const child = rect({
      style: {
        width: 40,
        height: 20,
        alignSelf: 'center',
        justifySelf: 'center',
      },
    });

    expect(placeOverlayChild(
      { x: 0, y: 0, width: 200, height: 100 },
      child,
    )).toEqual({ x: 80, y: 40, width: 40, height: 20 });
  });

  it('keeps mathematical centering for oversized children', () => {
    const child = rect({
      style: {
        width: 300,
        height: 120,
        alignSelf: 'center',
        justifySelf: 'center',
      },
    });

    expect(placeOverlayChild(
      { x: 0, y: 0, width: 200, height: 100 },
      child,
    )).toEqual({ x: -50, y: -10, width: 300, height: 120 });
  });

  it('clamps stretched axes at zero', () => {
    const child = rect({ style: { width: 40, height: 20 } });

    expect(placeOverlayChild(
      { x: 0, y: 0, width: 0, height: 0 },
      child,
    )).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('clips both paint and interaction to the content box', async () => {
    const clippedClick = vi.fn();
    const clipped = await componentTest(overlay({
      style: {
        width: 100,
        height: 50,
        overflow: 'clip',
        alignItems: 'center',
        justifyItems: 'center',
      },
      children: [rect({
        style: { width: 200, height: 20, fill: 'red' },
        onClick: clippedClick,
      })],
    }), { width: 160, height: 80 });
    const clippedContext = clipped.element.getContext('2d')!;
    expect(clippedContext.getImageData(90, 25, 1, 1).data[3]).toBe(255);
    expect(clippedContext.getImageData(120, 25, 1, 1).data[3]).toBe(0);
    await clipped.click({ position: { x: 90, y: 25 } });
    await clipped.click({ position: { x: 120, y: 25 } });
    expect(clippedClick).toHaveBeenCalledOnce();

    const visibleClick = vi.fn();
    const visible = await componentTest(overlay({
      style: {
        width: 100,
        height: 50,
        overflow: 'visible',
        alignItems: 'center',
        justifyItems: 'center',
      },
      children: [rect({
        style: { width: 200, height: 20, fill: 'red' },
        onClick: visibleClick,
      })],
    }), { width: 160, height: 80 });
    expect(visible.element.getContext('2d')!
      .getImageData(120, 25, 1, 1).data[3]).toBe(255);
    await visible.click({ position: { x: 120, y: 25 } });
    expect(visibleClick).toHaveBeenCalledOnce();
  });

  it.each(['1e2%', '40%trailing'])(
    'rejects malformed container percentage %s through the shared grammar',
    value => {
      const originalRequestAnimationFrame = window.requestAnimationFrame;
      let pending: FrameRequestCallback | undefined;
      window.requestAnimationFrame = callback => {
        pending = callback;
        return 1;
      };
      const canvas = document.createElement('canvas');
      const UnsafeOverlay = overlay as any;

      try {
        const controller = crc(canvas, UnsafeOverlay({
          style: { width: value, height: 20 },
          children: [],
        }));
        expect(() => pending?.(0)).toThrowError(/width.*unsupported/i);
        controller.dispose();
      } finally {
        window.requestAnimationFrame = originalRequestAnimationFrame;
      }
    },
  );

  // @ts-expect-error overlay container alignment uses CRC-native values
  void overlay({ style: { alignItems: 'flex-start' }, children: [] });
});

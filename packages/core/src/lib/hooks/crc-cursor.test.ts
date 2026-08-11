import { describe, expect, it, vi } from 'vitest';
import { rect } from '../components/rect';
import { defineComp } from '../define-comp';
import { componentTest } from '../test-utils/component-test';
import { crcCursor } from './crc-cursor';

describe('crcCursor', () => {
  it('keeps a pathless cursor out of logical target selection', async () => {
    const onMouseMove = vi.fn();
    const Scene = defineComp(() => {
      crcCursor({ style: 'wait' });
      return rect({
        x: 40,
        y: 40,
        width: 80,
        height: 80,
        fillStyle: 'red',
        onMouseMove,
      });
    });
    const canvas = await componentTest(Scene({}));

    await canvas.mouseMove({ position: { x: 80, y: 80 } });

    expect(onMouseMove).toHaveBeenCalledOnce();
    expect(getComputedStyle(canvas.element).cursor).toBe('wait');
  });

  it('uses a pathless cursor as a fallback behind a region cursor', async () => {
    const Scene = defineComp(() => {
      crcCursor({ style: 'wait' });
      return rect({
        x: 40,
        y: 40,
        width: 80,
        height: 80,
        fillStyle: 'red',
        cursor: 'pointer',
      });
    });
    const canvas = await componentTest(Scene({}));

    await canvas.mouseMove({ position: { x: 10, y: 10 } });
    expect(getComputedStyle(canvas.element).cursor).toBe('wait');

    await canvas.mouseMove({ position: { x: 80, y: 80 } });
    expect(getComputedStyle(canvas.element).cursor).toBe('pointer');

    await canvas.mouseMove({ position: { x: 10, y: 10 } });
    expect(getComputedStyle(canvas.element).cursor).toBe('wait');
  });
});

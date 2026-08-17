import { describe, expect, it, vi } from 'vitest';
import { rect } from '../components/rect';
import { crc } from '../crc';
import { defineComp } from '../define-comp';
import { componentTest } from '../test-utils/component-test';
import { crcCursor } from './crc-cursor';

describe('crcCursor', () => {
  it('keeps a pathless cursor out of logical target selection', async () => {
    const onMouseMove = vi.fn();
    const Scene = defineComp(() => {
      crcCursor({ style: 'wait' });
      return rect({
        style: {
          x: 40,
          y: 40,
          width: 80,
          height: 80,
          fill: 'red',
        },
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
        style: {
          x: 40,
          y: 40,
          width: 80,
          height: 80,
          fill: 'red',
          cursor: 'pointer',
        },
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

  it('restores the preceding fallback immediately when the winner is removed', async () => {
    const Scene = defineComp<{ second: boolean }>(({ second }) => {
      crcCursor({ style: 'wait' });
      crcCursor({ style: second ? 'help' : undefined });
    });
    const canvas = await componentTest(Scene({ second: true }));
    await canvas.mouseMove({ position: { x: 80, y: 80 } });
    expect(getComputedStyle(canvas.element).cursor).toBe('help');

    crc(canvas.element, Scene({ second: false }));
    await nextFrame();

    expect(getComputedStyle(canvas.element).cursor).toBe('wait');
  });

  it('applies a newly enabled later fallback immediately', async () => {
    const Scene = defineComp<{ second: boolean }>(({ second }) => {
      crcCursor({ style: 'wait' });
      crcCursor({ style: second ? 'help' : undefined });
    });
    const canvas = await componentTest(Scene({ second: false }));
    await canvas.mouseMove({ position: { x: 80, y: 80 } });
    expect(getComputedStyle(canvas.element).cursor).toBe('wait');

    crc(canvas.element, Scene({ second: true }));
    await nextFrame();

    expect(getComputedStyle(canvas.element).cursor).toBe('help');
  });

  it('reconciles a fallback swap even when registration is briefly empty', async () => {
    const Scene = defineComp<{ swapped: boolean }>(({ swapped }) => {
      crcCursor({ style: swapped ? undefined : 'wait' });
      crcCursor({ style: swapped ? 'help' : undefined });
    });
    const canvas = await componentTest(Scene({ swapped: false }));
    await canvas.mouseMove({ position: { x: 80, y: 80 } });
    expect(getComputedStyle(canvas.element).cursor).toBe('wait');

    crc(canvas.element, Scene({ swapped: true }));
    await nextFrame();

    expect(getComputedStyle(canvas.element).cursor).toBe('help');
  });

  it('keeps the fallback applied when its cursorless hovered region is removed', async () => {
    const Scene = defineComp<{ region: boolean }>(({ region }) => {
      crcCursor({ style: 'wait' });
      return region ?
          rect({
            style: {
              x: 40,
              y: 40,
              width: 80,
              height: 80,
              fill: 'red',
            },
            onMouseMove: () => undefined,
          }) :
        undefined;
    });
    const canvas = await componentTest(Scene({ region: true }));
    await canvas.mouseMove({ position: { x: 80, y: 80 } });
    expect(getComputedStyle(canvas.element).cursor).toBe('wait');

    crc(canvas.element, Scene({ region: false }));
    await nextFrame();

    expect(getComputedStyle(canvas.element).cursor).toBe('wait');
  });

  it('applies a newly enabled region cursor without another movement', async () => {
    const Scene = defineComp<{ enabled: boolean }>(({ enabled }) => rect({
      style: {
        x: 40,
        y: 40,
        width: 80,
        height: 80,
        fill: 'red',
        cursor: enabled ? 'pointer' : undefined,
      },
      onMouseMove: () => undefined,
    }));
    const canvas = await componentTest(Scene({ enabled: false }));
    await canvas.mouseMove({ position: { x: 80, y: 80 } });
    expect(canvas.element.style.cursor).toBe('');

    crc(canvas.element, Scene({ enabled: true }));
    await nextFrame();

    expect(getComputedStyle(canvas.element).cursor).toBe('pointer');
  });

  it('does not clear an externally replaced cursor during fallback removal', async () => {
    const Scene = defineComp<{ enabled: boolean }>(({ enabled }) => {
      crcCursor({ style: enabled ? 'wait' : undefined });
    });
    const canvas = await componentTest(Scene({ enabled: true }));
    await canvas.mouseMove({ position: { x: 80, y: 80 } });
    canvas.element.style.cursor = 'progress';

    crc(canvas.element, Scene({ enabled: false }));
    await nextFrame();

    expect(canvas.element.style.cursor).toBe('progress');
  });
});

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

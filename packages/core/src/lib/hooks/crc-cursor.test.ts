import { describe, expect, it, vi } from 'vitest';
import { Rectangle } from '../components/rect';
import { crc } from '../crc';
import { componentTest } from '../test-utils/component-test';
import { crcCursor } from './crc-cursor';
import { createElement } from '../element/create-element';

describe('crcCursor', () => {
  it('keeps a pathless cursor out of logical target selection', async () => {
    const onMouseMove = vi.fn();
    const Scene = (_props: {}) => {
      crcCursor({ style: 'wait' });
      return createElement(Rectangle, {
        style: {
          x: 40,
          y: 40,
          width: 80,
          height: 80,
          fill: 'red',
        },
        onMouseMove,
      });
    };
    const canvas = await componentTest(createElement(Scene, {}));

    await canvas.mouseMove({ position: { x: 80, y: 80 } });

    expect(onMouseMove).toHaveBeenCalledOnce();
    expect(getComputedStyle(canvas.element).cursor).toBe('wait');
  });

  it('uses a pathless cursor as a fallback behind a region cursor', async () => {
    const Scene = (_props: {}) => {
      crcCursor({ style: 'wait' });
      return createElement(Rectangle, {
        style: {
          x: 40,
          y: 40,
          width: 80,
          height: 80,
          fill: 'red',
          cursor: 'pointer',
        },
      });
    };
    const canvas = await componentTest(createElement(Scene, {}));

    await canvas.mouseMove({ position: { x: 10, y: 10 } });
    expect(getComputedStyle(canvas.element).cursor).toBe('wait');

    await canvas.mouseMove({ position: { x: 80, y: 80 } });
    expect(getComputedStyle(canvas.element).cursor).toBe('pointer');

    await canvas.mouseMove({ position: { x: 10, y: 10 } });
    expect(getComputedStyle(canvas.element).cursor).toBe('wait');
  });

  it('restores the preceding fallback immediately when the winner is removed', async () => {
    const Scene = ({ second }: { second: boolean }) => {
      crcCursor({ style: 'wait' });
      crcCursor({ style: second ? 'help' : undefined });
    };
    const canvas = await componentTest(createElement(Scene, { second: true }));
    await canvas.mouseMove({ position: { x: 80, y: 80 } });
    expect(getComputedStyle(canvas.element).cursor).toBe('help');

    crc(canvas.element, createElement(Scene, { second: false }));
    await nextFrame();

    expect(getComputedStyle(canvas.element).cursor).toBe('wait');
  });

  it('applies a newly enabled later fallback immediately', async () => {
    const Scene = ({ second }: { second: boolean }) => {
      crcCursor({ style: 'wait' });
      crcCursor({ style: second ? 'help' : undefined });
    };
    const canvas = await componentTest(createElement(Scene, { second: false }));
    await canvas.mouseMove({ position: { x: 80, y: 80 } });
    expect(getComputedStyle(canvas.element).cursor).toBe('wait');

    crc(canvas.element, createElement(Scene, { second: true }));
    await nextFrame();

    expect(getComputedStyle(canvas.element).cursor).toBe('help');
  });

  it('reconciles a fallback swap even when registration is briefly empty', async () => {
    const Scene = ({ swapped }: { swapped: boolean }) => {
      crcCursor({ style: swapped ? undefined : 'wait' });
      crcCursor({ style: swapped ? 'help' : undefined });
    };
    const canvas = await componentTest(createElement(Scene, { swapped: false }));
    await canvas.mouseMove({ position: { x: 80, y: 80 } });
    expect(getComputedStyle(canvas.element).cursor).toBe('wait');

    crc(canvas.element, createElement(Scene, { swapped: true }));
    await nextFrame();

    expect(getComputedStyle(canvas.element).cursor).toBe('help');
  });

  it('keeps the fallback applied when its cursorless hovered region is removed', async () => {
    const Scene = ({ region }: { region: boolean }) => {
      crcCursor({ style: 'wait' });
      return region ?
          createElement(Rectangle, {
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
    };
    const canvas = await componentTest(createElement(Scene, { region: true }));
    await canvas.mouseMove({ position: { x: 80, y: 80 } });
    expect(getComputedStyle(canvas.element).cursor).toBe('wait');

    crc(canvas.element, createElement(Scene, { region: false }));
    await nextFrame();

    expect(getComputedStyle(canvas.element).cursor).toBe('wait');
  });

  it('applies a newly enabled region cursor without another movement', async () => {
    const Scene = ({ enabled }: { enabled: boolean }) => createElement(Rectangle, {
      style: {
        x: 40,
        y: 40,
        width: 80,
        height: 80,
        fill: 'red',
        cursor: enabled ? 'pointer' : undefined,
      },
      onMouseMove: () => undefined,
    });
    const canvas = await componentTest(createElement(Scene, { enabled: false }));
    await canvas.mouseMove({ position: { x: 80, y: 80 } });
    expect(canvas.element.style.cursor).toBe('');

    crc(canvas.element, createElement(Scene, { enabled: true }));
    await nextFrame();

    expect(getComputedStyle(canvas.element).cursor).toBe('pointer');
  });

  it('does not clear an externally replaced cursor during fallback removal', async () => {
    const Scene = ({ enabled }: { enabled: boolean }) => {
      crcCursor({ style: enabled ? 'wait' : undefined });
    };
    const canvas = await componentTest(createElement(Scene, { enabled: true }));
    await canvas.mouseMove({ position: { x: 80, y: 80 } });
    canvas.element.style.cursor = 'progress';

    crc(canvas.element, createElement(Scene, { enabled: false }));
    await nextFrame();

    expect(canvas.element.style.cursor).toBe('progress');
  });
});

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

import { expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import mount from '../../scenarios/src/learning/composition/html-box.example.js';

const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

it('runs the public HtmlBox lesson with native input and retained geometry in source and built modes', async () => {
  const parent = document.createElement('div');
  parent.style.cssText = 'width:720px;height:480px';
  const canvas = document.createElement('canvas');
  parent.append(canvas); document.body.append(parent);
  const controller = mount(canvas);
  try {
    await expect.poll(() => parent.querySelector('input')).not.toBeNull();
    const input = parent.querySelector('input')!;
    const button = parent.querySelector('button')!;
    const shell = parent.querySelector<HTMLElement>('[data-crc-html-box]')!;
    await userEvent.fill(input, 'Native state survives');
    await userEvent.click(button);
    expect(button.textContent).toBe('Native clicks: 1');
    const originalTransform = shell.style.transform;
    const rect = canvas.getBoundingClientRect();
    await userEvent.click(canvas, {
      position: {
        x: 92 / 720 * rect.width,
        y: (rect.height - 480 * rect.width / 720) / 2 + 116 / 720 * rect.width,
      },
    });
    await expect.poll(() => shell.style.transform).not.toBe(originalTransform);
    expect(parent.querySelector('input')).toBe(input);
    expect(input.value).toBe('Native state survives');
    const context = canvas.getContext('2d')!;
    const beforeSpark = Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data);
    input.dispatchEvent(new PointerEvent('pointerenter', { pointerId: 1, pointerType: 'mouse' }));
    await frame();
    const firstArc = Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data);
    expect(firstArc).not.toEqual(beforeSpark);
    await expect.poll(() => Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data)).not.toEqual(firstArc);
    input.dispatchEvent(new PointerEvent('pointerleave', { pointerId: 1, pointerType: 'mouse' }));
    await frame();
    expect(Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data)).toEqual(beforeSpark);
  } finally {
    controller.dispose();
    expect(parent.querySelector('[data-crc-html-box]')).toBeNull();
    expect(canvas.parentElement).toBe(parent);
    parent.remove();
  }
});

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
    await userEvent.dragAndDrop(shell, shell, {
      sourcePosition: { x: 170, y: 170 },
      targetPosition: { x: 190, y: 180 },
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
    input.focus();
    input.dispatchEvent(new PointerEvent('pointerleave', { pointerId: 1, pointerType: 'mouse' }));
    await frame();
    expect(Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data)).not.toEqual(beforeSpark);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    await frame();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let green = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 1] > 170 && pixels[i + 1] > pixels[i] * 1.3 && pixels[i + 1] > pixels[i + 2] * 1.15) green++;
    expect(green).toBeGreaterThan(30);
    input.blur();
    await new Promise(resolve => setTimeout(resolve, 2200));
    await frame();
    expect(Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data)).toEqual(beforeSpark);
  } finally {
    controller.dispose();
    expect(parent.querySelector('[data-crc-html-box]')).toBeNull();
    expect(canvas.parentElement).toBe(parent);
    parent.remove();
  }
});

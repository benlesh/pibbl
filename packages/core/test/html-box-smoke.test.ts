import { expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import mount from '../../scenarios/src/learning/composition/html-box.example.js';

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
    const shell = parent.querySelector<HTMLElement>('[data-pibbl-html-box]')!;
    await userEvent.fill(input, 'Native state survives');
    await userEvent.click(button);
    expect(button.textContent).toBe('Native clicks: 1');
    const originalTransform = shell.style.transform;
    await userEvent.click(canvas, { position: { x: 92, y: 116 } });
    await expect.poll(() => shell.style.transform).not.toBe(originalTransform);
    expect(parent.querySelector('input')).toBe(input);
    expect(input.value).toBe('Native state survives');
  } finally {
    controller.dispose();
    expect(parent.querySelector('[data-pibbl-html-box]')).toBeNull();
    expect(canvas.parentElement).toBe(parent);
    parent.remove();
  }
});

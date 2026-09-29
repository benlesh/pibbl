import { afterEach, expect, it, vi } from 'vitest';
import mount from '../../scenarios/src/learning/layout/responsive-styles.example';
import type { CRCController } from '@crc/core';
let controller: CRCController | undefined;
afterEach(() => {
  controller?.dispose();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
const settle = async () => {
  for (let n = 0; n < 3; n++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
};
it('runs the learning example controls and retains click state through phone and cell reflow', async () => {
  const host = document.createElement('div');
  host.style.width = '1000px';
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '640px';
  host.append(canvas);
  document.body.append(host);
  const ctx = canvas.getContext('2d')!;
  const painted: Array<{ label: string; x: number; y: number }> = [];
  const draw = ctx.fillText.bind(ctx);
  vi.spyOn(ctx, 'fillText').mockImplementation((label, x, y, maxWidth) => {
    const transform = ctx.getTransform();
    painted.push({ label, x: transform.e, y: transform.f });
    if (maxWidth === undefined) draw(label, x, y);
    else draw(label, x, y, maxWidth);
  });
  const click = async (x: number, y: number) => {
    const bounds = canvas.getBoundingClientRect();
    for (const type of ['mousedown', 'mouseup', 'click']) {
      canvas.dispatchEvent(new MouseEvent(type, { button: 0, buttons: type === 'mousedown' ? 1 : 0, clientX: bounds.left + x, clientY: bounds.top + y, bubbles: true }));
    }
    await settle();
  };
  controller = mount(canvas);
  await settle();
  expect(painted).toContainEqual({ label: 'Reset', x: 124, y: 128 });
  await click(56, 150);
  expect(painted).toContainEqual({ label: 'Clicked 1', x: 0, y: 128 });
  painted.length = 0;
  await click(56, 90);
  expect(canvas.getBoundingClientRect().width).toBe(360);
  expect(painted).toContainEqual({ label: 'Reset', x: 0, y: 184 });
  expect(painted).toContainEqual({ label: 'Clicked 1', x: 0, y: 128 });
  await click(176, 90);
  expect(canvas.getBoundingClientRect().width).toBe(1000);
  painted.length = 0;
  await click(56, 310);
  expect(painted).toContainEqual({ label: 'Reset', x: 124, y: 378 });
  painted.length = 0;
  await click(176, 310);
  expect(painted).toContainEqual({ label: 'Reset', x: 120, y: 378 });
});

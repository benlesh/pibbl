import { afterEach, expect, it, vi } from 'vitest';
import mount from '../../scenarios/src/learning/layout/responsive-styles.example';
import type { PibblController } from '@pibbl/core';
let controller: PibblController | undefined;
afterEach(() => {
  controller?.dispose();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
const settle = async () => {
  for (let n = 0; n < 3; n++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
};
it('reflows a revenue card across dashboard, sidebar, and phone while retaining the selected period', async () => {
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
    painted.push({ label, x: transform.e + x, y: transform.f + y });
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
  const last = (label: string) => painted.findLast(item => item.label === label)!;
  const press = async (label: string) => {
    const position = last(label);
    expect(position, label).toBeDefined();
    painted.length = 0;
    await click(position.x, position.y + 8);
  };
  expect(last('Revenue').y).toBe(last('Orders').y);
  expect(last('Orders').x).toBeGreaterThan(last('Revenue').x);
  await press('30 days');
  expect(last('$48,920')).toBeDefined();
  expect(last('$12,840')).toBeUndefined();
  await press('Sidebar');
  expect(canvas.getBoundingClientRect().width).toBe(1000);
  expect(last('Orders').y).toBeGreaterThan(last('Revenue').y);
  expect(last('Orders').x).toBe(last('Revenue').x);
  expect(last('$48,920')).toBeDefined();
  expect(last('$12,840')).toBeUndefined();
  await press('Phone');
  expect(canvas.getBoundingClientRect().width).toBe(390);
  expect(last('Orders').y).toBeGreaterThan(last('Revenue').y);
  expect(last('$48,920')).toBeDefined();
  expect(last('$12,840')).toBeUndefined();
  await press('Dashboard');
  expect(canvas.getBoundingClientRect().width).toBe(1000);
  expect(last('Revenue').y).toBe(last('Orders').y);
  expect(last('$48,920')).toBeDefined();
  expect(last('$12,840')).toBeUndefined();
  painted.length = 0;
  host.style.width = '632px';
  await settle();
  expect(last('Revenue').y).toBe(last('Orders').y);
  expect(last('Avg. order').x).toBeLessThan(632);
  painted.length = 0;
  host.style.width = '631px';
  await settle();
  expect(last('Orders').y).toBeGreaterThan(last('Revenue').y);
  painted.length = 0;
  host.style.width = '1000px';
  await settle();
  await press('7 days');
  expect(last('$12,840')).toBeDefined();
  expect(last('$48,920')).toBeUndefined();
  controller.dispose();
  expect(host.style.cssText).toBe('width: 1000px;');
  expect(canvas.style.height).toBe('640px');
  expect(canvas.style.maxHeight).toBe('');
});

it('restores the host and canvas styles if mounting fails', () => {
  const host = document.createElement('div');
  host.style.cssText = 'display: grid; overflow: hidden;';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'height: 640px; width: 100%; touch-action: none;';
  host.append(canvas);
  document.body.append(host);
  const hostStyles = host.style.cssText;
  const canvasStyles = canvas.style.cssText;
  vi.spyOn(canvas, 'getBoundingClientRect').mockImplementation(() => { throw new Error('Unavailable surface'); });
  expect(() => mount(canvas)).toThrow('Unavailable surface');
  expect(host.style.cssText).toBe(hostStyles);
  expect(canvas.style.cssText).toBe(canvasStyles);
});

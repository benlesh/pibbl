import { expect, it, vi } from 'vitest';
import { clickLogicalPoint } from './support/user-input';
import mountStudy from '../../scenarios/src/learning/composition/energy-transitions.example';

it('reveals the same subject with all three effects and leaves clean endpoints', async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 960; canvas.height = 600;
  canvas.style.width = '960px'; canvas.style.height = '600px';
  document.body.append(canvas);
  const samples: number[][] = [];
  try {
    for (const effect of ['bifrost', 'hologram', 'embers'] as const) {
      for (const progress of [0, 1]) {
        const mount = mountStudy(canvas, { effect, progress, autoplay: false });
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const pixel = [...canvas.getContext('2d')!.getImageData(480, 300, 1, 1).data];
        samples.push(pixel);
        mount.dispose();
      }
    }
    expect(samples[0]).toEqual(samples[2]);
    expect(samples[2]).toEqual(samples[4]);
    expect(samples[1]).toEqual(samples[3]);
    expect(samples[3]).toEqual(samples[5]);
    expect(samples[0]).not.toEqual(samples[1]);
  } finally { canvas.remove(); }
});


it('automatically enters quickly, then alternates exit and enter with one control', async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 960; canvas.height = 790;
  canvas.style.width = '480px'; canvas.style.height = '395px';
  document.body.append(canvas);
  let label = '';
  const original = CanvasRenderingContext2D.prototype.fillText;
  const spy = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText').mockImplementation(function (this: CanvasRenderingContext2D, text, x, y, maxWidth) {
    if (text.includes('% MATERIALIZED')) label = text;
    if (maxWidth === undefined) original.call(this, text, x, y);
    else original.call(this, text, x, y, maxWidth);
  });
  const controller = mountStudy(canvas);
  try {
    await vi.waitFor(() => expect(label).toBe('100% MATERIALIZED'), { timeout: 2200 });
    await clickLogicalPoint(canvas, { x: 790, y: 600 });
    await vi.waitFor(() => expect(label).toBe('0% MATERIALIZED'), { timeout: 2200 });
    await clickLogicalPoint(canvas, { x: 790, y: 600 });
    await vi.waitFor(() => expect(label).toBe('100% MATERIALIZED'), { timeout: 2200 });
  } finally { controller.dispose(); spy.mockRestore(); canvas.remove(); }
}, 12000);

it('overexposes the arriving Bifrost subject before settling to its normal material', async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 960; canvas.height = 790;
  canvas.style.width = '960px'; canvas.style.height = '790px';
  document.body.append(canvas);
  const values: number[] = [];
  try {
    for (const progress of [0.65, 1]) {
      const controller = mountStudy(canvas, { effect: 'bifrost', progress, autoplay: false });
      try {
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const pixel = canvas.getContext('2d')!.getImageData(470, 230, 1, 1).data;
        values.push(Math.min(pixel[0], pixel[1], pixel[2]));
      } finally { controller.dispose(); }
    }
    expect(values[0]).toBeGreaterThan(240);
    expect(values[1]).toBeLessThan(235);
  } finally { canvas.remove(); }
});

it('chars the material ahead of the ember front and restores it after arrival', async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 960; canvas.height = 790;
  canvas.style.width = '960px'; canvas.style.height = '790px';
  document.body.append(canvas);
  const brightness: number[] = [];
  try {
    for (const progress of [0.5, 1]) {
      const controller = mountStudy(canvas, { effect: 'embers', progress, autoplay: false });
      try {
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const pixel = canvas.getContext('2d')!.getImageData(480, 335, 1, 1).data;
        brightness.push(pixel[0] + pixel[1] + pixel[2]);
      } finally { controller.dispose(); }
    }
    expect(brightness[0]).toBeLessThan(brightness[1] * 0.6);
  } finally { canvas.remove(); }
});

it('centers button labels on their button midpoint with an explicit middle baseline', async () => {
  const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 790;
  document.body.append(canvas);
  const labels: { y: number; baseline: string }[] = [];
  const original = CanvasRenderingContext2D.prototype.fillText;
  const spy = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText').mockImplementation(function (this: CanvasRenderingContext2D, text, x, y) {
    if (text === 'EXIT ↗') labels.push({ y: this.getTransform().transformPoint({ x, y }).y, baseline: this.textBaseline });
    original.call(this, text, x, y);
  });
  const controller = mountStudy(canvas, { progress: 1, autoplay: false });
  try {
    await vi.waitFor(() => expect(labels.length).toBeGreaterThan(0));
    expect(labels[0]).toEqual({ y: 604, baseline: 'middle' });
  } finally { controller.dispose(); spy.mockRestore(); canvas.remove(); }
});

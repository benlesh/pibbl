import { mountLayoutFoundation } from '@crc/scenarios';
import { userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

describe('layout foundation public scenario', () => {
  it('keeps source-order targeting and pixel geometry aligned across resize', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 160;
    document.body.appendChild(canvas);
    const mounted = mountLayoutFoundation(canvas);
    dispose = () => mounted.controller.dispose();
    await nextFrame();

    expect(pixelAt(canvas, 120, 50)).toEqual([249, 115, 22, 255]);
    expect(pixelAt(canvas, 60, 10)).toEqual([22, 163, 74, 255]);
    expect(pixelAt(canvas, 90, 10)).toEqual([8, 145, 178, 255]);
    expect(pixelAt(canvas, 160, 10)).toEqual([124, 58, 237, 255]);
    await userEvent.click(canvas, { position: { x: 60, y: 10 } });
    await userEvent.click(canvas, { position: { x: 90, y: 10 } });
    await userEvent.click(canvas, { position: { x: 160, y: 10 } });
    await userEvent.click(canvas, { position: { x: 120, y: 50 } });
    await nextFrame();
    expect(mounted.getState()).toEqual({
      bottomClicks: 0,
      topClicks: 1,
      flowClicks: 1,
      flexClicks: 1,
      gridClicks: 1,
    });

    mounted.resize(400, 160);
    await nextFrame();
    expect(pixelAt(canvas, 90, 50)).toEqual([37, 99, 235, 255]);
    expect(pixelAt(canvas, 160, 50)).toEqual([249, 115, 22, 255]);
    expect(pixelAt(canvas, 90, 10)).toEqual([22, 163, 74, 255]);
    expect(pixelAt(canvas, 105, 10)).toEqual([14, 116, 144, 255]);
    await userEvent.click(canvas, { position: { x: 90, y: 10 } });
    await userEvent.click(canvas, { position: { x: 120, y: 10 } });
    await userEvent.click(canvas, { position: { x: 160, y: 50 } });
    await nextFrame();
    expect(mounted.getState()).toEqual({
      bottomClicks: 0,
      topClicks: 2,
      flowClicks: 2,
      flexClicks: 1,
      gridClicks: 2,
    });
  });
});

function pixelAt(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
): readonly number[] {
  return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

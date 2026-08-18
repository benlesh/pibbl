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
  it('keeps nested layout, clipping, identity, and observation aligned across reflow', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 420;
    document.body.appendChild(canvas);
    const mounted = mountLayoutFoundation(canvas);
    dispose = () => mounted.controller.dispose();
    await settle();

    expect(mounted.getState().observedBox).toEqual({
      x: 0, y: 0, width: 432, height: 420,
    });
    expect(pixelAt(canvas, 420, 400)).toEqual([124, 58, 237, 255]);
    expect(pixelAt(canvas, 450, 400)).toEqual([0, 0, 0, 0]);
    await userEvent.click(canvas, { position: { x: 216, y: 210 } });
    await userEvent.click(canvas, { position: { x: 20, y: 20 } });
    await userEvent.click(canvas, { position: { x: 420, y: 400 } });
    await userEvent.click(canvas, { position: { x: 450, y: 400 } });
    await settle();
    expect(mounted.getState()).toEqual({
      topClicks: 1,
      keyedClicks: 1,
      clippedClicks: 1,
      observedBox: { x: 0, y: 0, width: 432, height: 420 },
    });

    mounted.resize(480, 360);
    await settle();
    expect(mounted.getState().observedBox).toEqual({
      x: 0, y: 0, width: 288, height: 360,
    });
    expect(mounted.getState().keyedClicks).toBe(1);
    expect(pixelAt(canvas, 280, 340)).toEqual([124, 58, 237, 255]);
    expect(pixelAt(canvas, 300, 340)).toEqual([0, 0, 0, 0]);
    await userEvent.click(canvas, { position: { x: 144, y: 180 } });
    await userEvent.click(canvas, { position: { x: 300, y: 340 } });
    await settle();
    expect(mounted.getState()).toEqual({
      topClicks: 2,
      keyedClicks: 1,
      clippedClicks: 1,
      observedBox: { x: 0, y: 0, width: 288, height: 360 },
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

function settle(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() =>
    requestAnimationFrame(() => resolve()),
  ));
}

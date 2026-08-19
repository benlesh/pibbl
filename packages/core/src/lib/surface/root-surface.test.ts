import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crc } from '../crc.js';
import { defineComp } from '../define-comp.js';
import { clearSharedState } from '../global-state.js';
import { crcLayoutBox } from '../hooks/crc-layout-box.js';
import { crcRef } from '../hooks/crc-ref.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  clearSharedState();
});

describe('root Canvas surface', () => {
  it('uses the initial Canvas dimensions as a fixed viewport rendered at the configured density', async () => {
    const canvas = createCanvas(200, 100, 300, 300);
    const observations: Array<{
      box: ReturnType<typeof crcLayoutBox>;
      transform: DOMMatrix;
    }> = [];
    const Probe = defineComp((_props: {}, _style, ctx) => {
      observations.push({
        box: crcLayoutBox(),
        transform: ctx.getTransform(),
      });
    });

    const controller = crc(canvas, Probe({}), { pixelRatio: 2 });
    await settleSurface();

    expect(canvas.width).toBe(600);
    expect(canvas.height).toBe(600);
    expect(observations).toHaveLength(1);
    expect(observations[0].box).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    });
    expect(observations[0].transform).toEqual(
      expect.objectContaining({ a: 3, d: 3, e: 0, f: 150 }),
    );
    controller.dispose();
  });

  it('reflows a responsive viewport without remounting component state', async () => {
    const canvas = createCanvas(200, 100, 300, 150);
    const observations: Array<{
      box: ReturnType<typeof crcLayoutBox>;
      identity: object;
    }> = [];
    const Probe = defineComp(() => {
      observations.push({
        box: crcLayoutBox(),
        identity: crcRef({}).current!,
      });
    });

    const controller = crc(canvas, Probe({}), {
      viewport: 'responsive',
      pixelRatio: 2,
    });
    await settleSurface();
    const firstIdentity = observations.at(-1)!.identity;

    canvas.style.width = '400px';
    canvas.style.height = '200px';
    await settleSurface();

    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(400);
    expect(observations.at(-1)).toEqual({
      box: { x: 0, y: 0, width: 400, height: 200 },
      identity: firstIdentity,
    });
    controller.dispose();
  });

  it('stabilizes and restores an intrinsic CSS size when backing attributes change', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 100;
    canvas.style.display = 'block';
    document.body.appendChild(canvas);
    const Probe = defineComp(() => {});

    const controller = crc(canvas, Probe({}), { pixelRatio: 2 });
    await settleSurface();

    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(200);
    expect(canvas.getBoundingClientRect()).toEqual(
      expect.objectContaining({ width: 200, height: 100 }),
    );
    expect(canvas.style.width).toBe('200px');
    expect(canvas.style.height).toBe('100px');

    controller.dispose();
    expect(canvas.style.width).toBe('');
    expect(canvas.style.height).toBe('');
  });

  it('defers a zero-sized responsive surface and renders when it becomes visible', async () => {
    const canvas = createCanvas(200, 100, 0, 100);
    let renders = 0;
    const Probe = defineComp(() => {
      renders++;
    });
    const controller = crc(canvas, Probe({}), {
      viewport: 'responsive',
      pixelRatio: 2,
    });

    await settleSurface();
    expect(renders).toBe(0);

    canvas.style.width = '200px';
    await settleSurface();

    expect(renders).toBe(1);
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(200);
    controller.dispose();
  });

  it('uses the current device ratio by default', async () => {
    const canvas = createCanvas(200, 100, 240, 120);
    const Probe = defineComp(() => {});
    const controller = crc(canvas, Probe({}));
    await settleSurface();

    expect(canvas.width).toBe(Math.round(240 * window.devicePixelRatio));
    expect(canvas.height).toBe(Math.round(120 * window.devicePixelRatio));
    controller.dispose();
  });
});

function createCanvas(
  width: number,
  height: number,
  displayWidth: number,
  displayHeight: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.display = 'block';
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;
  document.body.appendChild(canvas);
  return canvas;
}

async function settleSurface(): Promise<void> {
  await nextFrame();
  await nextFrame();
  await nextFrame();
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

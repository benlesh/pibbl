import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crc } from '../crc';
import { defineComp } from '../define-comp';
import { clearSharedState, getCRCInstance } from '../global-state';
import { img } from './img';

class FakeImage {
  static instances: FakeImage[] = [];

  readonly width = 120;
  readonly height = 80;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';

  constructor() {
    FakeImage.instances.push(this);
  }

  removeAttribute(name: string): void {
    if (name === 'src') {
      this.src = '';
    }
  }
}

const Empty = defineComp(() => {});

beforeEach(() => {
  document.body.innerHTML = '';
  FakeImage.instances = [];
  vi.stubGlobal('Image', FakeImage);
});

afterEach(() => {
  clearSharedState();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('img async resource ownership', () => {
  it('draws only the current source when an older load callback arrives late', async () => {
    const drawImage = vi
      .spyOn(CanvasRenderingContext2D.prototype, 'drawImage')
      .mockImplementation(() => {});
    const canvas = createCanvas();
    const controller = crc(canvas, imageElement('first.png'));
    await nextFrame();
    const first = FakeImage.instances[0];
    const savedFirstLoad = first.onload;

    crc(canvas, imageElement('second.png'));
    await nextFrame();
    const second = FakeImage.instances[1];

    second.onload?.();
    await nextFrame();
    expect(drawImage).toHaveBeenLastCalledWith(second, 10, 20, 30, 40);
    const drawCount = drawImage.mock.calls.length;

    savedFirstLoad?.();
    expect(getCRCInstance(canvas).animationFrameId).toBeUndefined();
    expect(drawImage).toHaveBeenCalledTimes(drawCount);

    controller.dispose();
  });

  it('does not keep drawing a previous source while the new source errors', async () => {
    const drawImage = vi
      .spyOn(CanvasRenderingContext2D.prototype, 'drawImage')
      .mockImplementation(() => {});
    const canvas = createCanvas();
    const controller = crc(canvas, imageElement('loaded.png'));
    await nextFrame();
    FakeImage.instances[0].onload?.();
    await nextFrame();
    expect(drawImage).toHaveBeenCalledTimes(1);

    crc(canvas, imageElement('broken.png'));
    await nextFrame();
    const broken = FakeImage.instances[1];
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(broken.onerror).not.toBeNull();

    broken.onerror?.();
    await nextFrame();
    expect(drawImage).toHaveBeenCalledTimes(1);

    controller.dispose();
  });

  it('detaches and invalidates callbacks when the component is removed', async () => {
    const canvas = createCanvas();
    const controller = crc(canvas, imageElement('pending.png'));
    await nextFrame();
    const pending = FakeImage.instances[0];
    const savedLoad = pending.onload;
    const savedError = pending.onerror;

    crc(canvas, Empty({}));
    await nextFrame();

    expect(pending.onload).toBeNull();
    expect(pending.onerror).toBeNull();
    expect(pending.src).toBe('');

    savedLoad?.();
    savedError?.();
    expect(getCRCInstance(canvas).animationFrameId).toBeUndefined();

    controller.dispose();
  });
});

function imageElement(src: string) {
  return img({ src, x: 10, y: 20, width: 30, height: 40 });
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  return canvas;
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

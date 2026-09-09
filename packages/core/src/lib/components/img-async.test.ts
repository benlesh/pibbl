import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crc } from '../crc';
import {
  clearSharedState,
  getCRCInstance,
  GLOBAL_STATE,
} from '../global-state';
import { Image } from './img';
import { createElement } from '../element/create-element';
import { snapshotRealmScheduler } from '../scheduler/testing';

class FakeImage {
  static instances: FakeImage[] = [];

  readonly naturalWidth = 120;
  readonly naturalHeight = 80;
  readonly width = 13;
  readonly height = 17;
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

const Empty = (_props: {}) => {};

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
  it.each([
    ['zero', 0, 40],
    ['negative', -30, -40],
  ] as const)('delegates explicit %s image dimensions to Canvas', async (
    _case,
    width,
    height,
  ) => {
    const drawImage = vi
      .spyOn(CanvasRenderingContext2D.prototype, 'drawImage')
      .mockImplementation(() => {});
    const canvas = createCanvas();
    const controller = crc(canvas, createElement(Image, {
      style: {
        src: 'boundary.png',
        x: 10,
        y: 20,
        width,
        height,
      },
    }));
    await nextFrame();

    const image = FakeImage.instances[0];
    image.onload?.();
    await nextFrame();

    expect(drawImage).toHaveBeenLastCalledWith(image, 10, 20, width, height);
    controller.dispose();
  });

  it.each([
    ['width', { width: 30 }, [30, 80]],
    ['height', { height: 40 }, [120, 40]],
  ] as const)(
    'uses naturalWidth and naturalHeight independently when %s is explicit',
    async (_dimension, dimensions, expectedSize) => {
      const drawImage = vi
        .spyOn(CanvasRenderingContext2D.prototype, 'drawImage')
        .mockImplementation(() => {});
      const canvas = createCanvas();
      const controller = crc(canvas, createElement(Image, {
        style: { src: 'independent-natural-size.png', ...dimensions },
      }));
      await nextFrame();

      const image = FakeImage.instances[0];
      image.onload?.();
      await nextFrame();

      expect(drawImage).toHaveBeenLastCalledWith(
        image,
        0,
        0,
        ...expectedSize,
      );
      controller.dispose();
    },
  );

  it.each([
    ['none', [24.2, 20.2, 120, 80]],
    ['round', [23.5, 19.5, 120, 80]],
    ['ceil', [24.5, 20.5, 120, 80]],
    ['floor', [23.5, 19.5, 120, 80]],
  ] as const)('shares one %s-aligned rectangle across draw, border, and interaction', async (
    alignToPixelGrid,
    expectedRectangle,
  ) => {
    const drawImage = vi
      .spyOn(CanvasRenderingContext2D.prototype, 'drawImage')
      .mockImplementation(() => {});
    const stroke = vi
      .spyOn(CanvasRenderingContext2D.prototype, 'stroke')
      .mockImplementation(() => {});
    const canvas = createCanvas();
    const controller = crc(canvas, createElement(Image, {
      style: {
        src: 'aligned.png',
        x: 24.2,
        y: 20.2,
        width: 120,
        height: 80,
        stroke: 'blue',
        strokeWidth: 1,
        alignToPixelGrid,
      },
      onClick: () => undefined,
    }));
    await nextFrame();

    const image = FakeImage.instances[0];
    image.onload?.();
    await nextFrame();

    expect(drawImage).toHaveBeenLastCalledWith(image, ...expectedRectangle);
    const region = Array.from(getCRCInstance(canvas).regions)[0];
    expect(stroke).toHaveBeenLastCalledWith(region.path);
    const context = canvas.getContext('2d')!;
    expect(context.isPointInPath(
      region.path!,
      expectedRectangle[0] + expectedRectangle[2] / 2,
      expectedRectangle[1] + expectedRectangle[3] / 2,
    )).toBe(true);
    controller.dispose();
  });

  it('applies opacity zero when the image draws', async () => {
    const observedAlpha: number[] = [];
    const drawImage = vi
      .spyOn(CanvasRenderingContext2D.prototype, 'drawImage')
      .mockImplementation(function (this: CanvasRenderingContext2D) {
        observedAlpha.push(this.globalAlpha);
      });
    const canvas = createCanvas();
    const controller = crc(canvas, createElement(Image, {
      style: {
        src: 'transparent.png',
        x: 10,
        y: 20,
        width: 30,
        height: 40,
        opacity: 0,
      },
    }));
    await nextFrame();

    FakeImage.instances[0].onload?.();
    await nextFrame();

    expect(drawImage).toHaveBeenCalledOnce();
    expect(observedAlpha).toEqual([0]);
    controller.dispose();
  });

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
    expect(snapshotRealmScheduler()).toMatchObject({
      pendingHostFrames: 0,
      registeredRoots: 1,
      dirtyRoots: 0,
    });
    expect(drawImage).toHaveBeenCalledTimes(drawCount);

    controller.dispose();
  });

  it('keeps image resources and geometry authoritative to style', async () => {
    const canvas = createCanvas();
    const onClick = vi.fn();
    const legacyInput = {
      style: {
        src: 'styled.png',
        width: 30,
        height: 40,
      },
      src: 'legacy.png',
      x: 90,
      y: 80,
      width: 1,
      height: 1,
      onClick,
    } as unknown as Parameters<typeof Image>[0];
    const controller = crc(canvas, createElement(Image, legacyInput));
    await nextFrame();

    expect(FakeImage.instances).toHaveLength(1);
    expect(FakeImage.instances[0].src).toBe('styled.png');
    const region = Array.from(getCRCInstance(canvas).regions)[0];
    const context = canvas.getContext('2d')!;
    expect(context.isPointInPath(region.path!, 15, 20)).toBe(true);
    expect(context.isPointInPath(region.path!, 90, 80)).toBe(false);

    FakeImage.instances[0].onerror?.();
    await nextFrame();
    const failedRegion = Array.from(getCRCInstance(canvas).regions)[0];
    expect(context.isPointInPath(failedRegion.path!, 15, 20)).toBe(true);
    controller.dispose();
  });

  it('uses zero natural geometry until the current source loads', async () => {
    vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage')
      .mockImplementation(() => {});
    const canvas = createCanvas();
    const controller = crc(canvas, createElement(Image, {
      style: { src: 'natural.png' },
      onClick: () => undefined,
    }));
    await nextFrame();

    const context = canvas.getContext('2d')!;
    const pendingRegion = Array.from(getCRCInstance(canvas).regions)[0];
    expect(context.isPointInPath(pendingRegion.path!, 60, 40)).toBe(false);

    FakeImage.instances[0].onload?.();
    await nextFrame();
    const loadedRegion = Array.from(getCRCInstance(canvas).regions)[0];
    expect(context.isPointInPath(loadedRegion.path!, 60, 40)).toBe(true);
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

    crc(canvas, createElement(Empty, {}));
    await nextFrame();

    expect(pending.onload).toBeNull();
    expect(pending.onerror).toBeNull();
    expect(pending.src).toBe('');

    savedLoad?.();
    savedError?.();
    expect(snapshotRealmScheduler()).toMatchObject({
      pendingHostFrames: 0,
      registeredRoots: 1,
      dirtyRoots: 0,
    });

    controller.dispose();
  });

  it('releases a pending image and leaves saved callbacks inert on root disposal', async () => {
    const canvas = createCanvas();
    const controller = crc(canvas, imageElement('dispose-pending.png'));
    await nextFrame();
    const pending = FakeImage.instances[0];
    const savedLoad = pending.onload;
    const savedError = pending.onerror;
    const requestFrame = vi.spyOn(globalThis, 'requestAnimationFrame');

    controller.dispose();

    expect(pending.onload).toBeNull();
    expect(pending.onerror).toBeNull();
    expect(pending.src).toBe('');
    expect(GLOBAL_STATE.crcInstances.has(canvas)).toBe(false);

    savedLoad?.();
    savedError?.();
    expect(requestFrame).not.toHaveBeenCalled();
    expect(GLOBAL_STATE.crcInstances.has(canvas)).toBe(false);
  });
});

function imageElement(src: string) {
  return createElement(Image, {
    style: { src, x: 10, y: 20, width: 30, height: 40 },
  });
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  return canvas;
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

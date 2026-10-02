import { describe, expect, it, vi } from 'vitest';
import { DisplacementGpu } from './displacement-gpu.js';

describe('displacement GPU pass', () => {
  it('releases its context listeners on disposal', () => {
    const add = vi.spyOn(OffscreenCanvas.prototype, 'addEventListener');
    const remove = vi.spyOn(OffscreenCanvas.prototype, 'removeEventListener');
    const gpu = new DisplacementGpu();
    try {
      expect(add).toHaveBeenCalledWith('webglcontextlost', expect.any(Function));
      expect(add).toHaveBeenCalledWith('webglcontextrestored', expect.any(Function));
    } finally {
      gpu.dispose();
      expect(remove).toHaveBeenCalledWith('webglcontextlost', expect.any(Function));
      expect(remove).toHaveBeenCalledWith('webglcontextrestored', expect.any(Function));
      add.mockRestore(); remove.mockRestore();
    }
  });

  it('aborts while its context is lost and rebuilds lazily after restoration', async () => {
    const source = new OffscreenCanvas(1, 1), map = new OffscreenCanvas(1, 1);
    source.getContext('2d')!.fillRect(0, 0, 1, 1);
    map.getContext('2d')!.fillStyle = 'rgb(128 128 128)'; map.getContext('2d')!.fillRect(0, 0, 1, 1);
    let losses = 0, restorations = 0;
    const gpu = new DisplacementGpu({ onContextLost: () => { losses += 1; }, onContextRestored: () => { restorations += 1; } });
    const gl = (gpu as unknown as { canvas: OffscreenCanvas }).canvas.getContext('webgl2')!;
    const lose = gl.getExtension('WEBGL_lose_context');
    expect(lose).not.toBeNull();
    try {
      gpu.apply(source, { source: map, width: 1, height: 1, revision: 1, resource: {}, placement: {} }, 0).close();
      expect((gpu as unknown as { maps: Map<object, unknown> }).maps.size).toBe(1);
      lose!.loseContext();
      await new Promise<void>(resolve => setTimeout(resolve, 50));
      expect(losses).toBe(1);
      expect((gpu as unknown as { maps: Map<object, unknown>; resources: unknown }).maps.size).toBe(0);
      expect((gpu as unknown as { resources: unknown }).resources).toBeUndefined();
      expect(() => gpu.apply(source, { source: map, width: 1, height: 1, revision: 1, resource: {}, placement: {} }, 0)).toThrow(/context was lost/);
      lose!.restoreContext();
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      expect(restorations).toBe(1);
      gpu.apply(source, { source: map, width: 1, height: 1, revision: 1, resource: {}, placement: {} }, 0).close();
    } finally { gpu.dispose(); }
  });

  it('preserves top-down orientation for an asymmetric neutral source', () => {
    const source = new OffscreenCanvas(2, 2); const sourceContext = source.getContext('2d')!;
    sourceContext.fillStyle = 'red'; sourceContext.fillRect(0, 0, 1, 1);
    sourceContext.fillStyle = 'blue'; sourceContext.fillRect(0, 1, 1, 1);
    const map = new OffscreenCanvas(1, 1); const mapContext = map.getContext('2d')!;
    mapContext.fillStyle = 'rgb(128 128 0)'; mapContext.fillRect(0, 0, 1, 1);
    const gpu = new DisplacementGpu(); const bitmap = gpu.apply(source, { source: map, width: 1, height: 1, revision: 1, resource: {}, placement: {} }, 0);
    const target = new OffscreenCanvas(2, 2); const context = target.getContext('2d')!; context.drawImage(bitmap, 0, 0); bitmap.close();
    expect(context.getImageData(0, 0, 1, 1).data[0]).toBeGreaterThan(200);
    expect(context.getImageData(0, 1, 1, 1).data[2]).toBeGreaterThan(200);
    gpu.dispose();
  });
  it('keeps neutral maps unchanged and samples right for positive red', () => {
    const source = new OffscreenCanvas(4, 1);
    const sourceContext = source.getContext('2d')!;
    sourceContext.fillStyle = 'red'; sourceContext.fillRect(0, 0, 1, 1);
    const neutral = new OffscreenCanvas(1, 1); neutral.getContext('2d')!.fillStyle = 'rgb(128 128 0)'; neutral.getContext('2d')!.fillRect(0, 0, 1, 1);
    const positive = new OffscreenCanvas(1, 1); positive.getContext('2d')!.fillStyle = 'rgb(255 128 0)'; positive.getContext('2d')!.fillRect(0, 0, 1, 1);
    const gpu = new DisplacementGpu();
    const raster = (canvas: OffscreenCanvas) => ({ source: canvas, width: 1, height: 1, revision: 1, resource: {}, placement: {} });
    const target = new OffscreenCanvas(4, 1); const context = target.getContext('2d')!;
    let bitmap = gpu.apply(source, raster(neutral), 1); context.drawImage(bitmap, 0, 0); bitmap.close();
    expect(context.getImageData(0, 0, 1, 1).data[0]).toBeGreaterThan(200);
    context.clearRect(0,0,4,1); bitmap = gpu.apply(source, raster(positive), 1); context.drawImage(bitmap,0,0); bitmap.close();
    expect(context.getImageData(0, 0, 1, 1).data[3]).toBe(0);
    gpu.dispose();
  });
});

it('places a repeated map in logical coordinates independently of capture origin and density', () => {
  const source = new OffscreenCanvas(8, 2);
  const context = source.getContext('2d')!;
  const image = context.createImageData(8, 2);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 8; x++) {
    const i = (y * 8 + x) * 4;
    image.data[i] = x * 30; image.data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const map = new OffscreenCanvas(2, 1), mapContext = map.getContext('2d')!;
  mapContext.fillStyle = 'rgb(255 128 128)'; mapContext.fillRect(0, 0, 1, 1);
  mapContext.fillStyle = 'rgb(0 128 128)'; mapContext.fillRect(1, 0, 1, 1);
  const gpu = new DisplacementGpu();
  const target = new OffscreenCanvas(8, 2), targetContext = target.getContext('2d')!;
  const raster = { source: map, width: 2, height: 1, revision: 1, resource: {}, placement: {} };
  try {
    // One logical map texel covers one backing pixel at density two.
    const bitmap = gpu.apply(source, raster, 1, { tileWidth: 1, tileHeight: 1, offsetX: 1 }, {
      originX: 10, originY: 20, density: 2, region: { x: 9, y: 20, width: 4, height: 1 },
    });
    targetContext.drawImage(bitmap, 0, 0); bitmap.close();
    const output = targetContext.getImageData(0, 0, 8, 1).data;
    // Alternate +1/-1 sampling. An incorrect capture-relative origin swaps these.
    expect(output[0]).toBe(30); expect(output[4]).toBe(0);
    expect(output[8]).toBe(90); expect(output[12]).toBe(60);
  } finally { gpu.dispose(); }
});

it('uses transparent source samples beyond the edge, including the bilinear footprint', () => {
  const source = new OffscreenCanvas(2, 1), context = source.getContext('2d')!;
  context.fillStyle = 'red'; context.fillRect(0, 0, 2, 1);
  const map = new OffscreenCanvas(1, 1), mapContext = map.getContext('2d')!;
  mapContext.fillStyle = 'rgb(255 128 128)'; mapContext.fillRect(0, 0, 1, 1);
  const gpu = new DisplacementGpu();
  try {
    const bitmap = gpu.apply(source, { source: map, width: 1, height: 1, revision: 1, resource: {}, placement: {} }, 0.5);
    const target = new OffscreenCanvas(2, 1), output = target.getContext('2d')!;
    output.drawImage(bitmap, 0, 0); bitmap.close();
    expect(output.getImageData(1, 0, 1, 1).data[3]).toBeCloseTo(128, -1);
  } finally { gpu.dispose(); }
});

it('replaces one cached map upload per committed revision and releases its final lease', () => {
  const source = new OffscreenCanvas(2, 1), map = new OffscreenCanvas(1, 1);
  const mapContext = map.getContext('2d')!;
  mapContext.fillStyle = 'rgb(128 128 128)'; mapContext.fillRect(0, 0, 1, 1);
  const resource = {};
  const gpu = new DisplacementGpu();
  const upload = vi.spyOn(WebGL2RenderingContext.prototype, 'texImage2D');
  const remove = vi.spyOn(WebGL2RenderingContext.prototype, 'deleteTexture');
  try {
    const apply = (revision: number) => gpu.apply(source, { source: map, width: 1, height: 1, revision, resource, placement: {} }, 1).close();
    apply(1); apply(1);
    expect(upload).toHaveBeenCalledTimes(3); // Two scenes, one shared map.
    apply(2);
    expect(upload).toHaveBeenCalledTimes(5); // New scene and replacement map pixels.
    gpu.retainMaps(new Set([resource]));
    expect(remove).not.toHaveBeenCalled();
    gpu.retainMaps(new Set());
    expect(remove).toHaveBeenCalledTimes(1);
    apply(2);
    expect(upload).toHaveBeenCalledTimes(7); // A new lease cannot reuse a released upload.
  } finally { gpu.dispose(); upload.mockRestore(); remove.mockRestore(); }
});

it('weights unpremultiplied map channels by alpha exactly once', () => {
  const source = new OffscreenCanvas(4, 1), input = source.getContext('2d')!;
  for (let x = 0; x < 4; x++) { input.fillStyle = `rgb(${x * 80} 0 0)`; input.fillRect(x, 0, 1, 1); }
  const map = new OffscreenCanvas(1, 1), mapContext = map.getContext('2d')!;
  const image = mapContext.createImageData(1, 1); image.data.set([255, 128, 128, 128]); mapContext.putImageData(image, 0, 0);
  const gpu = new DisplacementGpu();
  try {
    const bitmap = gpu.apply(source, { source: map, width: 1, height: 1, revision: 1, resource: {}, placement: {} }, 2);
    const output = new OffscreenCanvas(4, 1).getContext('2d')!; output.drawImage(bitmap, 0, 0); bitmap.close();
    expect(output.getImageData(0, 0, 1, 1).data[0]).toBeGreaterThan(70);
    expect(output.getImageData(0, 0, 1, 1).data[0]).toBeLessThan(90);
    mapContext.clearRect(0, 0, 1, 1);
    const transparent = gpu.apply(source, { source: map, width: 1, height: 1, revision: 2, resource: {}, placement: {} }, 2);
    output.clearRect(0, 0, 4, 1); output.drawImage(transparent, 0, 0); transparent.close();
    expect(output.getImageData(1, 0, 1, 1).data).toEqual(new Uint8ClampedArray([80, 0, 0, 255]));
  } finally { gpu.dispose(); }
});

it('interpolates scene pixels with premultiplied alpha without dark fringes', () => {
  const source = new OffscreenCanvas(2, 1), input = source.getContext('2d')!;
  input.fillStyle = 'rgba(255, 0, 0, 0.5)'; input.fillRect(0, 0, 1, 1);
  const map = new OffscreenCanvas(1, 1), mapContext = map.getContext('2d')!;
  mapContext.fillStyle = 'rgb(255 128 128)'; mapContext.fillRect(0, 0, 1, 1);
  const gpu = new DisplacementGpu();
  try {
    const bitmap = gpu.apply(source, { source: map, width: 1, height: 1, revision: 1, resource: {}, placement: {} }, 0.5);
    const output = new OffscreenCanvas(2, 1).getContext('2d')!; output.drawImage(bitmap, 0, 0); bitmap.close();
    const pixel = output.getImageData(0, 0, 1, 1).data;
    expect(pixel[0]).toBe(255); expect(pixel[1]).toBe(0); expect(pixel[2]).toBe(0); expect(pixel[3]).toBeCloseTo(64, -1);
  } finally { gpu.dispose(); }
});

it('rotates repeated map placement without rotating its displacement axes', () => {
  const source = new OffscreenCanvas(4, 2), input = source.getContext('2d')!;
  for (let x = 0; x < 4; x++) { input.fillStyle = `rgb(${x * 40} 0 0)`; input.fillRect(x, 0, 1, 2); }
  const map = new OffscreenCanvas(2, 1), mapContext = map.getContext('2d')!;
  mapContext.fillStyle = 'rgb(255 128 128)'; mapContext.fillRect(0, 0, 1, 1);
  mapContext.fillStyle = 'rgb(0 128 128)'; mapContext.fillRect(1, 0, 1, 1);
  const gpu = new DisplacementGpu();
  try {
    const bitmap = gpu.apply(source, { source: map, width: 2, height: 1, revision: 1, resource: {}, placement: { rotation: 90 } }, 1);
    const output = new OffscreenCanvas(4, 2).getContext('2d')!; output.drawImage(bitmap, 0, 0); bitmap.close();
    expect(output.getImageData(1, 0, 1, 1).data[0]).toBe(80);
    expect(output.getImageData(1, 1, 1, 1).data[0]).toBe(0);
  } finally { gpu.dispose(); }
});

it('retries a map upload after an unsuccessful GPU pass', () => {
  const source = new OffscreenCanvas(2, 1), map = new OffscreenCanvas(1, 1), resource = {};
  const gpu = new DisplacementGpu();
  const upload = vi.spyOn(WebGL2RenderingContext.prototype, 'texImage2D');
  const error = vi.spyOn(WebGL2RenderingContext.prototype, 'getError');
  const apply = (revision: number) => gpu.apply(source, { source: map, width: 1, height: 1, revision, resource, placement: {} }, 1).close();
  try {
    apply(1);
    expect(upload).toHaveBeenCalledTimes(2);
    error.mockReturnValueOnce(WebGL2RenderingContext.INVALID_OPERATION);
    expect(() => apply(2)).toThrow(/GPU processing failed/);
    expect(upload).toHaveBeenCalledTimes(4);
    apply(2);
    expect(upload).toHaveBeenCalledTimes(6);
  } finally { gpu.dispose(); upload.mockRestore(); error.mockRestore(); }
});

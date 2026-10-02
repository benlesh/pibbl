import { describe, expect, it } from 'vitest';
import { DisplacementGpu } from './displacement-gpu.js';

describe('displacement GPU pass', () => {
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

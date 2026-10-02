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

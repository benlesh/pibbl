import type { PixelBounds } from '../lib/filter/filter-region.js';

/** Decodes CRC's exact signed eight-bit displacement encoding. */
export function decodeDisplacementChannel(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('Displacement channel must be finite.');
  const channel = Math.min(255, Math.max(0, value));
  return channel < 128 ? (channel - 128) / 128 : (channel - 128) / 127;
}

/** Expands a sampled scene window by maximum displacement and bilinear support. */
export function expandDisplacementInput(
  output: Readonly<PixelBounds>,
  strength: number,
  density: number,
): PixelBounds {
  if (!Number.isFinite(strength) || strength < 0 || !Number.isFinite(density) || density <= 0) {
    throw new RangeError('Displacement strength and density must be finite and nonnegative.');
  }
  const extent = Math.ceil(strength * density) + 1;
  return {
    x: output.x - extent,
    y: output.y - extent,
    width: output.width + 2 * extent,
    height: output.height + 2 * extent,
  };
}

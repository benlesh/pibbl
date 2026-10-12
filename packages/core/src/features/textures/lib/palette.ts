import type { ProceduralTextureProps } from './procedural-texture.js';
import type { ReactionDiffusionProps } from './reaction-diffusion.js';
/**
 * Ordered colors forming a texture's presentation ramp.
 *
 * @see {@link texturePalettes}
 * @see {@link ProceduralTextureProps}
 * @see {@link ReactionDiffusionProps}
 */
export type TexturePalette = readonly string[];
/**
 * Built-in immutable color ramps for procedural texture presentation.
 *
 * @see {@link TexturePalette}
 */
export const texturePalettes = Object.freeze({
  /** Dark blue through teal to pale yellow. See {@link texturePalettes}. */
  lagoon: Object.freeze(["#081e2c", "#125568", "#50b8ad", "#e5efb3"]),
  /** Warm ivory through lavender to deep blue. See {@link texturePalettes}. */
  porcelain: Object.freeze(["#f2e7d4", "#b7a9c0", "#536194", "#172955"]),
  /** Dark violet through coral to pale yellow. See {@link texturePalettes}. */
  ember: Object.freeze(["#241526", "#893955", "#e88470", "#ffe3aa"]),
});

export function paletteLut(palette: TexturePalette): Uint8ClampedArray {
  if (palette.length < 2 || palette.length > 16)
    throw new RangeError("Texture palette requires 2–16 #RRGGBB colors.");
  const colors = palette.map((color) => {
    if (!/^#[0-9a-f]{6}$/i.test(color))
      throw new TypeError("Texture palette colors must use #RRGGBB.");
    return [
      parseInt(color.slice(1, 3), 16),
      parseInt(color.slice(3, 5), 16),
      parseInt(color.slice(5, 7), 16),
    ];
  });
  const lut = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const position = (i / 255) * (colors.length - 1);
    const lo = Math.min(colors.length - 2, Math.floor(position)),
      mix = position - lo;
    for (let c = 0; c < 3; c++)
      lut[i * 4 + c] = colors[lo][c] * (1 - mix) + colors[lo + 1][c] * mix;
    lut[i * 4 + 3] = 255;
  }
  return lut;
}

/**
 * The width and height of a texture's raster grid.
 *
 * @see {@link TexturePalette}
 * @see {@link ReactionDiffusionProps}
 * @see {@link ProceduralTextureProps}
 */
export interface TextureResolution {
  /**
   * Horizontal extent in the units of the containing geometry or surface. See
   * {@link TextureResolution}.
   */
  readonly width: number;
  /**
   * Vertical extent in the units of the containing geometry or surface. See
   * {@link TextureResolution}.
   */
  readonly height: number;
}
export function validateResolution(
  value: TextureResolution = { width: 256, height: 160 },
): TextureResolution {
  if (
    ![value.width, value.height].every(
      (n) => Number.isInteger(n) && n >= 8 && n <= 1024,
    ) ||
    value.width * value.height > 262144
  ) {
    throw new RangeError(
      "Texture resolution must contain integer dimensions from 8 to 1024 and at most 262144 cells.",
    );
  }
  return { width: value.width, height: value.height };
}
export function validateSeed(seed = 42): number {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new RangeError("Texture seed must be an unsigned 32-bit integer.");
  return seed;
}

import {
  defineTexture,
  type TextureContext,
  type TextureRecipe,
} from "@pibbl/core";
import { paletteLut, texturePalettes, validateSeed } from "./palette.js";

/** Shared periodic motion controls for geometric and fiber recipes. @see {@link stripes} */
export interface PatternMotionOptions {
  /** Initial phase in cycles; any finite value wraps. See {@link PatternMotionOptions}. */
  readonly phase?: number;
  /** Nonnegative cycles per second, up to 20; zero idles. See {@link PatternMotionOptions}. */
  readonly speed?: number;
}
/** Controls for periodic stripes; rotate the repeat lattice through paint placement. @see {@link stripes} */
export interface StripesOptions extends PatternMotionOptions {
  /** Integer stripe periods across the tile, 1–64; default 8. See {@link StripesOptions}. */
  readonly bands?: number;
  /** Foreground fraction of each period, 0–1; default 0.5. See {@link StripesOptions}. */
  readonly dutyCycle?: number;
  /** Horizontal wave amplitude in tile fractions, 0–1; default 0. See {@link StripesOptions}. */
  readonly wave?: number;
  /** Integer wave periods down the tile, 1–16; default 1. See {@link StripesOptions}. */
  readonly waveCycles?: number;
}
/** Controls for a two-color checkerboard. @see {@link checkers} */
export interface CheckersOptions extends PatternMotionOptions {
  /** Even integer columns, 2–64; default 8. See {@link CheckersOptions}. */
  readonly columns?: number;
  /** Even integer rows, 2–64; default 8. See {@link CheckersOptions}. */
  readonly rows?: number;
}
/** Controls for seeded seamless wood grain with optional knots. @see {@link woodGrain} */
export interface WoodGrainOptions extends PatternMotionOptions {
  /** Unsigned 32-bit variation seed; default 42. See {@link WoodGrainOptions}. */
  readonly seed?: number;
  /** Integer grain periods across the tile, 4–128; default 32. See {@link WoodGrainOptions}. */
  readonly grain?: number;
  /** Irregular grain bending, 0–1; default 0.5. See {@link WoodGrainOptions}. */
  readonly distortion?: number;
  /** Fine fiber and pore variation, 0–1; default 0.4. See {@link WoodGrainOptions}. */
  readonly roughness?: number;
  /** Integer knot count, 0–12; default 0 for clear grain. See {@link WoodGrainOptions}. */
  readonly knots?: number;
  /** Knot radius in tile fractions, 0.02–0.18; default 0.09. See {@link WoodGrainOptions}. */
  readonly knotSize?: number;
}
const tau = Math.PI * 2;
function wrap(value: number) {
  return ((value % 1) + 1) % 1;
}
function bounded(
  name: string,
  value: number,
  min: number,
  max: number,
  integer = false,
) {
  if (
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    throw new RangeError(
      `${name} must be ${integer ? "an integer " : ""}in [${min}, ${max}].`,
    );
  return value;
}
function motion(options: PatternMotionOptions) {
  const phase = options.phase ?? 0;
  if (!Number.isFinite(phase))
    throw new RangeError("Texture phase must be finite.");
  return {
    phase: wrap(phase),
    speed: bounded("Texture speed", options.speed ?? 0, 0, 20),
  };
}
type Motion = ReturnType<typeof motion>;
interface PatternState<Config> {
  config: Config;
  phase: number;
  fresh: boolean;
  fieldDirty: boolean;
  field: Float32Array;
  image: ImageData | undefined;
  paletteKey?: string;
  lut?: Uint8ClampedArray;
}
// Shared lifecycle only. Each public factory has its own configuration and one
// fixed return contract. Sampling and recoloring reuse bounded buffers.
function pattern<Options, Config extends Motion>(
  validate: (options: Options) => Config,
  sample: (config: Config, u: number, v: number, phase: number) => number,
) {
  const definition = defineTexture<Config, PatternState<Config>>({
    create(context, config) {
      const { width, height } = context.canvas;
      if (config.speed > 0) context.requestFrame();
      return {
        config,
        phase: config.phase,
        fresh: true,
        fieldDirty: true,
        field: new Float32Array(width * height),
        image: new ImageData(width, height),
      };
    },
    update(state, config, context) {
      if (JSON.stringify(config) === JSON.stringify(state.config)) return;
      if (config.phase !== state.config.phase) state.phase = config.phase;
      if (config.speed !== state.config.speed) state.fresh = true;
      state.config = config;
      state.fieldDirty = true;
      context.invalidate();
      if (config.speed > 0) context.requestFrame();
    },
    advance(state, frame, context) {
      if (state.config.speed === 0) return;
      if (!state.fresh && frame.delta > 0) {
        state.phase = wrap(
          state.phase + (frame.delta * state.config.speed) / 1000,
        );
        state.fieldDirty = true;
        context.invalidate();
      }
      state.fresh = false;
      context.requestFrame();
    },
    rasterize(state, context: TextureContext) {
      const { width, height } = context.canvas;
      if (state.fieldDirty) {
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++)
            state.field[y * width + x] = sample(
              state.config,
              x === width - 1 ? 0 : x / (width - 1),
              y === height - 1 ? 0 : y / (height - 1),
              state.phase,
            );
        state.fieldDirty = false;
      }
      const palette = context.palette ?? texturePalettes.porcelain;
      const key = palette.join();
      if (key !== state.paletteKey) {
        state.lut = paletteLut(palette);
        state.paletteKey = key;
      }
      const image = state.image!;
      const data = image.data,
        lut = state.lut!;
      for (let i = 0; i < state.field.length; i++) {
        const index =
          Math.round(Math.max(0, Math.min(1, state.field[i])) * 255) * 4;
        data[i * 4] = lut[index];
        data[i * 4 + 1] = lut[index + 1];
        data[i * 4 + 2] = lut[index + 2];
        data[i * 4 + 3] = 255;
      }
      context.canvas.getContext("2d")!.putImageData(image, 0, 0);
    },
    dispose(state) {
      state.field = new Float32Array(0);
      state.image = undefined;
      state.lut = undefined;
    },
  });
  return (options: Options): TextureRecipe => definition(validate(options));
}
const stripeRecipe = /* @__PURE__ */ pattern(
  (options: StripesOptions) => ({
    ...motion(options),
    bands: bounded("Stripe bands", options.bands ?? 8, 1, 64, true),
    dutyCycle: bounded("Stripe dutyCycle", options.dutyCycle ?? 0.5, 0, 1),
    wave: bounded("Stripe wave", options.wave ?? 0, 0, 1),
    waveCycles: bounded(
      "Stripe waveCycles",
      options.waveCycles ?? 1,
      1,
      16,
      true,
    ),
  }),
  (c, u, v, phase) =>
    wrap(
      (u + c.wave * Math.sin(tau * (v * c.waveCycles + phase))) * c.bands +
        phase,
    ) < c.dutyCycle
      ? 1
      : 0,
);

/**
 * Creates seamless straight or wavy stripes using the palette endpoints.
 * @param options - Stripe geometry and periodic motion. See {@link StripesOptions}.
 * @returns A mountable texture recipe with no message commands. See {@link TextureRecipe}.
 * @see {@link StripesOptions}
 */
export function stripes(options: StripesOptions = {}): TextureRecipe {
  return stripeRecipe(options);
}
const checkerRecipe = /* @__PURE__ */ pattern(
  (options: CheckersOptions) => {
    const columns = bounded(
      "Checker columns",
      options.columns ?? 8,
      2,
      64,
      true,
    );
    const rows = bounded("Checker rows", options.rows ?? 8, 2, 64, true);
    if (columns % 2 || rows % 2)
      throw new RangeError(
        "Checker rows and columns must be even for seamless alternation.",
      );
    return { ...motion(options), columns, rows };
  },
  (c, u, v, phase) =>
    (Math.floor(wrap(u + phase) * c.columns) + Math.floor(v * c.rows)) % 2,
);
/**
 * Creates a seamless checkerboard using the palette endpoints.
 * @param options - Even row/column counts and periodic motion. See {@link CheckersOptions}.
 * @returns A mountable texture recipe with no message commands. See {@link TextureRecipe}.
 * @see {@link CheckersOptions}
 */
export function checkers(options: CheckersOptions = {}): TextureRecipe {
  return checkerRecipe(options);
}
function hash(index: number, seed: number) {
  let value = Math.imul(index ^ seed, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff;
}
// Seeded lattice noise wraps both axes. Several scales bend the growth lines
// independently, avoiding the uniform sine-wave paths of the original study.
function noise(
  u: number,
  v: number,
  columns: number,
  rows: number,
  seed: number,
) {
  const x = wrap(u) * columns,
    y = wrap(v) * rows;
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = hash(iy * columns + ix, seed);
  const b = hash(iy * columns + ((ix + 1) % columns), seed);
  const c = hash(((iy + 1) % rows) * columns + ix, seed);
  const d = hash(((iy + 1) % rows) * columns + ((ix + 1) % columns), seed);
  return ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy) * 2 - 1;
}
const woodRecipe = /* @__PURE__ */ pattern(
  (options: WoodGrainOptions) => {
    const seed = validateSeed(options.seed);
    const knots = bounded("Wood knots", options.knots ?? 0, 0, 12, true);
    return {
      ...motion(options),
      seed,
      grain: bounded("Wood grain", options.grain ?? 32, 4, 128, true),
      distortion: bounded("Wood distortion", options.distortion ?? 0.5, 0, 1),
      roughness: bounded("Wood roughness", options.roughness ?? 0.4, 0, 1),
      knotSize: bounded("Wood knotSize", options.knotSize ?? 0.09, 0.02, 0.18),
      knots: Array.from({ length: knots }, (_, i) => ({
        u: hash(i * 7 + 11, seed),
        v: hash(i * 7 + 21, seed),
        aspect: 1 + 0.9 * hash(i * 7 + 31, seed),
      })),
    };
  },
  (c, u, v, phase) => {
    v = wrap(v + phase);
    const broad = noise(u, v, 4, 4, c.seed);
    const medium = noise(u, v, 8, 8, c.seed ^ 0x517cc1b7);
    const fine = noise(u, v, 16, 16, c.seed ^ 0x68bc21eb);
    let coordinate =
      u + c.distortion * (0.12 * broad + 0.045 * medium + 0.015 * fine);
    // Shortest periodic offsets let a knot crossing a tile boundary continue
    // in its neighboring copy. Compact support vanishes before antipodal points.
    for (const knot of c.knots) {
      const dx = wrap(u - knot.u + 0.5) - 0.5;
      const dy = wrap(v - knot.v + 0.5) - 0.5;
      const radius = Math.hypot(dx, dy / knot.aspect) / (c.knotSize * 0.7);
      if (radius >= 2) continue;
      // Inverse stream coordinate around an elliptical obstacle: subtracting
      // this displacement makes equal-growth contours bow away from the core.
      // At radius 1 the center streamline follows the knot boundary; the
      // compact taper restores undisturbed grain at radius 2.
      const outside = Math.max(1, radius);
      const influence = Math.pow((4 - outside * outside) / 3, 2);
      coordinate -= (dx / (outside * outside)) * influence;
    }
    const growth =
      0.5 +
      0.5 * Math.cos(tau * (coordinate * c.grain + c.roughness * fine * 0.2));
    const fiber = Math.pow(
      0.5 + 0.5 * Math.cos(tau * coordinate * c.grain * 3),
      12,
    );
    let value =
      0.72 -
      0.32 * Math.pow(growth, 7) +
      0.055 * broad -
      c.roughness * (0.09 * fiber + 0.035 * fine);
    for (const knot of c.knots) {
      const dx = wrap(u - knot.u + 0.5) - 0.5;
      const dy = wrap(v - knot.v + 0.5) - 0.5;
      const radius = Math.hypot(dx, dy / knot.aspect) / (c.knotSize * 0.7);
      if (radius >= 1) continue;
      const edge = Math.min(1, Math.max(0, (radius - 0.85) / 0.15));
      const blend = 1 - edge * edge * (3 - 2 * edge);
      const ring = Math.pow(0.5 + 0.5 * Math.cos(tau * radius * 3), 5);
      const knotValue =
        0.55 - 0.23 * ring - 0.28 * Math.pow(Math.max(0, 1 - radius * 3), 2);
      value += (knotValue - value) * blend;
    }
    return value;
  },
);
/**
 * Creates seamless seeded wood with irregular grain, fine fibers, and optional knots.
 * @param options - Grain frequency, distortion, roughness, knots, seed, and motion. See {@link WoodGrainOptions}.
 * @returns A mountable texture recipe with no message commands. See {@link TextureRecipe}.
 * @see {@link WoodGrainOptions}
 */
export function woodGrain(options: WoodGrainOptions = {}): TextureRecipe {
  return woodRecipe(options);
}

/** Shared thread geometry and shading for seamless woven fabrics. @see {@link plainWeave} */
export interface FabricOptions extends PatternMotionOptions {
  /** Unsigned 32-bit fiber variation seed; default 42. See {@link FabricOptions}. */
  readonly seed?: number;
  /** Thread count on each axis, a multiple of 8 in 8–128; default 16. See {@link FabricOptions}. */
  readonly threads?: number;
  /** Thread width as a fraction of cell spacing, 0.2–1; default 0.8. See {@link FabricOptions}. */
  readonly threadWidth?: number;
  /** Rounded thread lighting strength, 0–1; default 0.65. See {@link FabricOptions}. */
  readonly relief?: number;
  /** Seeded directional fibers and soft, uneven yarn edges, 0–1; default 0.2. See {@link FabricOptions}. */
  readonly fuzz?: number;
}
function fabricConfig(options: FabricOptions) {
  const threads = bounded(
    "Fabric threads",
    options.threads ?? 16,
    8,
    128,
    true,
  );
  if (threads % 8 !== 0)
    throw new RangeError("Fabric threads must be a multiple of 8.");
  return {
    ...motion(options),
    seed: validateSeed(options.seed),
    threads,
    threadWidth: bounded(
      "Fabric threadWidth",
      options.threadWidth ?? 0.8,
      0.2,
      1,
    ),
    relief: bounded("Fabric relief", options.relief ?? 0.65, 0, 1),
    fuzz: bounded("Fabric fuzz", options.fuzz ?? 0.2, 0, 1),
  };
}
type FabricConfig = ReturnType<typeof fabricConfig>;
function fabricSample(
  c: FabricConfig,
  u: number,
  v: number,
  warpOnTop: boolean,
) {
  const x = u * c.threads,
    y = v * c.threads;
  const warpFiber = noise(u, v, c.threads * 8, 16, c.seed);
  const weftFiber = noise(u, v, 16, c.threads * 8, c.seed ^ 0x68bc21eb);
  // Spun yarn has uneven edges and a soft fiber envelope. Coverage, rather
  // than a binary inside/outside test, keeps enlarged yarn from looking cut out.
  const warpRadius = c.threadWidth * (1 + c.fuzz * 0.14 * warpFiber);
  const weftRadius = c.threadWidth * (1 + c.fuzz * 0.14 * weftFiber);
  const acrossWarp = (Math.abs((x % 1) - 0.5) * 2) / warpRadius;
  const acrossWeft = (Math.abs((y % 1) - 0.5) * 2) / weftRadius;
  const softness = 0.1 + c.fuzz * 0.45;
  const coverage = (across: number) => {
    const t = Math.max(
      0,
      Math.min(1, (across - (1 - softness)) / (2 * softness)),
    );
    return 1 - t * t * (3 - 2 * t);
  };
  const warp = coverage(acrossWarp),
    weft = coverage(acrossWeft);
  const warpCrown = Math.sqrt(Math.max(0, 1 - acrossWarp * acrossWarp));
  const weftCrown = Math.sqrt(Math.max(0, 1 - acrossWeft * acrossWeft));
  const warpValue =
    0.62 + c.relief * (0.14 * warpCrown - 0.07) + c.fuzz * 0.15 * warpFiber;
  const weftValue =
    0.43 + c.relief * (0.14 * weftCrown - 0.07) + c.fuzz * 0.15 * weftFiber;
  const gap = 0.18;
  // The drawdown determines occlusion at crossings. A yarn stays continuous
  // along a float; no per-cell bevel or repeated shadow chops it into blocks.
  return warpOnTop
    ? warpValue * warp + (weftValue * weft + gap * (1 - weft)) * (1 - warp)
    : weftValue * weft + (warpValue * warp + gap * (1 - warp)) * (1 - weft);
}
const plainWeaveRecipe = /* @__PURE__ */ pattern(
  fabricConfig,
  (c, u, v, phase) => {
    v = wrap(v + phase);
    const x = Math.floor(u * c.threads),
      y = Math.floor(v * c.threads);
    return fabricSample(c, u, v, (x + y) % 2 === 0);
  },
);
const twillRecipe = /* @__PURE__ */ pattern(fabricConfig, (c, u, v, phase) => {
  v = wrap(v + phase);
  const x = Math.floor(u * c.threads),
    y = Math.floor(v * c.threads);
  return fabricSample(c, u, v, (((x - y) % 4) + 4) % 4 < 2);
});
const herringboneHarnesses = [0, 1, 2, 3, 1, 0, 3, 2] as const;
const herringboneRecipe = /* @__PURE__ */ pattern(
  fabricConfig,
  (c, u, v, phase) => {
    v = wrap(v + phase);
    const x = Math.floor(u * c.threads) % 8,
      y = Math.floor(v * c.threads);
    // CottonWorks Weaving 101, p. 23: harness sequence 1,2,3,4,2,1,4,3.
    // The offset at each reversal breaks the diagonal instead of duplicating
    // the turning end, which would produce a pointed/chevron-like twill.
    const harness = herringboneHarnesses[x];
    return fabricSample(c, u, v, (harness + y) % 4 >= 2);
  },
);
/**
 * Creates an alternating over-under plain weave with rounded threads and seeded fibers.
 * @param options - Thread geometry, shading, seed, and motion. See {@link FabricOptions}.
 * @returns A mountable recipe with no message commands. See {@link TextureRecipe}.
 * @see {@link FabricOptions}
 */
export function plainWeave(options: FabricOptions = {}): TextureRecipe {
  return plainWeaveRecipe(options);
}
/**
 * Creates a two-over, two-under diagonal twill fabric.
 * @param options - Thread geometry, shading, seed, and motion. See {@link FabricOptions}.
 * @returns A mountable recipe with no message commands. See {@link TextureRecipe}.
 * @see {@link FabricOptions}
 */
export function twill(options: FabricOptions = {}): TextureRecipe {
  return twillRecipe(options);
}
/**
 * Creates a reversing twill fabric with repeating herringbone chevrons.
 * @param options - Thread geometry, shading, seed, and motion. See {@link FabricOptions}.
 * @returns A mountable recipe with no message commands. See {@link TextureRecipe}.
 * @see {@link FabricOptions}
 */
export function herringbone(options: FabricOptions = {}): TextureRecipe {
  return herringboneRecipe(options);
}

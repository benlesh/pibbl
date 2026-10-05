import type { TextureRecipe } from '../../../lib/textures/texture.js';
import { rasterizeField, releaseField } from "./wasm/memory.js";
import { defineTexture, type TextureContext } from "@crc/core";
import {
  marbleField,
  paperField,
  cellularField,
  type MaterialGenerator,
} from "./material-field.js";
import { InkSimulation } from "./simulation.js";
import { paletteLut, texturePalettes, validateSeed } from "./palette.js";
export { useTexture } from "@crc/core";
/**
 * Seed, feature scale, and detail controls shared by static material recipes.
 *
 * @see {@link marble}
 * @see {@link paper}
 * @see {@link cellular}
 */
export interface MaterialOptions {
  /**
   * Seed used for deterministic sampling or simulation initialization. See {@link MaterialOptions}
   * .
   */
  readonly seed?: number;
  /** Feature frequency across the generated material. See {@link MaterialOptions}. */
  readonly scale?: number;
  /** Material-specific distortion, grain strength, or cellular jitter. See {@link MaterialOptions}. */
  readonly detail?: number;
}
/**
 * Seed and pattern preset for a reaction-diffusion recipe.
 *
 * @see {@link reactionDiffusion}
 */
export interface ReactionDiffusionOptions {
  /**
   * Seed used for deterministic sampling or simulation initialization. See
   * {@link ReactionDiffusionOptions}.
   */
  readonly seed?: number;
  /**
   * Named pattern configuration used to initialize the simulation. See
   * {@link ReactionDiffusionOptions}.
   */
  readonly preset?: "spots" | "stripes";
}
/**
 * Paint, stir, pause, or reset commands accepted by a reaction-diffusion texture.
 *
 * @see {@link reactionDiffusion}
 */
export type InkMessage =
  | {
      /** The literal "paint" identifying this variant. See {@link InkMessage}. */
      readonly type: "paint";
      /** Normalized horizontal texture coordinate. See {@link InkMessage}. */
      readonly u: number;
      /** Normalized vertical texture coordinate. See {@link InkMessage}. */
      readonly v: number;
      /** Radius in the coordinate system of this geometry or effect. See {@link InkMessage}. */
      readonly radius?: number;
      /** Magnitude of the displacement or brush effect. See {@link InkMessage}. */
      readonly strength?: number;
    }
  | {
      /** The literal "stir" identifying this variant. See {@link InkMessage}. */
      readonly type: "stir";
      /** Normalized horizontal texture coordinate. See {@link InkMessage}. */
      readonly u: number;
      /** Normalized vertical texture coordinate. See {@link InkMessage}. */
      readonly v: number;
      /** Normalized displacement of the existing field, not a paint dose. */
      readonly du: number;
      /** Normalized vertical displacement of the texture field. See {@link InkMessage}. */
      readonly dv: number;
      /** Influence radius in texture cells. */
      readonly radius?: number;
    }
  | {
      /** The literal "pause" identifying this variant. See {@link InkMessage}. */
      readonly type: "pause";
      /** Whether simulation or playback advancement is suspended. See {@link InkMessage}. */
      readonly paused: boolean;
    }
  | {
      /** The literal "reset" identifying this variant. See {@link InkMessage}. */
      readonly type: "reset";
    };
function colorize(field: Float32Array, context: TextureContext, gain = 1) {
  const ctx = context.canvas.getContext("2d")!;
  const lut = paletteLut(context.palette ?? texturePalettes.porcelain);
  const raster = rasterizeField(field, lut, gain);
  if (!raster) throw new Error("Texture field has no WASM owner.");
  ctx.putImageData(raster.image, 0, 0);
}
function materialConfig(config: MaterialOptions) {
  const seed = validateSeed(config.seed),
    scale = config.scale ?? 6,
    detail = config.detail ?? 0.65;
  if (
    !Number.isFinite(scale) ||
    scale < 1 ||
    scale > 32 ||
    !Number.isFinite(detail) ||
    detail < 0 ||
    detail > 1
  )
    throw new RangeError("Material scale must be 1..32 and detail 0..1.");
  return { seed, scale, detail };
}
function material(generate: MaterialGenerator) {
  const recipe = defineTexture<
    MaterialOptions,
    { config: ReturnType<typeof materialConfig>; field: Float32Array }
  >({
    create(context, input) {
      const config = materialConfig(input);
      return {
        config,
        field: generate(
          context.canvas.width,
          context.canvas.height,
          config.seed,
          config.scale,
          config.detail,
        ),
      };
    },
    update(state, input, context) {
      const config = materialConfig(input);
      if (JSON.stringify(config) === JSON.stringify(state.config)) return;
      state.field = generate(
        context.canvas.width,
        context.canvas.height,
        config.seed,
        config.scale,
        config.detail,
        state.field,
      );
      state.config = config;
      context.invalidate();
    },
    rasterize(state, context) {
      colorize(state.field, context);
    },
    dispose(state) {
      releaseField(state.field);
      state.field = new Float32Array(0);
    },
  });
  return (options: MaterialOptions = {}) => recipe(options);
}
/**
 * Creates a seeded marble texture recipe with configurable feature scale and distortion.
 *
 * @param options - Seed, feature scale, and detail settings. See {@link MaterialOptions}.
 * @returns A procedural material recipe for useTexture. See {@link TextureRecipe}.
 *
 * @see {@link MaterialOptions}
 * @see {@link TextureRecipe}
 */
export const marble = /* @__PURE__ */ material(marbleField);
/**
 * Creates a seeded paper texture recipe with configurable feature scale and grain.
 *
 * @param options - Seed, feature scale, and detail settings. See {@link MaterialOptions}.
 * @returns A procedural material recipe for useTexture. See {@link TextureRecipe}.
 *
 * @see {@link MaterialOptions}
 * @see {@link TextureRecipe}
 */
export const paper = /* @__PURE__ */ material(paperField);
/**
 * Creates a seeded cellular texture recipe with configurable feature scale and jitter.
 *
 * @param options - Seed, feature scale, and detail settings. See {@link MaterialOptions}.
 * @returns A procedural material recipe for useTexture. See {@link TextureRecipe}.
 *
 * @see {@link MaterialOptions}
 * @see {@link TextureRecipe}
 */
export const cellular = /* @__PURE__ */ material(cellularField);
function inkConfig(input: ReactionDiffusionOptions) {
  const seed = validateSeed(input.seed),
    preset = input.preset ?? "spots";
  if (preset !== "spots" && preset !== "stripes")
    throw new TypeError("Unknown ink preset.");
  return { seed, preset };
}
interface InkState {
  simulation: InkSimulation;
  config: ReturnType<typeof inkConfig>;
  paused: boolean;
  elapsed: number;
  fresh: boolean;
}
function reset(state: InkState, context: TextureContext) {
  const next = new InkSimulation(
    context.canvas.width,
    context.canvas.height,
    state.config.seed,
    state.config.preset,
  );
  state.simulation.dispose();
  state.simulation = next;
  state.elapsed = 0;
  state.fresh = true;
  context.invalidate();
}
const inkRecipe = /* @__PURE__ */ defineTexture<
  ReactionDiffusionOptions,
  InkState,
  InkMessage
>({
  defaultPlacement: { mode: "stretch" },
  create(context, input) {
    const config = inkConfig(input);
    context.requestFrame();
    return {
      simulation: new InkSimulation(
        context.canvas.width,
        context.canvas.height,
        config.seed,
        config.preset,
      ),
      config,
      paused: false,
      elapsed: 0,
      fresh: true,
    };
  },
  update(state, input, context) {
    const config = inkConfig(input);
    if (
      config.seed === state.config.seed &&
      config.preset === state.config.preset
    )
      return;
    state.config = config;
    reset(state, context);
  },
  receive(state, message, context) {
    if (message.type === "pause") {
      state.paused = message.paused;
      state.elapsed = 0;
      state.fresh = true;
      if (!state.paused) context.requestFrame();
    } else if (message.type === "reset") reset(state, context);
    else if (message.type === "stir") {
      const radius = message.radius ?? 16;
      if (
        ![message.u, message.v, message.du, message.dv, radius].every(
          Number.isFinite,
        ) ||
        radius <= 0 ||
        radius > 128 ||
        Math.abs(message.du) > 1 ||
        Math.abs(message.dv) > 1
      )
        throw new RangeError("Invalid ink stir message.");
      if (message.u < 0 || message.u > 1 || message.v < 0 || message.v > 1)
        return;
      state.simulation.stir(
        message.u * context.canvas.width,
        message.v * context.canvas.height,
        message.du * context.canvas.width,
        message.dv * context.canvas.height,
        radius,
      );
      context.invalidate();
    } else if (message.type === "paint") {
      const radius = message.radius ?? 6,
        strength = message.strength ?? 0.8;
      if (
        ![message.u, message.v, radius, strength].every(Number.isFinite) ||
        radius <= 0 ||
        radius > 128 ||
        strength < 0 ||
        strength > 1
      )
        throw new RangeError("Invalid ink paint message.");
      if (message.u < 0 || message.v < 0 || message.u > 1 || message.v > 1)
        return;
      state.simulation.paint(
        message.u * context.canvas.width,
        message.v * context.canvas.height,
        radius,
        strength,
      );
      context.invalidate();
    } else throw new TypeError("Unknown ink message.");
  },
  advance(state, frame, context) {
    if (state.paused) return;
    if (!state.fresh) {
      state.elapsed += Math.min(50, frame.delta);
      const steps = Math.min(24, Math.floor(state.elapsed * 0.48 + 1e-9));
      state.elapsed -= steps / 0.48;
      if (steps) {
        state.simulation.advance(steps);
        context.invalidate();
      }
    }
    state.fresh = false;
    context.requestFrame();
  },
  rasterize(state, context) {
    colorize(state.simulation.b, context, 650 / 255);
  },
  dispose(state) {
    state.simulation.dispose();
  },
});
/**
 * Creates a stateful reaction-diffusion texture recipe supporting paint, stirring, pause, and
 * reset
 * messages.
 *
 * @param options - Reaction and diffusion parameters, initialization, and rendering options. See
 * {@link ReactionDiffusionOptions} .
 * @returns A reaction-diffusion texture recipe for useTexture.
 *
 * @see {@link ReactionDiffusionOptions}
 */
export function reactionDiffusion(options: ReactionDiffusionOptions = {}) {
  return inkRecipe(options);
}

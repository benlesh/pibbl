import {
  defineTexture,
  type TextureContext,
  type TextureRecipe,
} from "@pibbl/core";
import type { InkMessage } from "./definitions.js";
import { paletteLut, texturePalettes, validateSeed } from "./palette.js";
import {
  ChemicalField,
  schnakenbergModel,
  barkleyModel,
  brusselatorModel,
  type ChemicalConfig,
} from "./chemical-field.js";

/** Shared simulation timing, diffusion and initialization controls. See {@link SchnakenbergOptions}. */
interface ChemicalOptions {
  /** Unsigned 32-bit initialization seed; default 42. See {@link schnakenberg}. */
  readonly seed?: number;
  /** Activator diffusion per grid cell, finite 0–32. See {@link schnakenberg}. */
  readonly diffusionU?: number;
  /** Inhibitor diffusion per grid cell, finite 0–32. See {@link schnakenberg}. */
  readonly diffusionV?: number;
  /** Initial seeded disturbance amplitude, finite 0–1; default 0.1. See {@link schnakenberg}. */
  readonly initialNoise?: number;
  /** Initialization steps, integer 0–12000; default 4096. See {@link schnakenberg}. */
  readonly warmupSteps?: number;
  /** Multiplier of 480 numerical steps/second, finite 0–4; default 1. Zero idles. See {@link schnakenberg}. */
  readonly speed?: number;
  /** Initially suspend stepping; default false. See {@link InkMessage}. */
  readonly paused?: boolean;
}
/** Schnakenberg production rates, diffusion and initialization. See {@link schnakenberg}. */
export interface SchnakenbergOptions extends ChemicalOptions {
  /** Activator source, finite 0.01–2; default 0.1. See {@link schnakenberg}. */
  readonly a?: number;
  /** Inhibitor source, finite 0.01–2; default 0.9. See {@link schnakenberg}. */
  readonly b?: number;
}
/** Excitability, recovery, diffusion and initialization. See {@link barkley}. */
export interface BarkleyOptions extends ChemicalOptions {
  /** Excitability scale, finite 0.3–1.2; default 0.75. See {@link barkley}. */
  readonly a?: number;
  /** Excitation threshold offset, finite 0–0.2; default 0.02. See {@link barkley}. */
  readonly b?: number;
  /** Fast/slow time separation, finite 0.005–0.1; default 0.02. See {@link barkley}. */
  readonly epsilon?: number;
}
/** Brusselator feed rates, diffusion and initialization. See {@link brusselator}. */
export interface BrusselatorOptions extends ChemicalOptions {
  /** Activator feed, finite 0.1–3; default 1. See {@link brusselator}. */
  readonly a?: number;
  /** Conversion rate, finite 0.1–5; default 1.8. See {@link brusselator}. */
  readonly b?: number;
}
/** Immutable Schnakenberg starting configurations. See {@link SchnakenbergOptions}. */
export const schnakenbergPresets = Object.freeze({
  /** Separated activator spots. See {@link schnakenberg}. */
  spots: Object.freeze({ a: 0.1, b: 0.9, diffusionU: 1, diffusionV: 20 }),
  /** Connected activator bands. See {@link schnakenberg}. */
  labyrinths: Object.freeze({
    a: 0.01,
    b: 1.7,
    diffusionU: 1,
    diffusionV: 20,
    warmupSteps: 10000,
  }),
});
/** Immutable Barkley starting configurations. See {@link BarkleyOptions}. */
export const barkleyPresets = Object.freeze({
  /** Broken excitation fronts form rotating spirals. See {@link barkley}. */
  spirals: Object.freeze({
    a: 0.75,
    b: 0.02,
    epsilon: 0.02,
    diffusionU: 1,
    diffusionV: 0,
  }),
  /** Broader propagating excitation fronts. See {@link barkley}. */
  waves: Object.freeze({
    a: 0.9,
    b: 0.01,
    epsilon: 0.04,
    diffusionU: 1,
    diffusionV: 0,
  }),
});
/** Immutable Brusselator starting configurations. See {@link BrusselatorOptions}. */
export const brusselatorPresets = Object.freeze({
  /** Differential diffusion supports stationary spots. See {@link brusselator}. */
  spots: Object.freeze({
    a: 1,
    b: 1.9,
    diffusionU: 0.2,
    diffusionV: 2,
    warmupSteps: 10000,
  }),
  /** Equal diffusion above the oscillation threshold. See {@link brusselator}. */
  oscillations: Object.freeze({ a: 1, b: 3, diffusionU: 0.3, diffusionV: 0.3 }),
});
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
      `${name} must be ${integer ? "an integer " : ""}within ${min}..${max}.`,
    );
  return value;
}
function common(
  options: ChemicalOptions,
): Omit<ChemicalConfig, "a" | "b" | "epsilon" | "diffusionU" | "diffusionV"> {
  if (options.paused !== undefined && typeof options.paused !== "boolean")
    throw new TypeError("Chemical paused must be boolean.");
  return {
    seed: validateSeed(options.seed),
    initialNoise: bounded(
      "Chemical initialNoise",
      options.initialNoise ?? 0.1,
      0,
      1,
    ),
    warmupSteps: bounded(
      "Chemical warmupSteps",
      options.warmupSteps ?? 4096,
      0,
      12000,
      true,
    ),
    speed: bounded("Chemical speed", options.speed ?? 1, 0, 4),
    paused: options.paused ?? false,
  };
}
function diffusion(
  options: ChemicalOptions,
  defaults: { diffusionU: number; diffusionV: number },
) {
  return {
    diffusionU: bounded(
      "Chemical diffusionU",
      options.diffusionU ?? defaults.diffusionU,
      0,
      32,
    ),
    diffusionV: bounded(
      "Chemical diffusionV",
      options.diffusionV ?? defaults.diffusionV,
      0,
      32,
    ),
  };
}
function schnakenbergConfig(options: SchnakenbergOptions): ChemicalConfig {
  return {
    ...common(options),
    ...diffusion(options, schnakenbergPresets.spots),
    a: bounded("Schnakenberg a", options.a ?? 0.1, 0.01, 2),
    b: bounded("Schnakenberg b", options.b ?? 0.9, 0.01, 2),
    epsilon: 0.02,
  };
}
function barkleyConfig(options: BarkleyOptions): ChemicalConfig {
  return {
    ...common(options),
    ...diffusion(options, barkleyPresets.spirals),
    a: bounded("Barkley a", options.a ?? 0.75, 0.3, 1.2),
    b: bounded("Barkley b", options.b ?? 0.02, 0, 0.2),
    epsilon: bounded("Barkley epsilon", options.epsilon ?? 0.02, 0.005, 0.1),
  };
}
function brusselatorConfig(options: BrusselatorOptions): ChemicalConfig {
  return {
    ...common(options),
    ...diffusion(options, brusselatorPresets.spots),
    a: bounded("Brusselator a", options.a ?? 1, 0.1, 3),
    b: bounded("Brusselator b", options.b ?? 1.8, 0.1, 5),
    epsilon: 0.02,
  };
}
interface State {
  config: ChemicalConfig;
  field: ChemicalField;
  paused: boolean;
  elapsed: number;
  fresh: boolean;
  image: ImageData | undefined;
  lut: Uint8ClampedArray | undefined;
  paletteKey: string;
}
function chemicalRecipe(model: typeof schnakenbergModel) {
  const makeField = (context: TextureContext, config: ChemicalConfig) => {
    if (context.canvas.width < 3 || context.canvas.height < 3)
      throw new RangeError(
        "Chemical textures require at least 3×3 raster samples.",
      );
    return new ChemicalField({
      width: context.canvas.width - 1,
      height: context.canvas.height - 1,
      config,
      model,
    });
  };
  const active = (state: State) => !state.paused && state.config.speed > 0;
  const reset = (state: State, context: TextureContext) => {
    const next = makeField(context, state.config);
    state.field.dispose();
    state.field = next;
    state.elapsed = 0;
    state.fresh = true;
    context.invalidate();
    if (active(state)) context.requestFrame();
  };
  return defineTexture<ChemicalConfig, State, InkMessage>({
    defaultPlacement: { mode: "repeat" },
    create(context, config) {
      const state: State = {
        config,
        field: makeField(context, config),
        paused: config.paused,
        elapsed: 0,
        fresh: true,
        image: new ImageData(context.canvas.width, context.canvas.height),
        lut: undefined,
        paletteKey: "",
      };
      if (active(state)) context.requestFrame();
      return state;
    },
    update(state, config, context) {
      if (JSON.stringify(config) === JSON.stringify(state.config)) return;
      const { speed: _speed, paused: _paused, ...previous } = state.config;
      const { speed, paused, ...next } = config;
      const changed = JSON.stringify(previous) !== JSON.stringify(next);
      if (paused !== state.config.paused) state.paused = paused;
      state.config = config;
      state.elapsed = 0;
      state.fresh = true;
      if (changed) reset(state, context);
      if (!state.paused && speed > 0) context.requestFrame();
    },
    receive(state, message, context) {
      if (message.type === "pause") {
        if (typeof message.paused !== "boolean")
          throw new TypeError("Chemical pause requires a boolean.");
        state.paused = message.paused;
        state.elapsed = 0;
        state.fresh = true;
        if (active(state)) context.requestFrame();
      } else if (message.type === "reset") reset(state, context);
      else if (message.type === "paint" || message.type === "stir") {
        const radius = bounded(
          "Chemical brush radius",
          message.radius ?? (message.type === "paint" ? 6 : 16),
          0.01,
          128,
        );
        if (!Number.isFinite(message.u) || !Number.isFinite(message.v))
          throw new RangeError("Chemical brush coordinates must be finite.");
        if (message.type === "paint") {
          const strength = bounded(
            "Chemical brush strength",
            message.strength ?? 0.8,
            0,
            1,
          );
          if (message.u < 0 || message.u > 1 || message.v < 0 || message.v > 1)
            return;
          if (strength === 0) return;
          state.field.paint({ ...message, radius, strength });
        } else {
          const du = bounded("Chemical stir du", message.du, -1, 1),
            dv = bounded("Chemical stir dv", message.dv, -1, 1);
          if (message.u < 0 || message.u > 1 || message.v < 0 || message.v > 1)
            return;
          state.field.stir({ ...message, radius, du, dv });
        }
        context.invalidate();
      } else throw new TypeError("Unknown chemical texture message.");
    },
    advance(state, frame, context) {
      if (!active(state)) return;
      if (!state.fresh) {
        state.elapsed += Math.min(50, frame.delta) * state.config.speed * 0.48;
        const count = Math.min(96, Math.floor(state.elapsed));
        state.elapsed -= count;
        if (count > 0) {
          state.field.advance(count);
          context.invalidate();
        }
      }
      state.fresh = false;
      context.requestFrame();
    },
    rasterize(state, context) {
      const key = (context.palette ?? texturePalettes.lagoon).join();
      if (key !== state.paletteKey) {
        state.lut = paletteLut(context.palette ?? texturePalettes.lagoon);
        state.paletteKey = key;
      }
      const { width, height } = context.canvas,
        data = state.image!.data,
        lut = state.lut!;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const index =
            (y % state.field.height) * state.field.width +
            (x % state.field.width);
          const color =
              Math.round(
                Math.max(0, Math.min(1, state.field.intensity(index))) * 255,
              ) * 4,
            i = (y * width + x) * 4;
          data[i] = lut[color]!;
          data[i + 1] = lut[color + 1]!;
          data[i + 2] = lut[color + 2]!;
          data[i + 3] = 255;
        }
      context.canvas.getContext("2d")!.putImageData(state.image!, 0, 0);
    },
    dispose(state) {
      state.field.dispose();
      state.image = undefined;
      state.lut = undefined;
    },
  });
}
const schnakenbergRecipe = /* @__PURE__ */ chemicalRecipe(schnakenbergModel);
const barkleyRecipe = /* @__PURE__ */ chemicalRecipe(barkleyModel);
const brusselatorRecipe = /* @__PURE__ */ chemicalRecipe(brusselatorModel);
/**
 * Creates a periodic Schnakenberg activator/inhibitor texture with paint, stir, pause and reset.
 * @param options - Reaction rates, diffusion and initialization. See {@link SchnakenbergOptions}.
 * @returns A mountable simulation recipe. See {@link TextureRecipe}, {@link InkMessage}.
 * @see {@link schnakenbergPresets}
 */
export function schnakenberg(
  options: SchnakenbergOptions = {},
): TextureRecipe<InkMessage> {
  return schnakenbergRecipe(schnakenbergConfig(options));
}
/**
 * Creates a periodic Barkley excitable texture initialized with a broken excitation front.
 * @param options - Excitability, recovery, diffusion and initialization. See {@link BarkleyOptions}.
 * @returns A mountable simulation recipe. See {@link TextureRecipe}, {@link InkMessage}.
 * @see {@link barkleyPresets}
 */
export function barkley(
  options: BarkleyOptions = {},
): TextureRecipe<InkMessage> {
  return barkleyRecipe(barkleyConfig(options));
}
/**
 * Creates a periodic Brusselator texture with paint, stir, pause and reset.
 * @param options - Feed rates, diffusion and initialization. See {@link BrusselatorOptions}.
 * @returns A mountable simulation recipe. See {@link TextureRecipe}, {@link InkMessage}.
 * @see {@link brusselatorPresets}
 */
export function brusselator(
  options: BrusselatorOptions = {},
): TextureRecipe<InkMessage> {
  return brusselatorRecipe(brusselatorConfig(options));
}

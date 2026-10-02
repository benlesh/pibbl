import { rasterizeField } from "./wasm/memory.js";
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
export interface MaterialOptions {
  readonly seed?: number;
  readonly scale?: number;
  readonly detail?: number;
}
export interface ReactionDiffusionOptions {
  readonly seed?: number;
  readonly preset?: "spots" | "stripes";
}
export type InkMessage =
  | {
      readonly type: "paint";
      readonly u: number;
      readonly v: number;
      readonly radius?: number;
      readonly strength?: number;
    }
  | { readonly type: "pause"; readonly paused: boolean }
  | { readonly type: "reset" };
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
      );
      state.config = config;
      context.invalidate();
    },
    rasterize(state, context) {
      colorize(state.field, context);
    },
    dispose(state) {
      state.field = new Float32Array(0);
    },
  });
  return (options: MaterialOptions = {}) => recipe(options);
}
export const marble = /* @__PURE__ */ material(marbleField);
export const paper = /* @__PURE__ */ material(paperField);
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
const inkRecipe = /* @__PURE__ */ defineTexture<ReactionDiffusionOptions, InkState, InkMessage>(
  {
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
      else if (message.type === "paint") {
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
  },
);
export function reactionDiffusion(options: ReactionDiffusionOptions = {}) {
  return inkRecipe(options);
}

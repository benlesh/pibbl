import { defineTexture, type TextureContext, type TextureRecipe } from "@crc/core";
import { validateSeed } from "./palette.js";

export interface WaterWavesOptions {
  readonly seed?: number;
  readonly speed?: number;
  readonly scale?: number;
  readonly paused?: boolean;
}

export type WaterWavesMessage =
  | { readonly type: "pause"; readonly paused: boolean }
  | { readonly type: "reset" };

interface Config { seed: number; speed: number; scale: number; paused: boolean }
interface State { config: Config; phase: number; paused: boolean; fresh: boolean }

function config(input: WaterWavesOptions): Config {
  const seed = validateSeed(input.seed ?? 0);
  const speed = input.speed ?? 1;
  const scale = input.scale ?? 4;
  if (!Number.isFinite(speed) || speed < 0) throw new RangeError("Water wave speed must be finite and nonnegative.");
  if (!Number.isInteger(scale) || scale < 1 || scale > 32) throw new RangeError("Water wave scale must be an integer from 1 to 32.");
  return { seed, speed, scale, paused: input.paused ?? false };
}

function assertDataTexture(context: TextureContext): void {
  if (context.palette !== undefined) throw new TypeError("waterWaves is a numeric displacement map and does not accept a palette.");
}
function mode(seed: number, index: number): readonly [number, number, number] {
  let x = (seed + Math.imul(index + 1, 0x9e3779b9)) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b) >>> 0; x ^= x >>> 13;
  const angle = (x / 0x1_0000_0000) * Math.PI * 2;
  return [Math.cos(angle), Math.sin(angle), ((x >>> 24) / 255) * Math.PI * 2];
}
function encode(value: number): number { return Math.max(0, Math.min(255, Math.round(128 + value * 90))); }

const recipe = defineTexture<WaterWavesOptions, State, WaterWavesMessage>({
  create(context, input) {
    assertDataTexture(context);
    const next = config(input);
    if (!next.paused && next.speed > 0) context.requestFrame();
    return { config: next, phase: 0, paused: next.paused, fresh: true };
  },
  update(state, input, context) {
    assertDataTexture(context);
    const next = config(input);
    const previous = state.config;
    if (next.seed !== previous.seed || next.scale !== previous.scale) { state.phase = 0; context.invalidate(); }
    if (next.paused !== previous.paused) state.paused = next.paused;
    state.config = next;
    if (!state.paused && next.speed > 0) context.requestFrame();
  },
  receive(state, message, context) {
    if (message.type === "pause") { state.paused = message.paused; state.fresh = true; if (!state.paused && state.config.speed > 0) context.requestFrame(); return; }
    if (message.type === "reset") { state.phase = 0; state.fresh = true; context.invalidate(); return; }
    throw new TypeError("Unknown water wave message.");
  },
  advance(state, frame, context) {
    if (state.paused || state.config.speed === 0) return;
    if (!state.fresh) { state.phase += (frame.delta / 1000) * state.config.speed; context.invalidate(); }
    state.fresh = false;
    context.requestFrame();
  },
  rasterize(state, context) {
    const ctx = context.canvas.getContext("2d")!;
    const image = ctx.createImageData(context.canvas.width, context.canvas.height);
    for (let y = 0; y < context.canvas.height; y++) for (let x = 0; x < context.canvas.width; x++) {
      const u = x / context.canvas.width, v = y / context.canvas.height;
      let dx = 0, dy = 0;
      for (let i = 0; i < 4; i++) {
        const [mx, my, offset] = mode(state.config.seed, i);
        const phase = Math.PI * 2 * state.config.scale * (mx * u + my * v) + state.phase * (i + 1) + offset;
        dx += Math.cos(phase) * my * 0.25;
        dy += Math.sin(phase) * -mx * 0.25;
      }
      const index = (y * context.canvas.width + x) * 4;
      image.data[index] = encode(dx); image.data[index + 1] = encode(dy); image.data[index + 2] = 128; image.data[index + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  },
});

export function waterWaves(options: WaterWavesOptions = {}): TextureRecipe<WaterWavesMessage> { return recipe(options); }

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
interface Mode { x: number; y: number; phase: number }
interface State { config: Config; modes: readonly Mode[]; phase: number; paused: boolean; fresh: boolean }

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
function mode(seed: number, scale: number, index: number): Mode {
  let x = (seed + Math.imul(index + 1, 0x9e3779b9)) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b) >>> 0; x ^= x >>> 13;
  const y = Math.imul(x ^ (x >>> 15), 0x27d4eb2d) >>> 0;
  const horizontal = ((x % scale) + 1) * ((x & 1) ? -1 : 1);
  const vertical = ((y % scale) + 1) * ((y & 1) ? -1 : 1);
  return { x: horizontal, y: vertical, phase: ((x >>> 24) / 255) * Math.PI * 2 };
}
function modes(value: Config): readonly Mode[] { return Object.freeze([0, 1, 2, 3].map(index => mode(value.seed, value.scale, index))); }
function encode(value: number): number { return Math.max(0, Math.min(255, Math.round(128 + value * 90))); }

const recipe = defineTexture<WaterWavesOptions, State, WaterWavesMessage>({
  create(context, input) {
    assertDataTexture(context);
    const next = config(input);
    if (!next.paused && next.speed > 0) context.requestFrame();
    return { config: next, modes: modes(next), phase: 0, paused: next.paused, fresh: true };
  },
  update(state, input, context) {
    assertDataTexture(context);
    const next = config(input);
    const previous = state.config;
    if (next.seed !== previous.seed || next.scale !== previous.scale) { state.phase = 0; state.modes = modes(next); context.invalidate(); }
    if (next.paused !== previous.paused || next.speed !== previous.speed) { state.paused = next.paused; state.fresh = true; }
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
      const u = context.canvas.width <= 1 ? 0 : x / (context.canvas.width - 1);
      const v = context.canvas.height <= 1 ? 0 : y / (context.canvas.height - 1);
      let dx = 0, dy = 0;
      for (const wave of state.modes) {
        const phase = Math.PI * 2 * (wave.x * u + wave.y * v) + state.phase + wave.phase;
        dx += Math.cos(phase) * Math.sign(wave.y) * 0.25;
        dy += Math.sin(phase) * -Math.sign(wave.x) * 0.25;
      }
      const index = (y * context.canvas.width + x) * 4;
      image.data[index] = encode(dx); image.data[index + 1] = encode(dy); image.data[index + 2] = 128; image.data[index + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  },
});

export function waterWaves(options: WaterWavesOptions = {}): TextureRecipe<WaterWavesMessage> { return recipe(options); }

import { defineTexture, type TextureContext, type TextureRecipe } from "@crc/core";
import { validateSeed } from "./palette.js";

export interface WaterWavesOptions {
  readonly seed?: number;
  readonly speed?: number;
  readonly scale?: number;
  readonly paused?: boolean;
  readonly rippleStrength?: number;
}

export type WaterWavesMessage =
  | { readonly type: "pause"; readonly paused: boolean }
  | { readonly type: "reset" }
  | { readonly type: "ripple"; readonly x: number; readonly y: number };

interface Config { seed: number; speed: number; scale: number; paused: boolean; rippleStrength: number }
interface Mode { x: number; y: number; phase: number }
interface Ripple { x: number; y: number; age: number }
interface State { config: Config; modes: readonly Mode[]; phase: number; paused: boolean; fresh: boolean; ripples: Ripple[] }

const RIPPLE_LIFETIME = 2.4;
const MAX_RIPPLES = 16;

function config(input: WaterWavesOptions): Config {
  const seed = validateSeed(input.seed ?? 0);
  const speed = input.speed ?? 1;
  const scale = input.scale ?? 4;
  const rippleStrength = input.rippleStrength ?? 1;
  if (!Number.isFinite(rippleStrength) || rippleStrength < 0) throw new RangeError("Water ripple strength must be finite and nonnegative.");
  if (!Number.isFinite(speed) || speed < 0) throw new RangeError("Water wave speed must be finite and nonnegative.");
  if (!Number.isInteger(scale) || scale < 1 || scale > 32) throw new RangeError("Water wave scale must be an integer from 1 to 32.");
  return { seed, speed, scale, paused: input.paused ?? false, rippleStrength };
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
function isAnimating(state: State): boolean { return state.config.speed > 0 || state.ripples.length > 0; }
function assertRippleCoordinate(value: number, name: "x" | "y"): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError(`Water ripple ${name} must be finite and within [0, 1].`);
}

const recipe = defineTexture<WaterWavesOptions, State, WaterWavesMessage>({
  create(context, input) {
    assertDataTexture(context);
    const next = config(input);
    if (!next.paused && next.speed > 0) context.requestFrame();
    return { config: next, modes: modes(next), phase: 0, paused: next.paused, fresh: true, ripples: [] };
  },
  update(state, input, context) {
    assertDataTexture(context);
    const next = config(input);
    const previous = state.config;
    if (next.rippleStrength !== previous.rippleStrength) context.invalidate();
    if (next.seed !== previous.seed || next.scale !== previous.scale) { state.phase = 0; state.modes = modes(next); context.invalidate(); }
    if (next.paused !== previous.paused) state.paused = next.paused;
    if (next.paused !== previous.paused || next.speed !== previous.speed) state.fresh = true;
    state.config = next;
    if (!state.paused && isAnimating(state)) context.requestFrame();
  },
  receive(state, message, context) {
    if (message.type === "pause") { state.paused = message.paused; state.fresh = true; if (!state.paused && isAnimating(state)) context.requestFrame(); return; }
    if (message.type === "reset") { state.phase = 0; state.ripples = []; state.fresh = true; context.invalidate(); return; }
    if (message.type === "ripple") {
      assertRippleCoordinate(message.x, "x"); assertRippleCoordinate(message.y, "y");
      if (!isAnimating(state)) state.fresh = true;
      state.ripples.push({ x: message.x, y: message.y, age: 0 });
      if (state.ripples.length > MAX_RIPPLES) state.ripples.splice(0, state.ripples.length - MAX_RIPPLES);
      context.invalidate();
      if (!state.paused) context.requestFrame();
      return;
    }
    throw new TypeError("Unknown water wave message.");
  },
  advance(state, frame, context) {
    if (state.paused || !isAnimating(state)) return;
    if (!state.fresh) {
      const elapsed = frame.delta / 1000;
      state.phase += elapsed * state.config.speed;
      state.ripples = state.ripples.filter(ripple => (ripple.age += elapsed) < RIPPLE_LIFETIME);
      context.invalidate();
    }
    state.fresh = false;
    if (isAnimating(state)) context.requestFrame();
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
      const minimumDimension = Math.min(context.canvas.width, context.canvas.height);
      for (const ripple of state.ripples) {
        const horizontal = (u - ripple.x) * context.canvas.width / minimumDimension;
        const vertical = (v - ripple.y) * context.canvas.height / minimumDimension;
        const distance = Math.hypot(horizontal, vertical);
        const progress = ripple.age / RIPPLE_LIFETIME;
        const radius = progress * 1.75;
        const ring = Math.exp(-((distance - radius) ** 2) / 0.018) * (1 - progress) * state.config.rippleStrength;
        const direction = distance === 0 ? 0 : 1 / distance;
        dx += horizontal * direction * ring * 0.9;
        dy += vertical * direction * ring * 0.9;
      }
      const index = (y * context.canvas.width + x) * 4;
      image.data[index] = encode(dx); image.data[index + 1] = encode(dy); image.data[index + 2] = 128; image.data[index + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  },
});

export function waterWaves(options: WaterWavesOptions = {}): TextureRecipe<WaterWavesMessage> { return recipe(options); }

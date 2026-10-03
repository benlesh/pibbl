import { defineTexture, type TextureContext, type TextureRecipe } from "@crc/core";
import { validateSeed } from "./palette.js";

export interface RainDropsOptions {
  readonly seed?: number;
  /** New beads per second, from 0 through 120. */
  readonly rainRate?: number;
  /** Downward acceleration multiplier, from 0 through 10. */
  readonly gravity?: number;
  readonly initialDrops?: number;
  readonly paused?: boolean;
  /** Fine droplet film coverage, from 0 (clear) through 1 (mist). */
  readonly condensation?: number;
  /** Seconds controlling trail drying and condensation recovery, from 0 through 60. */
  readonly trailPersistence?: number;
  /** Residual water left behind a moving drop, from 0 through 1. */
  readonly trailStrength?: number;
  /** Outline and path variation, from 0 (smooth) through 1. */
  readonly irregularity?: number;
}

export type RainDropsMessage =
  | { readonly type: "pause"; readonly paused: boolean }
  | { readonly type: "reset" }
  /** Begin or move one finger contact; successive positions wipe a continuous path. */
  | { readonly type: "finger"; readonly x: number; readonly y: number; readonly radius?: number }
  | { readonly type: "release" }
  /** Center and movement use normalized width/height; radius uses the shorter side. */
  | { readonly type: "nudge"; readonly x: number; readonly y: number; readonly dx: number; readonly dy: number; readonly radius?: number };

interface Drop { x: number; y: number; radius: number; vx: number; vy: number; phase: number }
interface Config { seed: number; rainRate: number; gravity: number; initialDrops: number; paused: boolean; condensation: number; trailPersistence: number; trailStrength: number; irregularity: number }
interface State {
  finger?: { x: number; y: number; radius: number; drop?: Drop };
  config: Config;
  drops: Drop[];
  random: number;
  births: number;
  paused: boolean;
  fresh: boolean;
  image: ImageData;
  film: Float32Array;
  trails: Float32Array;
  surface: Float32Array;
  grain: Float32Array;
  fieldActive: boolean;
}
const MAX_DROPS = 256;

function bounded(value: number, name: string, maximum: number): number {
  if (!Number.isFinite(value) || value < 0 || value > maximum) throw new RangeError(`Rain ${name} must be finite and within [0, ${maximum}].`);
  return value;
}
function options(input: RainDropsOptions): Config {
  const initialDrops = bounded(input.initialDrops ?? 100, "initialDrops", MAX_DROPS);
  if (!Number.isInteger(initialDrops)) throw new RangeError("Rain initialDrops must be an integer.");
  return { seed: validateSeed(input.seed ?? 7), rainRate: bounded(input.rainRate ?? 24, "rainRate", 120), gravity: bounded(input.gravity ?? 1, "gravity", 10), initialDrops, paused: input.paused ?? false,
    condensation: bounded(input.condensation ?? 0, "condensation", 1),
    trailPersistence: bounded(input.trailPersistence ?? 8, "trailPersistence", 60),
    trailStrength: bounded(input.trailStrength ?? 0.65, "trailStrength", 1),
    irregularity: bounded(input.irregularity ?? 0.8, "irregularity", 1) };
}
function assertMap(context: TextureContext): void {
  if (context.palette !== undefined) throw new TypeError("rainDrops is a numeric displacement map and does not accept a palette.");
}
function random(state: State): number {
  state.random = (Math.imul(state.random, 1664525) + 1013904223) >>> 0;
  return state.random / 4294967296;
}
function spawn(state: State, context: TextureContext): void {
  if (state.drops.length >= MAX_DROPS) return;
  const side = Math.min(context.canvas.width, context.canvas.height);
  state.drops.push({ x: random(state) * context.canvas.width / side, y: random(state) * context.canvas.height / side, radius: 0.005 + random(state) ** 2 * 0.015, vx: 0, vy: 0, phase: random(state) * Math.PI * 2 });
}
function reset(state: State, context: TextureContext): void {
  state.finger = undefined;
  state.random = state.config.seed; state.drops = []; state.births = 0; state.fresh = true;
  state.film.fill(1); state.trails.fill(0); state.fieldActive = false;
  for (let i = 0; i < state.grain.length; i++) {
    let value = Math.imul(i + 1, 0x45d9f3b) ^ state.config.seed;
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    state.grain[i] = ((value ^ (value >>> 16)) >>> 0) / 4294967296;
  }
  for (let i = 0; i < state.config.initialDrops; i++) spawn(state, context);
}
/** Coalescence conserves volume and volume-weighted position/momentum. */
function merge(drops: Drop[]): void {
  for (let i = 0; i < drops.length; i++) {
    const a = drops[i];
    for (let j = i + 1; j < drops.length; j++) {
      const b = drops[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) >= a.radius + b.radius) continue;
      const av = a.radius ** 3, bv = b.radius ** 3, volume = av + bv;
      a.x = (a.x * av + b.x * bv) / volume; a.y = (a.y * av + b.y * bv) / volume;
      a.vx = (a.vx * av + b.vx * bv) / volume; a.vy = (a.vy * av + b.vy * bv) / volume;
      a.radius = Math.cbrt(volume);
      drops.splice(j--, 1);
    }
  }
}
function active(state: State): boolean {
  return state.fieldActive || state.config.rainRate > 0 || state.drops.some(d => (state.config.gravity > 0 && d.radius > 0.012) || Math.abs(d.vx) + Math.abs(d.vy) > 0.0001);
}
function schedule(state: State, context: TextureContext): void {
  if (!state.paused && active(state)) context.requestFrame();
}

/** Sweep the actual drop footprint, collecting film and leaving a beaded residual trail. */
function sweep(state: State, drop: Drop, oldX: number, oldY: number, context: TextureContext): void {
  const { width, height } = context.canvas, side = Math.min(width, height);
  const ax = oldX * side, ay = oldY * side, bx = drop.x * side, by = drop.y * side;
  const dx = bx - ax, dy = by - ay, length2 = dx * dx + dy * dy;
  if (length2 < 0.000001) return;
  const radius = Math.max(1, drop.radius * side * 1.1);
  let collected = 0;
  for (let y = Math.max(0, Math.floor(Math.min(ay, by) - radius)); y < Math.min(height, Math.ceil(Math.max(ay, by) + radius)); y++) {
    for (let x = Math.max(0, Math.floor(Math.min(ax, bx) - radius)); x < Math.min(width, Math.ceil(Math.max(ax, bx) + radius)); x++) {
      const t = Math.max(0, Math.min(1, ((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / length2));
      const distance = Math.hypot(x + 0.5 - ax - t * dx, y + 0.5 - ay - t * dy) / radius;
      if (distance >= 1) continue;
      const i = y * width + x;
      const remaining = Math.max(0, Math.min(1, (distance - 0.7) / 0.3));
      const removed = Math.max(0, state.film[i] - remaining);
      collected += removed;
      state.film[i] = Math.min(state.film[i], remaining);
      // Spatially stable necks and beads avoid frame-rate-dependent trail stamping.
      const neck = 0.18 + 0.12 * Math.sin(y * 0.7 + drop.phase);
      const bead = Math.pow(state.grain[i], 7);
      const residual = Math.max(0, 1 - distance / (neck + bead * 0.6));
      state.trails[i] = Math.max(state.trails[i], residual * (0.00045 + bead * 0.0018) * state.config.trailStrength);
    }
  }
  // Film volume is swept area times a small effective thickness.
  drop.radius = Math.cbrt(drop.radius ** 3 + collected / (side * side) * state.config.condensation * 0.0002);
  state.fieldActive = true;
}

/** At capacity, coalesce the closest free beads before releasing newly gathered water. */
function makeReleaseRoom(drops: Drop[]): void {
  if (drops.length < MAX_DROPS) return;
  let first = 0, second = 1, nearest = Infinity;
  for (let i = 0; i < drops.length; i++) for (let j = i + 1; j < drops.length; j++) {
    const distance = Math.hypot(drops[i].x - drops[j].x, drops[i].y - drops[j].y);
    if (distance < nearest) { nearest = distance; first = i; second = j; }
  }
  const a = drops[first], b = drops[second], av = a.radius ** 3, bv = b.radius ** 3, volume = av + bv;
  a.x = (a.x * av + b.x * bv) / volume; a.y = (a.y * av + b.y * bv) / volume;
  a.vx = (a.vx * av + b.vx * bv) / volume; a.vy = (a.vy * av + b.vy * bv) / volume;
  a.radius = Math.cbrt(volume); drops.splice(second, 1);
}

/** A finger removes film and residual water, and carries intersected beads without inertia. */
function wipeFinger(state: State, oldX: number, oldY: number, context: TextureContext): void {
  const finger = state.finger;
  if (!finger) return;
  const { width, height } = context.canvas, side = Math.min(width, height);
  const dx = finger.x - oldX, dy = finger.y - oldY, length2 = dx * dx + dy * dy;
  const distance = (x: number, y: number): number => {
    const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - oldX) * dx + (y - oldY) * dy) / length2));
    return Math.hypot(x - oldX - t * dx, y - oldY - t * dy);
  };
  let volume = finger.drop ? finger.drop.radius ** 3 : 0;
  for (let i = state.drops.length - 1; i >= 0; i--) {
    const drop = state.drops[i];
    if (distance(drop.x, drop.y) > finger.radius + drop.radius * 1.3) continue;
    volume += drop.radius ** 3;
    state.drops.splice(i, 1);
  }
  for (let y = Math.max(0, Math.floor((Math.min(oldY, finger.y) - finger.radius) * side)); y < Math.min(height, Math.ceil((Math.max(oldY, finger.y) + finger.radius) * side)); y++) {
    for (let x = Math.max(0, Math.floor((Math.min(oldX, finger.x) - finger.radius) * side)); x < Math.min(width, Math.ceil((Math.max(oldX, finger.x) + finger.radius) * side)); x++) {
      const coverage = Math.max(0, Math.min(1, (1 - distance((x + 0.5) / side, (y + 0.5) / side) / finger.radius) / 0.15));
      if (coverage === 0) continue;
      const i = y * width + x, remaining = 1 - coverage;
      const removedFilm = Math.max(0, state.film[i] - remaining);
      const removedTrail = state.trails[i] * coverage;
      volume += (removedFilm * state.config.condensation * 0.0002 + removedTrail) / (side * side);
      state.film[i] = Math.min(state.film[i], remaining);
      state.trails[i] -= removedTrail;
    }
  }
  if (volume > 0) {
    finger.drop ??= { x: finger.x, y: finger.y, radius: 0, vx: 0, vy: 0, phase: 0 };
    finger.drop.x = finger.x; finger.drop.y = finger.y; finger.drop.radius = Math.cbrt(volume);
  }
  state.fieldActive = true;
}

function recoverFilm(state: State, elapsed: number): void {
  if (!state.fieldActive) return;
  const retention = state.config.trailPersistence === 0 ? 0 : Math.exp(-elapsed / state.config.trailPersistence);
  let active = false;
  for (let i = 0; i < state.film.length; i++) {
    const missing = (1 - state.film[i]) * retention;
    state.film[i] = missing < 0.002 ? 1 : 1 - missing;
    const trail = state.trails[i] * retention;
    state.trails[i] = trail < 0.000005 ? 0 : trail;
    active ||= state.film[i] < 1 || state.trails[i] > 0;
  }
  state.fieldActive = active;
}

const recipe = defineTexture<RainDropsOptions, State, RainDropsMessage>({
  create(context, input) {
    assertMap(context);
    const config = options(input);
    const cells = context.canvas.width * context.canvas.height;
    const state: State = { film: new Float32Array(cells), trails: new Float32Array(cells), surface: new Float32Array(cells), grain: new Float32Array(cells), fieldActive: false, config, drops: [], random: config.seed, births: 0, paused: config.paused, fresh: true, image: context.canvas.getContext("2d")!.createImageData(context.canvas.width, context.canvas.height) };
    reset(state, context); schedule(state, context); return state;
  },
  update(state, input, context) {
    assertMap(context);
    const next = options(input), previous = state.config;
    state.config = next;
    if (next.condensation !== previous.condensation || next.irregularity !== previous.irregularity || next.trailStrength !== previous.trailStrength) context.invalidate();
    if (next.paused !== previous.paused) { state.paused = next.paused; state.fresh = true; }
    if (next.rainRate !== previous.rainRate || next.gravity !== previous.gravity) state.fresh = true;
    if (next.seed !== previous.seed || next.initialDrops !== previous.initialDrops) { reset(state, context); context.invalidate(); }
    schedule(state, context);
  },
  receive(state, message, context) {
    if (message.type === "pause") { state.paused = message.paused; state.fresh = true; }
    else if (message.type === "reset") { reset(state, context); context.invalidate(); }
    else if (message.type === "finger") {
      const x = bounded(message.x, "finger x", 1), y = bounded(message.y, "finger y", 1);
      const radius = bounded(message.radius ?? 0.045, "finger radius", 2);
      if (radius === 0) throw new RangeError("Rain finger radius must be positive.");
      const side = Math.min(context.canvas.width, context.canvas.height);
      const nextX = x * context.canvas.width / side, nextY = y * context.canvas.height / side;
      const oldX = state.finger?.x ?? nextX, oldY = state.finger?.y ?? nextY;
      state.finger ??= { x: nextX, y: nextY, radius };
      state.finger.x = nextX; state.finger.y = nextY; state.finger.radius = radius;
      wipeFinger(state, oldX, oldY, context); context.invalidate();
    }
    else if (message.type === "release") {
      if (state.finger?.drop) { makeReleaseRoom(state.drops); state.drops.push(state.finger.drop); }
      state.finger = undefined; context.invalidate();
    }
    else if (message.type === "nudge") {
      const x = bounded(message.x, "nudge x", 1), y = bounded(message.y, "nudge y", 1);
      const radius = bounded(message.radius ?? 0.12, "nudge radius", 2);
      if (radius === 0) throw new RangeError("Rain nudge radius must be positive.");
      for (const delta of [message.dx, message.dy]) if (!Number.isFinite(delta) || Math.abs(delta) > 1) throw new RangeError("Rain nudge movement must be finite and within [-1, 1].");
      if (message.dx === 0 && message.dy === 0) return;
      const side = Math.min(context.canvas.width, context.canvas.height);
      const width = context.canvas.width / side, height = context.canvas.height / side;
      for (const drop of state.drops) {
        const distance = Math.hypot(drop.x - x * width, drop.y - y * height);
        const weight = Math.max(0, 1 - distance / radius) ** 2;
        const oldX = drop.x, oldY = drop.y;
        drop.x = Math.max(0, Math.min(width, drop.x + message.dx * width * weight));
        drop.y = Math.max(0, Math.min(height, drop.y + message.dy * height * weight));
        sweep(state, drop, oldX, oldY, context);
        drop.vx += message.dx * width * weight * 3; drop.vy += message.dy * height * weight * 3;
      }
      merge(state.drops); context.invalidate();
    } else throw new TypeError("Unknown rain drop message.");
    schedule(state, context);
  },
  advance(state, frame, context) {
    if (state.paused) return;
    if (state.fresh) state.fresh = false;
    else {
      // Bounded substeps prevent tab suspension from creating a rainfall burst.
      const elapsed = Math.min(frame.delta / 1000, 0.05);
      recoverFilm(state, elapsed);
      const steps = Math.max(1, Math.ceil(elapsed * 120)), dt = elapsed / steps;
      const side = Math.min(context.canvas.width, context.canvas.height);
      for (let step = 0; step < steps; step++) {
        state.births += state.config.rainRate * dt;
        while (state.births >= 1) { spawn(state, context); state.births--; }
        for (const drop of state.drops) {
          const slide = Math.max(0, drop.radius / 0.012 - 1);
          const oldX = drop.x, oldY = drop.y;
          drop.vx += Math.sin(drop.y * 85 + drop.phase) * slide * state.config.gravity * state.config.irregularity * 0.09 * dt;
          drop.vy += state.config.gravity * slide * 0.3 * dt;
          drop.vx *= Math.exp(-7 * dt); drop.vy *= Math.exp(-3 * dt);
          if (Math.abs(drop.vx) < 0.00005) drop.vx = 0;
          if (Math.abs(drop.vy) < 0.00005) drop.vy = 0;
          drop.x += drop.vx * dt; drop.y += drop.vy * dt;
          sweep(state, drop, oldX, oldY, context);
        }
        merge(state.drops);
        state.drops = state.drops.filter(d => d.y - d.radius < context.canvas.height / side && d.y + d.radius > 0 && d.x + d.radius > 0 && d.x - d.radius < context.canvas.width / side);
      }
      if (state.finger) wipeFinger(state, state.finger.x, state.finger.y, context);
      context.invalidate();
    }
    schedule(state, context);
  },
  rasterize(state, context) {
    const { width, height } = context.canvas, side = Math.min(width, height);
    const data = state.image.data, surface = state.surface;
    for (let i = 0; i < surface.length; i++) {
      surface[i] = state.trails[i] + state.grain[i] * 0.00018 * state.config.condensation * state.film[i];
    }
    const visibleDrops = state.finger?.drop ? [...state.drops, state.finger.drop] : state.drops;
    for (const drop of visibleDrops) {
      const stretch = 1 + Math.min(1.3, Math.abs(drop.vy) * 3);
      const rx = drop.radius * side / Math.sqrt(stretch), ry = drop.radius * side * stretch;
      const cx = drop.x * side, cy = drop.y * side;
      const extent = 1.3;
      for (let y = Math.max(0, Math.floor(cy - ry * extent)); y < Math.min(height, Math.ceil(cy + ry * extent)); y++) {
        for (let x = Math.max(0, Math.floor(cx - rx * extent)); x < Math.min(width, Math.ceil(cx + rx * extent)); x++) {
          const ny = (y + 0.5 - cy) / ry;
          const nx = (x + 0.5 - cx) / rx - state.config.irregularity * 0.09 * Math.sin(ny * 3 + drop.phase);
          const angle = Math.atan2(ny, nx);
          const edge = 1 + state.config.irregularity * (0.12 * Math.sin(angle * 3 + drop.phase) + 0.07 * Math.sin(angle * 5 - drop.phase));
          const r2 = (nx * nx + ny * ny) / (edge * edge);
          if (r2 >= 1) continue;
          const i = y * width + x;
          surface[i] = Math.max(surface[i], drop.radius * Math.sqrt(1 - r2));
        }
      }
    }
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x, index = i * 4;
      const dx = (surface[y * width + Math.min(width - 1, x + 1)] - surface[y * width + Math.max(0, x - 1)]) * side * 0.5;
      const dy = (surface[Math.min(height - 1, y + 1) * width + x] - surface[Math.max(0, y - 1) * width + x]) * side * 0.5;
      data[index] = Math.round(128 + Math.max(-1, Math.min(1, dx)) * 110);
      data[index + 1] = Math.round(128 + Math.max(-1, Math.min(1, dy)) * 110);
      const droplet = Math.min(1, Math.max(0, (surface[i] - 0.001) * 1500));
      data[index + 2] = Math.round(255 * state.config.condensation * state.film[i] * (0.8 + state.grain[i] * 0.2) * (1 - droplet));
      data[index + 3] = state.config.condensation > 0 ? 255 : Math.round(Math.min(1, surface[i] * side * 2) * 255);
    }
    context.canvas.getContext("2d")!.putImageData(state.image, 0, 0);
  },
});

/** A seeded rain-on-glass displacement map, advanced by CRC's scheduler. */
export function rainDrops(options: RainDropsOptions = {}): TextureRecipe<RainDropsMessage> { return recipe(options); }

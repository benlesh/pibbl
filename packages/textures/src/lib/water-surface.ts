import {
  defineTexture,
  type TextureContext,
  type TextureRecipe,
} from "@crc/core";
import { validateSeed } from "./palette.js";
import { bytes } from "./wasm/water-surface-bytes.js";

export interface WaterSurfaceObstacle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface WaterSurfaceOptions {
  readonly seed?: number;
  readonly speed?: number;
  readonly scale?: number;
  readonly rippleStrength?: number;
  readonly paused?: boolean;
  readonly obstacles?: readonly WaterSurfaceObstacle[];
}

export type WaterSurfaceMessage =
  | { readonly type: "pause"; readonly paused: boolean }
  | { readonly type: "reset" }
  | { readonly type: "ripple"; readonly x: number; readonly y: number };

interface Config {
  readonly seed: number;
  readonly speed: number;
  readonly scale: number;
  readonly rippleStrength: number;
  readonly paused: boolean;
  readonly obstacles: readonly WaterSurfaceObstacle[];
}
interface Mode {
  readonly x: number;
  readonly y: number;
  readonly phase: number;
}
interface State {
  config: Config;
  modes: readonly Mode[];
  simulation: WaterSimulation;
  phase: number;
  paused: boolean;
  fresh: boolean;
  elapsed: number;
  energy: number;
}
interface WaterKernel {
  clear(
    height: number,
    velocity: number,
    nextHeight: number,
    nextVelocity: number,
    count: number,
  ): void;
  impulse(
    velocity: number,
    solid: number,
    width: number,
    height: number,
    u: number,
    v: number,
    radius: number,
    strength: number,
  ): void;
  step(
    height: number,
    velocity: number,
    nextHeight: number,
    nextVelocity: number,
    solid: number,
    width: number,
    rows: number,
    dt: number,
    waveSpeed: number,
    damping: number,
  ): number;
}

const FIXED_STEP = 1 / 120;
const MAX_STEPS = 6;
const IDLE_ENERGY = 0.0006;
let compiled: WebAssembly.Module | undefined;

function kernel(): WebAssembly.Module {
  return (compiled ??= new WebAssembly.Module(
    Uint8Array.from(atob(bytes), (character) => character.charCodeAt(0)),
  ));
}

function gridSize(width: number, height: number): readonly [number, number] {
  const scale = Math.min(
    1,
    128 / Math.min(width, height),
    256 / Math.max(width, height),
  );
  return [
    Math.max(2, Math.round(width * scale)),
    Math.max(2, Math.round(height * scale)),
  ];
}

class WaterSimulation {
  readonly memory: WebAssembly.Memory;
  readonly height: Float32Array;
  readonly velocity: Float32Array;
  private readonly nextHeight: Float32Array;
  private readonly nextVelocity: Float32Array;
  readonly solid: Uint8Array;
  private readonly kernel: WaterKernel;
  private previousObstacles: readonly WaterSurfaceObstacle[] = [];
  constructor(
    readonly width: number,
    readonly rows: number,
    obstacles: readonly WaterSurfaceObstacle[],
  ) {
    const count = width * rows;
    const scalarBytes = count * Float32Array.BYTES_PER_ELEMENT;
    const solidOffset = 65536 + scalarBytes * 4;
    const pages = Math.ceil((solidOffset + count) / 65536);
    this.memory = new WebAssembly.Memory({ initial: pages, maximum: pages });
    this.kernel = new WebAssembly.Instance(kernel(), {
      env: {
        memory: this.memory,
        abort() {
          throw new Error("Water surface WASM aborted.");
        },
      },
    }).exports as unknown as WaterKernel;
    this.height = new Float32Array(this.memory.buffer, 65536, count);
    this.velocity = new Float32Array(
      this.memory.buffer,
      65536 + scalarBytes,
      count,
    );
    this.nextHeight = new Float32Array(
      this.memory.buffer,
      65536 + scalarBytes * 2,
      count,
    );
    this.nextVelocity = new Float32Array(
      this.memory.buffer,
      65536 + scalarBytes * 3,
      count,
    );
    this.solid = new Uint8Array(this.memory.buffer, solidOffset, count);
    this.setObstacles(obstacles);
  }
  reset() {
    this.kernel.clear(
      this.height.byteOffset,
      this.velocity.byteOffset,
      this.nextHeight.byteOffset,
      this.nextVelocity.byteOffset,
      this.height.length,
    );
  }
  setObstacles(obstacles: readonly WaterSurfaceObstacle[]): number {
    if (sameObstacles(this.previousObstacles, obstacles)) return 0;
    const previous = this.previousObstacles;
    this.solid.fill(0);
    for (let y = 0; y < this.rows; y++)
      for (let x = 0; x < this.width; x++) {
        const u = (x + 0.5) / this.width,
          v = (y + 0.5) / this.rows;
        if (
          obstacles.some(
            (obstacle) =>
              u >= obstacle.x &&
              u < obstacle.x + obstacle.width &&
              v >= obstacle.y &&
              v < obstacle.y + obstacle.height,
          )
        )
          this.solid[y * this.width + x] = 1;
      }
    for (let i = 0; i < this.solid.length; i++)
      if (this.solid[i])
        this.height[i] =
          this.velocity[i] =
          this.nextHeight[i] =
          this.nextVelocity[i] =
            0;
    this.previousObstacles = obstacles;
    // A moving solid leaves one bounded impulse at its trailing edge. The
    // height-field remains an appearance-only texture; this is not a force or
    // collider update in CRC physics.
    let wakeEnergy = 0;
    for (
      let index = 0;
      index < Math.min(previous.length, obstacles.length);
      index++
    ) {
      const before = previous[index],
        after = obstacles[index];
      const dx = after.x + after.width / 2 - (before.x + before.width / 2);
      const dy = after.y + after.height / 2 - (before.y + before.height / 2);
      const distance = Math.hypot(dx * this.width, dy * this.rows);
      if (distance <= 1e-6) continue;
      const u = Math.max(
        0,
        Math.min(
          1,
          dx > 0
            ? before.x - 1 / this.width
            : dx < 0
              ? before.x + before.width + 1 / this.width
              : before.x + before.width / 2,
        ),
      );
      const v = Math.max(
        0,
        Math.min(
          1,
          dy > 0
            ? before.y - 1 / this.rows
            : dy < 0
              ? before.y + before.height + 1 / this.rows
              : before.y + before.height / 2,
        ),
      );
      const strength = Math.min(2, distance * 0.12);
      this.ripple(u, v, strength);
      wakeEnergy += strength;
    }
    return wakeEnergy;
  }
  ripple(u: number, v: number, strength: number) {
    this.kernel.impulse(
      this.velocity.byteOffset,
      this.solid.byteOffset,
      this.width,
      this.rows,
      u,
      v,
      Math.max(2, Math.min(this.width, this.rows) * 0.075),
      strength * 1.8,
    );
  }
  step(count: number): number {
    let energy = 0;
    for (let i = 0; i < count; i++)
      energy = this.kernel.step(
        this.height.byteOffset,
        this.velocity.byteOffset,
        this.nextHeight.byteOffset,
        this.nextVelocity.byteOffset,
        this.solid.byteOffset,
        this.width,
        this.rows,
        FIXED_STEP,
        30,
        0.996,
      );
    return energy;
  }
  dispose() {
    this.height.fill(0);
    this.velocity.fill(0);
    this.solid.fill(0);
  }
}

function sameObstacles(
  left: readonly WaterSurfaceObstacle[],
  right: readonly WaterSurfaceObstacle[],
) {
  return (
    left.length === right.length &&
    left.every((value, index) => {
      const other = right[index];
      return (
        value.x === other.x &&
        value.y === other.y &&
        value.width === other.width &&
        value.height === other.height
      );
    })
  );
}
function options(input: WaterSurfaceOptions): Config {
  const seed = validateSeed(input.seed ?? 0),
    speed = input.speed ?? 1,
    scale = input.scale ?? 4,
    rippleStrength = input.rippleStrength ?? 1;
  if (!Number.isFinite(speed) || speed < 0)
    throw new RangeError("Water surface speed must be finite and nonnegative.");
  if (!Number.isInteger(scale) || scale < 1 || scale > 32)
    throw new RangeError(
      "Water surface scale must be an integer from 1 to 32.",
    );
  if (!Number.isFinite(rippleStrength) || rippleStrength < 0)
    throw new RangeError(
      "Water surface ripple strength must be finite and nonnegative.",
    );
  const obstacles = Object.freeze(
    (input.obstacles ?? []).map((obstacle) => {
      if (
        ![obstacle.x, obstacle.y, obstacle.width, obstacle.height].every(
          Number.isFinite,
        ) ||
        obstacle.x < 0 ||
        obstacle.y < 0 ||
        obstacle.width < 0 ||
        obstacle.height < 0 ||
        obstacle.x + obstacle.width > 1 ||
        obstacle.y + obstacle.height > 1
      )
        throw new RangeError(
          "Water surface obstacles must be finite normalized rectangles within [0, 1].",
        );
      return Object.freeze({ ...obstacle });
    }),
  );
  return {
    seed,
    speed,
    scale,
    rippleStrength,
    paused: input.paused ?? false,
    obstacles,
  };
}
function modes(seed: number, scale: number): readonly Mode[] {
  return Object.freeze(
    [0, 1, 2, 3].map((index) => {
      let value = (seed + Math.imul(index + 1, 0x9e3779b9)) >>> 0;
      value ^= value >>> 16;
      value = Math.imul(value, 0x85ebca6b) >>> 0;
      value ^= value >>> 13;
      const other = Math.imul(value ^ (value >>> 15), 0x27d4eb2d) >>> 0;
      return {
        x: ((value % scale) + 1) * (value & 1 ? -1 : 1),
        y: ((other % scale) + 1) * (other & 1 ? -1 : 1),
        phase: ((value >>> 24) / 255) * Math.PI * 2,
      };
    }),
  );
}
function assertDataTexture(context: TextureContext) {
  if (context.palette !== undefined)
    throw new TypeError(
      "waterSurface is a numeric displacement map and does not accept a palette.",
    );
}
function assertCoordinate(value: number, name: "x" | "y") {
  if (!Number.isFinite(value) || value < 0 || value > 1)
    throw new RangeError(
      `Water ripple ${name} must be finite and within [0, 1].`,
    );
}
function active(state: State) {
  return state.config.speed > 0 || state.energy > IDLE_ENERGY;
}
function replaceSimulation(
  state: State,
  context: TextureContext,
  config: Config,
): number {
  const [width, rows] = gridSize(context.canvas.width, context.canvas.height);
  if (state.simulation.width !== width || state.simulation.rows !== rows) {
    state.simulation.dispose();
    state.simulation = new WaterSimulation(width, rows, config.obstacles);
    return 0;
  }
  return state.simulation.setObstacles(config.obstacles);
}
function encode(value: number) {
  return Math.max(0, Math.min(255, Math.round(128 + value * 92)));
}

const recipe = /* @__PURE__ */ defineTexture<
  WaterSurfaceOptions,
  State,
  WaterSurfaceMessage
>({
  defaultPlacement: { mode: "stretch" },
  create(context, input) {
    assertDataTexture(context);
    const config = options(input),
      [width, rows] = gridSize(context.canvas.width, context.canvas.height);
    if (!config.paused && config.speed > 0) context.requestFrame();
    return {
      config,
      modes: modes(config.seed, config.scale),
      simulation: new WaterSimulation(width, rows, config.obstacles),
      phase: 0,
      paused: config.paused,
      fresh: true,
      elapsed: 0,
      energy: 0,
    };
  },
  update(state, input, context) {
    assertDataTexture(context);
    const next = options(input),
      previous = state.config;
    const wasActive = active(state);
    const wakeEnergy = replaceSimulation(state, context, next);
    if (next.seed !== previous.seed || next.scale !== previous.scale) {
      state.phase = 0;
      state.modes = modes(next.seed, next.scale);
      state.simulation.reset();
      state.energy = 0;
    }
    if (next.paused !== previous.paused) state.paused = next.paused;
    if (next.paused !== previous.paused || next.speed !== previous.speed) {
      state.fresh = true;
      state.elapsed = 0;
    }
    state.config = next;
    if (wakeEnergy > 0) {
      state.energy = Math.max(state.energy, wakeEnergy);
      if (!wasActive) {
        state.fresh = true;
        state.elapsed = 0;
      }
    }
    context.invalidate();
    if (!state.paused && active(state)) context.requestFrame();
  },
  receive(state, message, context) {
    if (message.type === "pause") {
      state.paused = message.paused;
      state.fresh = true;
      state.elapsed = 0;
      if (!state.paused && active(state)) context.requestFrame();
      return;
    }
    if (message.type === "reset") {
      state.simulation.reset();
      state.phase = 0;
      state.energy = 0;
      state.elapsed = 0;
      state.fresh = true;
      context.invalidate();
      return;
    }
    if (message.type === "ripple") {
      assertCoordinate(message.x, "x");
      assertCoordinate(message.y, "y");
      const wasActive = active(state);
      state.simulation.ripple(message.x, message.y, 1);
      state.energy = Math.max(state.energy, 1);
      if (!wasActive) {
        state.fresh = true;
        state.elapsed = 0;
      }
      context.invalidate();
      if (!state.paused) context.requestFrame();
      return;
    }
    throw new TypeError("Unknown water surface message.");
  },
  advance(state, frame, context) {
    if (state.paused || !active(state)) return;
    if (!state.fresh) {
      state.elapsed += Math.min(0.05, frame.delta / 1000);
      const steps = Math.min(MAX_STEPS, Math.floor(state.elapsed / FIXED_STEP));
      if (steps) {
        state.elapsed -= steps * FIXED_STEP;
        state.energy = state.simulation.step(steps);
        state.phase += (frame.delta / 1000) * state.config.speed;
        context.invalidate();
      }
    }
    state.fresh = false;
    if (active(state)) context.requestFrame();
  },
  rasterize(state, context) {
    const canvas = context.canvas,
      ctx = canvas.getContext("2d")!,
      image = ctx.createImageData(canvas.width, canvas.height),
      simulation = state.simulation;
    const sample = (u: number, v: number) => {
      const x = Math.max(
        0,
        Math.min(simulation.width - 1, Math.round(u * (simulation.width - 1))),
      );
      const y = Math.max(
        0,
        Math.min(simulation.rows - 1, Math.round(v * (simulation.rows - 1))),
      );
      return simulation.height[y * simulation.width + x];
    };
    for (let y = 0; y < canvas.height; y++)
      for (let x = 0; x < canvas.width; x++) {
        const u = canvas.width <= 1 ? 0 : x / (canvas.width - 1),
          v = canvas.height <= 1 ? 0 : y / (canvas.height - 1);
        const ix = Math.min(
            simulation.width - 1,
            Math.round(u * (simulation.width - 1)),
          ),
          iy = Math.min(
            simulation.rows - 1,
            Math.round(v * (simulation.rows - 1)),
          ),
          offset = (y * canvas.width + x) * 4;
        if (simulation.solid[iy * simulation.width + ix]) {
          image.data[offset + 3] = 0;
          continue;
        }
        let dx =
          (sample(u + 1 / simulation.width, v) -
            sample(u - 1 / simulation.width, v)) *
          simulation.width *
          0.45 *
          state.config.rippleStrength;
        let dy =
          (sample(u, v + 1 / simulation.rows) -
            sample(u, v - 1 / simulation.rows)) *
          simulation.rows *
          0.45 *
          state.config.rippleStrength;
        for (const mode of state.modes) {
          const phase =
            Math.PI * 2 * (mode.x * u + mode.y * v) + state.phase + mode.phase;
          dx += Math.cos(phase) * Math.sign(mode.y) * 0.11;
          dy += Math.sin(phase) * -Math.sign(mode.x) * 0.11;
        }
        image.data[offset] = encode(dx);
        image.data[offset + 1] = encode(dy);
        image.data[offset + 2] = 128;
        image.data[offset + 3] = 255;
      }
    ctx.putImageData(image, 0, 0);
  },
  dispose(state) {
    state.simulation.dispose();
  },
});

/** A WASM-only, bounded reflective height-field displacement map. */
export function waterSurface(
  options: WaterSurfaceOptions = {},
): TextureRecipe<WaterSurfaceMessage> {
  return recipe(options);
}

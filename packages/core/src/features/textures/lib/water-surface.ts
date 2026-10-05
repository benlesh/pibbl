import {
  defineTexture,
  type TextureContext,
  type TextureRecipe,
} from "@crc/core";
import { validateSeed } from "./palette.js";
import { bytes } from "./wasm/water-surface-bytes.js";

/**
 * An axis-aligned obstacle rectangle in a water-surface simulation.
 *
 * @see {@link WaterSurfaceOptions}
 */
export interface WaterSurfaceObstacle {
  /**
   * Horizontal coordinate or displacement in the containing coordinate system. See
   * {@link WaterSurfaceObstacle}.
   */
  readonly x: number;
  /**
   * Vertical coordinate or displacement in the containing coordinate system. See
   * {@link WaterSurfaceObstacle}.
   */
  readonly y: number;
  /**
   * Horizontal extent in the units of the containing geometry or surface. See
   * {@link WaterSurfaceObstacle}.
   */
  readonly width: number;
  /**
   * Vertical extent in the units of the containing geometry or surface. See
   * {@link WaterSurfaceObstacle}.
   */
  readonly height: number;
}

/**
 * Water simulation controls including wave motion, viscosity, pause state, and obstacles.
 *
 * @see {@link WaterSurfaceObstacle}
 * @see {@link waterSurface}
 */
export interface WaterSurfaceOptions {
  /**
   * Seed used for deterministic sampling or simulation initialization. See
   * {@link WaterSurfaceOptions}.
   */
  readonly seed?: number;
  /** Multiplier controlling the simulation's animation rate. See {@link WaterSurfaceOptions}. */
  readonly speed?: number;
  /** Spatial scale of the generated water pattern. See {@link WaterSurfaceOptions}. */
  readonly scale?: number;
  /** Strength of injected wave disturbances. See {@link WaterSurfaceOptions}. */
  readonly rippleStrength?: number;
  /** Artistic thickness from 0 (water) to 1 (slow, strongly damped). */
  readonly viscosity?: number;
  /** Whether simulation or playback advancement is suspended. See {@link WaterSurfaceOptions}. */
  readonly paused?: boolean;
  /** Obstacle geometry used by the flow or water simulation. See {@link WaterSurfaceObstacle}. */
  readonly obstacles?: readonly WaterSurfaceObstacle[];
}

/**
 * Ripple, pause, and reset commands for a water-surface simulation.
 *
 * @see {@link waterSurface}
 */
export type WaterSurfaceMessage =
  | {
      /** The literal "pause" identifying this variant. See {@link WaterSurfaceMessage}. */
      readonly type: "pause";
      /** Whether simulation or playback advancement is suspended. See {@link WaterSurfaceMessage}. */
      readonly paused: boolean;
    }
  | {
      /** The literal "reset" identifying this variant. See {@link WaterSurfaceMessage}. */
      readonly type: "reset";
    }
  | {
      /** The literal "ripple" identifying this variant. See {@link WaterSurfaceMessage}. */
      readonly type: "ripple";
      /**
       * Horizontal coordinate or displacement in the containing coordinate system. See
       * {@link WaterSurfaceMessage}.
       */
      readonly x: number;
      /**
       * Vertical coordinate or displacement in the containing coordinate system. See
       * {@link WaterSurfaceMessage}.
       */
      readonly y: number;
    };

interface Config {
  readonly seed: number;
  readonly speed: number;
  readonly scale: number;
  readonly rippleStrength: number;
  readonly viscosity: number;
  readonly paused: boolean;
  readonly obstacles: readonly WaterSurfaceObstacle[];
}
interface State {
  config: Config;
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
    rows: number,
    u: number,
    v: number,
    radius: number,
    strength: number,
  ): void;
  steps(
    height: number,
    velocity: number,
    nextHeight: number,
    nextVelocity: number,
    solid: number,
    width: number,
    rows: number,
    count: number,
    viscosity: number,
  ): number;
  clearMask(solid: number, count: number): void;
  maskRectangle(
    solid: number,
    width: number,
    rows: number,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void;
  maskFields(
    height: number,
    velocity: number,
    nextHeight: number,
    nextVelocity: number,
    solid: number,
    count: number,
  ): void;
  wake(
    velocity: number,
    solid: number,
    width: number,
    rows: number,
    bx: number,
    by: number,
    bw: number,
    bh: number,
    ax: number,
    ay: number,
    aw: number,
    ah: number,
  ): number;
  initializeModes(ptr: number, seed: number, scale: number): void;
  raster(
    height: number,
    solid: number,
    width: number,
    rows: number,
    pixels: number,
    outWidth: number,
    outHeight: number,
    modes: number,
    time: number,
    strength: number,
  ): void;
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
  readonly image: ImageData;
  private readonly modeOffset: number;
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
    readonly outputWidth: number,
    readonly outputHeight: number,
    config: Config,
  ) {
    const count = width * rows;
    const scalarBytes = count * Float32Array.BYTES_PER_ELEMENT;
    const solidOffset = 65536 + scalarBytes * 4;
    this.modeOffset = Math.ceil((solidOffset + count) / 8) * 8;
    const pixelOffset = this.modeOffset + 96;
    const pages = Math.ceil(
      (pixelOffset + outputWidth * outputHeight * 4) / 65536,
    );
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
    this.image = new ImageData(
      new Uint8ClampedArray(
        this.memory.buffer,
        pixelOffset,
        outputWidth * outputHeight * 4,
      ),
      outputWidth,
      outputHeight,
    );
    this.configure(config);
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
    this.kernel.clearMask(this.solid.byteOffset, this.solid.length);
    for (const o of obstacles)
      this.kernel.maskRectangle(
        this.solid.byteOffset,
        this.width,
        this.rows,
        o.x,
        o.y,
        o.width,
        o.height,
      );
    this.kernel.maskFields(
      this.height.byteOffset,
      this.velocity.byteOffset,
      this.nextHeight.byteOffset,
      this.nextVelocity.byteOffset,
      this.solid.byteOffset,
      this.solid.length,
    );
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
      wakeEnergy += this.kernel.wake(
        this.velocity.byteOffset,
        this.solid.byteOffset,
        this.width,
        this.rows,
        before.x,
        before.y,
        before.width,
        before.height,
        after.x,
        after.y,
        after.width,
        after.height,
      );
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
  step(count: number, viscosity: number): number {
    return this.kernel.steps(
      this.height.byteOffset,
      this.velocity.byteOffset,
      this.nextHeight.byteOffset,
      this.nextVelocity.byteOffset,
      this.solid.byteOffset,
      this.width,
      this.rows,
      count,
      viscosity,
    );
  }
  configure(config: Config) {
    this.kernel.initializeModes(this.modeOffset, config.seed, config.scale);
  }
  raster(time: number, strength: number) {
    this.kernel.raster(
      this.height.byteOffset,
      this.solid.byteOffset,
      this.width,
      this.rows,
      this.image.data.byteOffset,
      this.outputWidth,
      this.outputHeight,
      this.modeOffset,
      time,
      strength,
    );
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
    rippleStrength = input.rippleStrength ?? 1,
    viscosity = input.viscosity ?? 0;
  if (!Number.isFinite(viscosity) || viscosity < 0 || viscosity > 1)
    throw new RangeError(
      "Water surface viscosity must be finite and within [0, 1].",
    );
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
    viscosity,
    paused: input.paused ?? false,
    obstacles,
  };
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
  if (
    state.simulation.width !== width ||
    state.simulation.rows !== rows ||
    state.simulation.outputWidth !== context.canvas.width ||
    state.simulation.outputHeight !== context.canvas.height
  ) {
    state.simulation.dispose();
    state.simulation = new WaterSimulation(
      width,
      rows,
      config.obstacles,
      context.canvas.width,
      context.canvas.height,
      config,
    );
    return 0;
  }
  return state.simulation.setObstacles(config.obstacles);
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
      simulation: new WaterSimulation(
        width,
        rows,
        config.obstacles,
        context.canvas.width,
        context.canvas.height,
        config,
      ),
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
      state.simulation.configure(next);
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
        state.energy = state.simulation.step(steps, state.config.viscosity);
        state.phase +=
          ((frame.delta / 1000) * state.config.speed) /
          (1 + 4 * state.config.viscosity);
        context.invalidate();
      }
    }
    state.fresh = false;
    if (active(state)) context.requestFrame();
  },
  rasterize(state, context) {
    state.simulation.raster(state.phase, state.config.rippleStrength);
    context.canvas.getContext("2d")!.putImageData(state.simulation.image, 0, 0);
  },
  dispose(state) {
    state.simulation.dispose();
  },
});

/**
 * A WASM-only, bounded reflective height-field displacement map.
 *
 * @param options - Water appearance and simulation settings. See {@link WaterSurfaceOptions}.
 * @returns A water-surface texture recipe accepting surface messages. See {@link TextureRecipe} ,
 * {@link WaterSurfaceMessage} .
 *
 * @see {@link WaterSurfaceOptions}
 * @see {@link TextureRecipe}
 * @see {@link WaterSurfaceMessage}
 */
export function waterSurface(
  options: WaterSurfaceOptions = {},
): TextureRecipe<WaterSurfaceMessage> {
  return recipe(options);
}

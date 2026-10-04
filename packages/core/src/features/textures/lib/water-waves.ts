import {
  defineTexture,
  type TextureContext,
  type TextureRecipe,
} from "@crc/core";
import { bytes } from "./wasm/water-waves-bytes.js";
import { validateSeed } from "./palette.js";

export interface WaterWavesOptions {
  readonly seed?: number;
  readonly speed?: number;
  readonly scale?: number;
  readonly rippleStrength?: number;
  readonly paused?: boolean;
}

export type WaterWavesMessage =
  | { readonly type: "pause"; readonly paused: boolean }
  | { readonly type: "reset" }
  | { readonly type: "ripple"; readonly x: number; readonly y: number };

interface Config {
  seed: number;
  speed: number;
  scale: number;
  rippleStrength: number;
  paused: boolean;
}
interface State {
  config: Config;
  field: WaveField;
  phase: number;
  paused: boolean;
  fresh: boolean;
  rippleCount: number;
}
interface WaveKernel {
  initializeModes(ptr: number, seed: number, scale: number): void;
  reset(): void;
  ripple(x: number, y: number): void;
  advance(elapsed: number): number;
  raster(
    pixels: number,
    width: number,
    height: number,
    time: number,
    strength: number,
  ): void;
}
let compiled: WebAssembly.Module | undefined;
class WaveField {
  readonly kernel: WaveKernel;
  readonly image: ImageData;
  constructor(width: number, height: number, config: Config) {
    const pages = Math.ceil((66024 + width * height * 4) / 65536);
    const memory = new WebAssembly.Memory({ initial: pages, maximum: pages });
    compiled ??= new WebAssembly.Module(
      Uint8Array.from(atob(bytes), (c) => c.charCodeAt(0)),
    );
    this.kernel = new WebAssembly.Instance(compiled, {
      env: {
        memory,
        abort() {
          throw new Error("Water waves WASM aborted.");
        },
      },
    }).exports as unknown as WaveKernel;
    this.image = new ImageData(
      new Uint8ClampedArray(memory.buffer, 66024, width * height * 4),
      width,
      height,
    );
    this.configure(config);
  }
  configure(config: Config) {
    this.kernel.initializeModes(65536, config.seed, config.scale);
  }
  raster(time: number, strength: number) {
    this.kernel.raster(
      66024,
      this.image.width,
      this.image.height,
      time,
      strength,
    );
  }
}

function config(input: WaterWavesOptions): Config {
  const seed = validateSeed(input.seed ?? 0);
  const speed = input.speed ?? 1;
  const scale = input.scale ?? 4;
  const rippleStrength = input.rippleStrength ?? 1;
  if (!Number.isFinite(speed) || speed < 0)
    throw new RangeError("Water wave speed must be finite and nonnegative.");
  if (!Number.isInteger(scale) || scale < 1 || scale > 32)
    throw new RangeError("Water wave scale must be an integer from 1 to 32.");
  if (!Number.isFinite(rippleStrength) || rippleStrength < 0)
    throw new RangeError(
      "Water ripple strength must be finite and nonnegative.",
    );
  return { seed, speed, scale, rippleStrength, paused: input.paused ?? false };
}

function assertDataTexture(context: TextureContext): void {
  if (context.palette !== undefined)
    throw new TypeError(
      "waterWaves is a numeric displacement map and does not accept a palette.",
    );
}
function isAnimating(state: State): boolean {
  return state.config.speed > 0 || state.rippleCount > 0;
}
function assertRippleCoordinate(value: number, name: "x" | "y"): void {
  if (!Number.isFinite(value) || value < 0 || value > 1)
    throw new RangeError(
      `Water ripple ${name} must be finite and within [0, 1].`,
    );
}

const recipe = /* @__PURE__ */ defineTexture<
  WaterWavesOptions,
  State,
  WaterWavesMessage
>({
  create(context, input) {
    assertDataTexture(context);
    const next = config(input);
    if (!next.paused && next.speed > 0) context.requestFrame();
    return {
      config: next,
      field: new WaveField(context.canvas.width, context.canvas.height, next),
      phase: 0,
      paused: next.paused,
      fresh: true,
      rippleCount: 0,
    };
  },
  update(state, input, context) {
    assertDataTexture(context);
    const next = config(input);
    const previous = state.config;
    if (next.seed !== previous.seed || next.scale !== previous.scale) {
      state.phase = 0;
      state.field.configure(next);
      context.invalidate();
    }
    if (next.rippleStrength !== previous.rippleStrength) context.invalidate();
    if (next.paused !== previous.paused) state.paused = next.paused;
    if (next.paused !== previous.paused || next.speed !== previous.speed)
      state.fresh = true;
    state.config = next;
    if (!state.paused && isAnimating(state)) context.requestFrame();
  },
  receive(state, message, context) {
    if (message.type === "pause") {
      state.paused = message.paused;
      state.fresh = true;
      if (!state.paused && isAnimating(state)) context.requestFrame();
      return;
    }
    if (message.type === "reset") {
      state.phase = 0;
      state.field.kernel.reset();
      state.rippleCount = 0;
      state.fresh = true;
      context.invalidate();
      return;
    }
    if (message.type === "ripple") {
      assertRippleCoordinate(message.x, "x");
      assertRippleCoordinate(message.y, "y");
      if (!isAnimating(state)) state.fresh = true;
      state.field.kernel.ripple(message.x, message.y);
      state.rippleCount = Math.min(16, state.rippleCount + 1);
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
      state.rippleCount = state.field.kernel.advance(elapsed);
      context.invalidate();
    }
    state.fresh = false;
    if (isAnimating(state)) context.requestFrame();
  },
  rasterize(state, context) {
    const ctx = context.canvas.getContext("2d")!;
    state.field.raster(state.phase, state.config.rippleStrength);
    ctx.putImageData(state.field.image, 0, 0);
  },
});

export function waterWaves(
  options: WaterWavesOptions = {},
): TextureRecipe<WaterWavesMessage> {
  return recipe(options);
}

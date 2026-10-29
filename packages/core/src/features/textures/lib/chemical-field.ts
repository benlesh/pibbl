/** Private periodic finite-difference state; presentation adds a duplicate seam row/column. */
export interface ChemicalConfig {
  readonly a: number;
  readonly b: number;
  readonly epsilon: number;
  readonly diffusionU: number;
  readonly diffusionV: number;
  readonly seed: number;
  readonly initialNoise: number;
  readonly warmupSteps: number;
  readonly speed: number;
  readonly paused: boolean;
}
interface Model {
  readonly equilibrium: (c: ChemicalConfig) => readonly [number, number];
  readonly reaction: (
    u: number,
    v: number,
    c: ChemicalConfig,
  ) => readonly [number, number];
  readonly excite: boolean;
}
export const schnakenbergModel: Model = {
  equilibrium: (c) => [c.a + c.b, c.b / (c.a + c.b) ** 2],
  reaction: (u, v, c) => {
    const q = u * u * v;
    return [c.a - u + q, c.b - q];
  },
  excite: false,
};
export const brusselatorModel: Model = {
  equilibrium: (c) => [c.a, c.b / c.a],
  reaction: (u, v, c) => {
    const q = u * u * v;
    return [c.a - (c.b + 1) * u + q, c.b * u - q];
  },
  excite: false,
};
export const barkleyModel: Model = {
  equilibrium: () => [0, 0],
  reaction: (u, v, c) => [
    (u * (1 - u) * (u - (v + c.b) / c.a)) / c.epsilon,
    u - v,
  ],
  excite: true,
};
function hash(i: number, seed: number) {
  let n = Math.imul(i ^ seed, 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 0xffffffff;
}
const wrap = (value: number, size: number) => ((value % size) + size) % size;
export class ChemicalField {
  u: Float32Array;
  v: Float32Array;
  private nextU: Float32Array;
  private nextV: Float32Array;
  private maxU = 1;
  private maxV = 1;
  readonly width: number;
  readonly height: number;
  readonly baseline: number;
  constructor(
    private readonly options: {
      width: number;
      height: number;
      config: ChemicalConfig;
      model: Model;
    },
  ) {
    this.width = options.width;
    this.height = options.height;
    const n = this.width * this.height;
    this.u = new Float32Array(n);
    this.v = new Float32Array(n);
    this.nextU = new Float32Array(n);
    this.nextV = new Float32Array(n);
    const c = options.config,
      [u, v] = options.model.equilibrium(c);
    this.baseline = options.model.excite ? 1 : u;
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) {
        const i = y * this.width + x,
          noise = hash(i, c.seed) - 0.5;
        if (options.model.excite) {
          const split = 0.5 + (hash(0, c.seed) - 0.5) * 0.08;
          this.u[i] =
            (x > this.width * 0.22 &&
            x < this.width * 0.5 &&
            y < this.height * split
              ? 1
              : 0) *
              (1 - c.initialNoise * 0.5) +
            c.initialNoise * Math.max(0, noise);
          this.v[i] = y >= this.height * split ? 0.5 : 0;
        } else {
          this.u[i] = u * (1 + c.initialNoise * noise);
          this.v[i] =
            v * (1 + c.initialNoise * (hash(i, c.seed ^ 0x517cc1b7) - 0.5));
        }
      }
    this.maxU = Math.max(1, u * 1.5);
    this.maxV = Math.max(1, v * 1.5);
    this.advance(c.warmupSteps);
  }
  advance(count: number) {
    const { config: c, model } = this.options,
      w = this.width,
      h = this.height;
    for (let step = 0; step < count; step++) {
      // Euler diffusion CFL and reaction stiffness limits. No user-facing time-step knob.
      const stiffness = model.excite
        ? 1 / c.epsilon
        : 1 + this.maxU * this.maxU + 2 * this.maxU * this.maxV + c.b;
      const dt = Math.min(
        0.05,
        0.2 / Math.max(0.001, c.diffusionU, c.diffusionV),
        0.1 / stiffness,
      );
      let maxU = 0,
        maxV = 0;
      for (let y = 0; y < h; y++) {
        const row = y * w,
          above = (y === 0 ? h - 1 : y - 1) * w,
          below = (y === h - 1 ? 0 : y + 1) * w;
        for (let x = 0; x < w; x++) {
          const i = row + x,
            left = row + (x === 0 ? w - 1 : x - 1),
            right = row + (x === w - 1 ? 0 : x + 1);
          const u = this.u[i]!,
            v = this.v[i]!;
          const lapU =
            this.u[left]! +
            this.u[right]! +
            this.u[above + x]! +
            this.u[below + x]! -
            4 * u;
          const lapV =
            this.v[left]! +
            this.v[right]! +
            this.v[above + x]! +
            this.v[below + x]! -
            4 * v;
          const [ru, rv] = model.reaction(u, v, c);
          const nu = Math.max(0, u + dt * (c.diffusionU * lapU + ru));
          const nv = Math.max(0, v + dt * (c.diffusionV * lapV + rv));
          if (!Number.isFinite(nu) || !Number.isFinite(nv))
            throw new RangeError(
              "Reaction-diffusion parameters produced a nonfinite field.",
            );
          this.nextU[i] = nu;
          this.nextV[i] = nv;
          maxU = Math.max(maxU, nu);
          maxV = Math.max(maxV, nv);
        }
      }
      [this.u, this.nextU] = [this.nextU, this.u];
      [this.v, this.nextV] = [this.nextV, this.v];
      this.maxU = maxU;
      this.maxV = maxV;
    }
  }
  paint(options: { u: number; v: number; radius: number; strength: number }) {
    const { width: w, height: h } = this;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = wrap(x - options.u * w + w / 2, w) - w / 2,
          dy = wrap(y - options.v * h + h / 2, h) - h / 2;
        const distance = Math.hypot(dx, dy) / options.radius;
        if (distance >= 1) continue;
        const dose = options.strength * (1 - distance * distance) ** 2;
        const i = y * w + x;
        this.u[i] = Math.max(
          this.u[i]!,
          this.options.model.excite ? dose : this.baseline * (1 + 2 * dose),
        );
      }
    this.maxU = Math.max(this.maxU, this.baseline * 3);
  }
  stir(options: {
    u: number;
    v: number;
    du: number;
    dv: number;
    radius: number;
  }) {
    const w = this.width,
      h = this.height;
    const sample = (field: Float32Array, x: number, y: number) => {
      x = wrap(x, w);
      y = wrap(y, h);
      const ix = Math.floor(x),
        iy = Math.floor(y),
        fx = x - ix,
        fy = y - iy;
      const x1 = (ix + 1) % w,
        y1 = (iy + 1) % h;
      return (
        (field[iy * w + ix]! * (1 - fx) + field[iy * w + x1]! * fx) * (1 - fy) +
        (field[y1 * w + ix]! * (1 - fx) + field[y1 * w + x1]! * fx) * fy
      );
    };
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = wrap(x - options.u * w + w / 2, w) - w / 2,
          dy = wrap(y - options.v * h + h / 2, h) - h / 2;
        const t = Math.max(0, 1 - Math.hypot(dx, dy) / options.radius),
          weight = t * t * (3 - 2 * t);
        const px = x - options.du * w * weight,
          py = y - options.dv * h * weight,
          i = y * w + x;
        this.nextU[i] = sample(this.u, px, py);
        this.nextV[i] = sample(this.v, px, py);
      }
    [this.u, this.nextU] = [this.nextU, this.u];
    [this.v, this.nextV] = [this.nextV, this.v];
  }
  intensity(index: number) {
    return this.options.model.excite
      ? this.u[index]!
      : this.u[index]! / (2 * this.baseline);
  }
  dispose() {
    this.u = this.v = this.nextU = this.nextV = new Float32Array(0);
  }
}

/** Private, renderer-independent Gray–Scott state. No clock or DOM ownership. */
export class InkSimulation {
  a: Float32Array;
  b: Float32Array;
  private nextA: Float32Array;
  private nextB: Float32Array;
  steps = 0;
  constructor(
    readonly width: number,
    readonly height: number,
    seed: number,
    readonly preset: "spots" | "stripes",
  ) {
    const count = width * height;
    this.a = new Float32Array(count).fill(1);
    this.b = new Float32Array(count);
    this.nextA = new Float32Array(count);
    this.nextB = new Float32Array(count);
    const random = seededRandom(seed);
    for (let i = 0; i < Math.max(6, Math.floor(count / 500)); i++) {
      this.seedPatch(
        random() * width,
        random() * height,
        1.5 + random() * 2,
        0.9,
      );
    }
  }
  paint(x: number, y: number, radius: number, strength: number) {
    // A broad, uniform dose exhausts its fuel and collapses in the spots regime.
    // Plant separated nuclei instead, leaving established colonies undisturbed.
    const seedRadius = Math.min(radius, 3);
    const spread = radius - seedRadius;
    const extent = Math.floor(spread / 6) * 6;
    let hasCandidate = false;
    for (let dy = -extent; dy <= extent; dy += 12) {
      for (let dx = -extent; dx <= extent; dx += 12) {
        if (Math.hypot(dx, dy) > spread) continue;
        hasCandidate = true;
        this.plant(x + dx, y + dy, seedRadius, strength);
      }
    }
    if (!hasCandidate) this.plant(x, y, seedRadius, strength);
  }
  private plant(x: number, y: number, radius: number, strength: number) {
    // A gentle, localized dose works on both blank territory and mature ink.
    // It avoids the fuel-starving flash that a full-strength patch produces.
    this.seedPatch(x, y, radius, strength * 0.45);
  }
  private seedPatch(x: number, y: number, radius: number, strength: number) {
    for (
      let py = Math.max(0, Math.floor(y - radius));
      py <= Math.min(this.height - 1, Math.ceil(y + radius));
      py++
    ) {
      for (
        let px = Math.max(0, Math.floor(x - radius));
        px <= Math.min(this.width - 1, Math.ceil(x + radius));
        px++
      ) {
        const distance = Math.hypot(px + 0.5 - x, py + 0.5 - y) / radius;
        if (distance >= 1) continue;
        const amount = strength * Math.min(1, (1 - distance) * 3);
        const i = py * this.width + px;
        this.a[i] += (0.2 - this.a[i]) * amount;
        this.b[i] += (0.9 - this.b[i]) * amount;
      }
    }
  }
  advance(count: number) {
    const { width: w, height: h } = this;
    const feed = this.preset === "spots" ? 0.0367 : 0.029;
    const kill = this.preset === "spots" ? 0.0649 : 0.057;
    for (let step = 0; step < count; step++) {
      const a = this.a,
        b = this.b,
        na = this.nextA,
        nb = this.nextB;
      for (let y = 0; y < h; y++) {
        const row = y * w,
          up = ((y + h - 1) % h) * w,
          down = ((y + 1) % h) * w;
        for (let x = 0; x < w; x++) {
          const left = (x + w - 1) % w,
            right = (x + 1) % w,
            i = row + x;
          const av = a[i],
            bv = b[i],
            reaction = av * bv * bv;
          const lapA =
            -av +
            0.2 * (a[row + left] + a[row + right] + a[up + x] + a[down + x]) +
            0.05 *
              (a[up + left] + a[up + right] + a[down + left] + a[down + right]);
          const lapB =
            -bv +
            0.2 * (b[row + left] + b[row + right] + b[up + x] + b[down + x]) +
            0.05 *
              (b[up + left] + b[up + right] + b[down + left] + b[down + right]);
          na[i] = Math.max(
            0,
            Math.min(1, av + lapA - reaction + feed * (1 - av)),
          );
          nb[i] = Math.max(
            0,
            Math.min(1, bv + 0.5 * lapB + reaction - (kill + feed) * bv),
          );
        }
      }
      this.a = na;
      this.b = nb;
      this.nextA = a;
      this.nextB = b;
      this.steps++;
    }
  }
  dispose() {
    this.a = this.b = this.nextA = this.nextB = new Float32Array(0);
  }
}

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

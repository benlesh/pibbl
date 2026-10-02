import { FieldMemory, lazyKernel } from "./wasm/memory.js";
import { bytes } from "./wasm/ink-bytes.js";
const module = /* @__PURE__ */ lazyKernel(bytes);
/** Private WASM Gray–Scott state. CRC owns the clock and resource lifetime. */
export class InkSimulation {
  a: Float32Array;
  b: Float32Array;
  private owner?: FieldMemory;
  private parity = 0;
  steps = 0;
  constructor(
    readonly width: number,
    readonly height: number,
    seed: number,
    readonly preset: "spots" | "stripes",
  ) {
    const owner = (this.owner = new FieldMemory(module(), width, height, 4));
    [this.a, this.b] = owner.fields;
    owner.kernel.initialize(
      this.a.byteOffset,
      this.b.byteOffset,
      width,
      height,
      seed,
    );
  }
  paint(x: number, y: number, radius: number, strength: number) {
    const owner = this.owner!;
    owner.stamps[0] = x;
    owner.stamps[1] = y;
    owner.stamps[2] = radius;
    owner.stamps[3] = strength;
    owner.kernel.paintBatch(
      this.a.byteOffset,
      this.b.byteOffset,
      this.width,
      this.height,
      owner.stamps.byteOffset,
      1,
    );
  }
  stir(x: number, y: number, dx: number, dy: number, radius: number) {
    const owner = this.owner!,
      next = 2 - this.parity;
    owner.kernel.stir(
      this.a.byteOffset,
      this.b.byteOffset,
      owner.fields[next].byteOffset,
      owner.fields[next + 1].byteOffset,
      this.width,
      this.height,
      x,
      y,
      dx,
      dy,
      radius,
    );
  }
  advance(count: number) {
    const owner = this.owner!,
      next = 2 - this.parity;
    owner.kernel.advance(
      this.a.byteOffset,
      this.b.byteOffset,
      owner.fields[next].byteOffset,
      owner.fields[next + 1].byteOffset,
      this.width,
      this.height,
      count,
      this.preset === "spots" ? 0.0367 : 0.029,
      this.preset === "spots" ? 0.0649 : 0.057,
    );
    if (count % 2) this.parity = next;
    this.a = owner.fields[this.parity];
    this.b = owner.fields[this.parity + 1];
    this.steps += count;
  }
  dispose() {
    this.owner?.dispose();
    this.owner = undefined;
    this.a = this.b = new Float32Array(0);
  }
}

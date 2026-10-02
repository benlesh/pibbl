/** Private ABI. Buffers never grow while Canvas or a field view borrows them. */
type Kernel = Record<string, (...args: number[]) => void>;
export function lazyKernel(bytes: string): () => WebAssembly.Module {
  let module: WebAssembly.Module | undefined;
  return () =>
    (module ??= new WebAssembly.Module(
      Uint8Array.from(atob(bytes), (c) => c.charCodeAt(0)),
    ));
}
interface Raster {
  readonly image: ImageData;
  readonly alpha: Uint8ClampedArray;
}
let owners: WeakMap<Float32Array, FieldMemory> | undefined;
export function rasterizeField(
  field: Float32Array,
  lut: Uint8ClampedArray,
  gain = 1,
): Raster | undefined {
  return owners?.get(field)?.rasterize(field, lut, gain);
}
export class FieldMemory {
  readonly memory: WebAssembly.Memory;
  readonly kernel: Kernel;
  readonly fields: Float32Array<ArrayBuffer>[];
  private readonly pixels: Uint8ClampedArray<ArrayBuffer>;
  private readonly alpha: Uint8ClampedArray<ArrayBuffer>;
  private readonly lut: Uint8ClampedArray<ArrayBuffer>;
  private image?: ImageData;
  readonly stamps: Float64Array<ArrayBuffer>;
  constructor(
    module: WebAssembly.Module,
    readonly width: number,
    readonly height: number,
    fieldCount: number,
  ) {
    const n = width * height,
      pixels = 65536 + n * 4 * fieldCount;
    const alpha = pixels + n * 4,
      lut = (alpha + n + 3) & ~3,
      stamps = (lut + 1024 + 7) & ~7;
    const pages = Math.ceil((stamps + 32) / 65536);
    this.memory = new WebAssembly.Memory({ initial: pages, maximum: pages });
    this.kernel = new WebAssembly.Instance(module, {
      env: {
        memory: this.memory,
        abort() {
          throw new Error("Texture WASM aborted.");
        },
      },
    }).exports as Kernel;
    this.fields = Array.from(
      { length: fieldCount },
      (_, i) => new Float32Array(this.memory.buffer, 65536 + i * n * 4, n),
    );
    this.pixels = new Uint8ClampedArray(this.memory.buffer, pixels, n * 4);
    this.alpha = new Uint8ClampedArray(this.memory.buffer, alpha, n);
    this.lut = new Uint8ClampedArray(this.memory.buffer, lut, 1024);
    this.stamps = new Float64Array(this.memory.buffer, stamps, 4);
    owners ??= new WeakMap();
    for (const field of this.fields) owners.set(field, this);
  }
  rasterize(field: Float32Array, lut: Uint8ClampedArray, gain: number): Raster {
    this.lut.set(lut);
    this.kernel.colorize(
      field.byteOffset,
      this.lut.byteOffset,
      this.pixels.byteOffset,
      this.alpha.byteOffset,
      field.length,
      gain,
    );
    this.image ??= new ImageData(this.pixels, this.width, this.height);
    return { image: this.image, alpha: this.alpha };
  }
  dispose() {
    for (const field of this.fields) owners?.delete(field);
  }
}

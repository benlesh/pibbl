import { bytes } from './bifrost-bytes.js';

// Private fixed ABI: 56 Float64 records of x/y/length/width/hue/alpha.
// Each definition owns one fixed page and view; imports and inert definitions
// allocate no WASM resources. Compilation is shared on first animated use.
let compiled: WebAssembly.Module | undefined;
interface KernelExports {
  initialize(seed: number): void;
  sample(seconds: number, flow: number, power: number, width: number, distance: number, ex: number, ey: number, dx: number, dy: number): void;
}
export function bifrostKernel(seed: number) {
  let kernel: KernelExports | undefined;
  let output: Float64Array;
  return (seconds: number, flow: number, power: number, width: number, distance: number, ex: number, ey: number, dx: number, dy: number): Float64Array => {
    if (!kernel) {
      compiled ??= new WebAssembly.Module(Uint8Array.from(atob(bytes), c => c.charCodeAt(0)));
      const memory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
      const instance = new WebAssembly.Instance(compiled, {
        env: { memory, abort() { throw new Error('Bifrost WASM calculation failed.'); } },
      });
      const initialized = instance.exports as unknown as KernelExports;
      initialized.initialize(seed);
      output = new Float64Array(memory.buffer, 16384, 56 * 6);
      kernel = initialized;
    }
    kernel.sample(seconds, flow, power, width, distance, ex, ey, dx, dy);
    return output;
  };
}

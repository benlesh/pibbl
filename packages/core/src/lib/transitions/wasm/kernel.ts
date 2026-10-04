/** Private fixed-page ABI. Views never grow or cross asynchronous boundaries. */
export function lazyTransitionKernel(bytes: string, pages = 1) {
  let compiled: WebAssembly.Module | undefined;
  return (seed: number) => {
    let state: { exports: Record<string, (...args: number[]) => void>; values: Float64Array } | undefined;
    return () => {
      if (!state) {
        compiled ??= new WebAssembly.Module(Uint8Array.from(atob(bytes), c => c.charCodeAt(0)));
        const memory = new WebAssembly.Memory({ initial: pages, maximum: pages });
        const instance = new WebAssembly.Instance(compiled, { env: { memory, abort() { throw new Error('Transition WASM calculation failed.'); } } });
        const exports = instance.exports as Record<string, (...args: number[]) => void>;
        exports.initialize!(seed);
        state = { exports, values: new Float64Array(memory.buffer, 16384) };
      }
      return state;
    };
  };
}

// A minimal real WASM recorder: exported memory + bulk-memory copy.
// Equivalent WAT: (memory (export "memory") 1 65536)
// (func (export "record") (param i32 i32 i32)
//   local.get 0 local.get 1 local.get 2 memory.copy)
export const recordingWasmBytes = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 7, 1, 96, 3, 127, 127, 127, 0, 3, 2, 1, 0, 5,
  6, 1, 1, 1, 128, 128, 4, 7, 19, 2, 6, 109, 101, 109, 111, 114, 121, 2, 0, 6,
  114, 101, 99, 111, 114, 100, 0, 0, 10, 14, 1, 12, 0, 32, 0, 32, 1, 32, 2, 252,
  10, 0, 0, 11,
]);

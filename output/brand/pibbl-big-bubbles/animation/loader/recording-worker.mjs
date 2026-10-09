import { recordingWasmBytes } from "./recording-wasm.mjs";
let instance, offset, frameBytes, limit, frames;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === "start") {
      instance = (await WebAssembly.instantiate(recordingWasmBytes)).instance;
      frameBytes = data.frameBytes;
      offset = frameBytes;
      limit = data.budget.allocatedBytes;
      const allocationStart = performance.now();
      if (data.store) instance.exports.memory.grow(data.budget.pages - 1);
      const allocationMs = performance.now() - allocationStart;
      frames = [];
      self.postMessage({ type: "ready", allocationMs });
      return;
    }
    if (data.type === "frame") {
      let growMs = 0,
        copyMs = 0,
        storeMs = 0,
        stored = false,
        checksum = 0;
      const pixels = new Uint8Array(data.buffer);
      if (data.store && offset + frameBytes <= limit) {
        const memory = instance.exports.memory,
          required = offset + frameBytes;
        const allocationStart = performance.now();
        if (memory.buffer.byteLength < required)
          memory.grow(Math.ceil((required - memory.buffer.byteLength) / 65536));
        growMs = performance.now() - allocationStart;
        const start = performance.now();
        new Uint8Array(memory.buffer, 0, frameBytes).set(pixels);
        copyMs = performance.now() - start;
        const recordStart = performance.now();
        instance.exports.record(offset, 0, frameBytes);
        storeMs = performance.now() - recordStart;
        // Validate sampled stored bytes against incoming pixels; not a full hash.
        const saved = new Uint8Array(memory.buffer, offset, frameBytes);
        for (let i = 0; i < frameBytes; i += 4096) {
          if (saved[i] !== pixels[i])
            throw new Error("WASM bitmap copy mismatch");
          checksum += saved[i];
        }
        frames.push({ offset, timestamp: data.timestamp });
        offset += frameBytes;
        stored = true;
      }
      self.postMessage({
        type: "ack",
        id: data.id,
        growMs,
        copyMs,
        storeMs,
        stored,
        checksum,
        storedBytes: frames.length * frameBytes,
      });
      return;
    }
    if (data.type === "finish") {
      self.postMessage({
        type: "finished",
        storedFrames: frames.length,
        storedBytes: frames.length * frameBytes,
        allocatedBytes: instance.exports.memory.buffer.byteLength,
      });
    }
  } catch (error) {
    self.postMessage({ type: "error", message: error.message });
  }
};
